import * as XLSX from 'xlsx';
import { normalizeString, parseTurkishNumber, extractInvoiceNo } from '../utils/parsers';

// Helper to format Excel date serial numbers to DD.MM.YYYY
const formatExcelDate = (val: any): string => {
    if (!val) return '-';

    // If it's already a string that looks like a date (DD.MM.YYYY or similar), return as is
    if (typeof val === 'string') {
        if (val.includes('.') || val.includes('/') || val.includes('-')) {
            return val;
        }
    }

    // If it's a number (Excel serial date)
    // Excel serial date: days since December 30, 1899
    if (typeof val === 'number' && val > 0 && val < 100000) {
        // Excel date serial number conversion
        const utc_days = Math.floor(val - 25569);
        const utc_value = utc_days * 86400;
        const date = new Date(utc_value * 1000);

        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}.${month}.${year}`;
    }

    // Try parsing as Date string  
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
        const day = String(parsed.getDate()).padStart(2, '0');
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const year = parsed.getFullYear();
        return `${day}.${month}.${year}`;
    }

    return String(val);
};

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'PARSE_EXCEL') {
        const { file, mapping, fileType, fileName, headerRowIndex = 0 } = payload;
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const allRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

            // Get headers from the detected row
            const headers = allRows[headerRowIndex] || [];
            const headerMap: Record<string, number> = {};
            headers.forEach((h: string, idx: number) => {
                headerMap[String(h || '').trim()] = idx;
            });

            // Skip header rows and summary rows
            const summaryKeywords = ['NAKLİ YEKÜN', 'TOPLAM', 'YEKÜN', 'TOPLAMI', 'NAKLI'];
            const dataRows = allRows.slice(headerRowIndex + 1).filter(row => {
                const rowText = row.map((c: any) => String(c || '').toLocaleUpperCase('tr-TR')).join(' ');
                return !summaryKeywords.some(k => rowText.includes(k));
            });

            const processedRows = dataRows.map((row: any[], index) => {
                const getValue = (canonicalKey: string) => {
                    const mappedHeader = mapping[canonicalKey];
                    if (!mappedHeader || mappedHeader === '— YOKTUR —') return null; // Handle "Yoktur" for optional fields
                    const idx = headerMap[mappedHeader];
                    // Safety check for index
                    if (idx === undefined || idx < 0 || idx >= row.length) {
                        return null;
                    }
                    return row[idx];
                };

                const fNo = normalizeString(getValue('Fatura No'));

                if (fileType === 'EINVOICE') {
                    // Filter out rows without invoice number (e.g. summary rows)
                    if (!fNo) return null;

                    return {
                        id: `ei-${index}`,
                        "Kaynak Dosya": fileName,
                        "Fatura Tarihi": formatExcelDate(getValue('Fatura Tarihi')),
                        "Fatura No": fNo,
                        "KDV Tutarı": parseTurkishNumber(getValue('KDV Tutarı')),
                        "GİB Fatura Türü": getValue('GİB Fatura Türü'),
                        "Ödeme Şekli": getValue('Ödeme Şekli'),
                        "Para Birimi": getValue('Para Birimi'),
                        "Döviz Kuru": parseTurkishNumber(getValue('Döviz Kuru')) || 1,
                        "Müşteri": getValue('Müşteri'),
                        "Statü": normalizeString(getValue('Statü')),
                        "Geçerlilik Durumu": normalizeString(getValue('Geçerlilik Durumu')),
                        originalRow: row
                    };
                } else {
                    const directNo = String(getValue('Fatura No') || '');
                    const aciklama = String(getValue('Açıklama') || '');
                    const combinedText = `${directNo} ${aciklama}`;
                    const { first, matches } = extractInvoiceNo(combinedText);
                    const alacakTutari = parseTurkishNumber(getValue('Alacak Tutarı'));

                    // Validation: (Alacak > 0) AND (No valid 16-char invoice) AND (Not a summary/transfer row)
                    const normalizedAciklama = aciklama.toLocaleUpperCase('tr-TR');
                    const isSummaryRow = normalizedAciklama.includes('NAKLİ YEKÜN') ||
                        normalizedAciklama.includes('NAKLI YEKUN') ||
                        normalizedAciklama.includes('DEVİR') ||
                        normalizedAciklama.includes('DEVIR');

                    const validationError = alacakTutari > 0 && !first && !isSummaryRow;

                    return {
                        id: `acc-${index}`,
                        "Kaynak Dosya": fileName,
                        "Tarih": formatExcelDate(getValue('Tarih')),
                        "Ref.No": getValue('Ref.No'),
                        "Fatura No": first || '',
                        "Açıklama": aciklama,
                        "Alacak Tutarı": alacakTutari,
                        originalRow: row,
                        multipleInvoicesFound: matches.length > 1,
                        validationError
                    };
                }
            }).filter(Boolean);

            console.log(`Worker: Processed ${processedRows.length} ${fileType} rows.`);
            if (processedRows.length > 0) console.log('Sample processed row:', processedRows[0]);

            self.postMessage({ type: 'PARSE_SUCCESS', payload: { rows: processedRows, fileType } });
        } catch (error: any) {
            self.postMessage({ type: 'PARSE_ERROR', payload: error.message || 'Unknown error' });
        }
    }

    if (type === 'RECONCILE') {
        const { eInvoices, accountingRows, tolerance = 0.25 } = payload;

        // Aggregation for Accounting
        const accAgg: Record<string, { total: number, rows: any[] }> = {};
        const report4: any[] = []; // Hatalı Muhasebe Kayıtları (Fatura no yok/hatalı)

        console.log(`Worker: Reconciling ${eInvoices.length} E-Invoices and ${accountingRows.length} Accounting rows.`);

        accountingRows.forEach((row: any) => {
            if (row.validationError) {
                report4.push(row);
                return;
            }

            const fNo = row["Fatura No"];
            const amount = row["Alacak Tutarı"];
            if (!fNo) return;
            if (!accAgg[fNo]) accAgg[fNo] = { total: 0, rows: [] };
            accAgg[fNo].total += amount;
            accAgg[fNo].rows.push(row);
        });

        console.log(`Worker: Aggregated ${Object.keys(accAgg).length} unique invoice numbers from accounting.`);

        const report1: any[] = []; // E-Invoice var, Accounting yok
        const report2: any[] = []; // Accounting var, E-Invoice yok
        const report3: any[] = []; // KDV Farkları

        const eiMap = new Map();
        eInvoices.forEach((ei: any) => {
            const fNo = ei["Fatura No"];
            eiMap.set(fNo, ei);
            if (!accAgg[fNo]) {
                report1.push(ei);
            }
        });

        Object.keys(accAgg).forEach(fno => {
            const accData = accAgg[fno];
            const ei = eiMap.get(fno);
            if (!ei) {
                accData.rows.forEach(r => report2.push(r));
            } else {
                const currency = (ei["Para Birimi"] || '').toLocaleUpperCase('tr-TR');
                const isTry = currency.includes('TRY') || currency.includes('TL');
                const kur = ei["Döviz Kuru"] || 1;
                const eiKdvConverted = isTry ? ei["KDV Tutarı"] : (ei["KDV Tutarı"] * kur);

                const diff = Math.abs(eiKdvConverted - accData.total);
                if (diff > tolerance) {
                    report3.push({
                        "Kaynak Dosya": ei["Kaynak Dosya"],
                        "Fatura Tarihi": ei["Fatura Tarihi"],
                        "Fatura No": fno,
                        "Para Birimi": ei["Para Birimi"] || 'TL',
                        "Kur": kur,
                        "Orijinal KDV": ei["KDV Tutarı"],
                        "E-fatura KDV (TL)": eiKdvConverted,
                        "Muhasebe KDV Tutarı": accData.total,
                        "Fark": eiKdvConverted - accData.total
                    });
                }
            }
        });

        self.postMessage({
            type: 'RECONCILE_SUCCESS',
            payload: { report1, report2, report3, report4 }
        });
    }
};
