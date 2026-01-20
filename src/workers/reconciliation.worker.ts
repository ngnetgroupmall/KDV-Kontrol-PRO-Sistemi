import * as XLSX from 'xlsx';
import { normalizeString, parseTurkishNumber, extractInvoiceNo, normalizeVKN } from '../utils/parsers';

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
        const { file, mapping, fileType, fileName, headerRowIndex = 0, mode = 'SALES' } = payload;
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
            const dataRows = allRows.slice(headerRowIndex + 1).filter((row: any[]) => {
                const rowText = row.map((c: any) => String(c || '').toLocaleUpperCase('tr-TR')).join(' ');
                return !summaryKeywords.some(k => rowText.includes(k));
            });

            const processedRows = dataRows.map((row: any[], index) => {
                const getValue = (canonicalKey: string) => {
                    const mappedHeader = mapping[canonicalKey];
                    if (!mappedHeader || mappedHeader === '— YOKTUR —') return null;

                    // Support multi-column summing for values separated by |||
                    if (mappedHeader.includes('|||')) {
                        const columns = mappedHeader.split('|||').filter((c: string) => c && c !== '');
                        let totalSum = 0;
                        let hasValue = false;

                        columns.forEach((colName: string) => {
                            const idx = headerMap[colName.trim()];
                            if (idx !== undefined && idx >= 0 && idx < row.length) {
                                const rawVal = row[idx];
                                const parsed = parseTurkishNumber(rawVal);
                                if (!isNaN(parsed)) {
                                    totalSum += parsed;
                                    hasValue = true;
                                }
                            }
                        });

                        // Only return sum if at least one column had a valid numeric value, otherwise return null (or 0 if preferred, but null keeps consistency)
                        // Actually for KDV, 0 is a valid number.
                        return hasValue ? totalSum : 0;
                    }

                    const idx = headerMap[mappedHeader];
                    if (idx === undefined || idx < 0 || idx >= row.length) {
                        return null;
                    }
                    return row[idx];
                };

                const fNo = normalizeString(getValue('Fatura No'));
                const vkn = normalizeVKN(getValue('VKN'));

                if (fileType === 'EINVOICE') {
                    // Filter out rows without invoice number (e.g. summary rows)
                    if (!fNo) return null;

                    // Specific handling for KDV Tutarı and Matrah which might have come from a multi-sum
                    const rawKdv = getValue('KDV Tutarı');
                    const kdvVal = typeof rawKdv === 'number' ? rawKdv : parseTurkishNumber(rawKdv);

                    const rawMatrah = getValue('Matrah');
                    const matrahVal = typeof rawMatrah === 'number' ? rawMatrah : parseTurkishNumber(rawMatrah);

                    return {
                        id: `ei-${index}`,
                        "Kaynak Dosya": fileName,
                        "Fatura Tarihi": formatExcelDate(getValue('Fatura Tarihi')),
                        "Fatura No": fNo,
                        "VKN": vkn,
                        "Matrah": matrahVal,
                        "KDV Tutarı": kdvVal,
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

                    // Determine which column to read for VAT based on mode
                    const vatAmountKey = mode === 'PURCHASE' ? 'Borç Tutarı' : 'Alacak Tutarı';
                    const alacakTutari = parseTurkishNumber(getValue(vatAmountKey));

                    const rawMatrah = getValue('Matrah');
                    const matrahVal = typeof rawMatrah === 'number' ? rawMatrah : parseTurkishNumber(rawMatrah);

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
                        "VKN": vkn,
                        "Açıklama": aciklama,
                        "Alacak Tutarı": alacakTutari,
                        "Matrah": matrahVal,
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
        const { eInvoices, accountingVATRows, accountingMatrahRows, tolerance = 0.25 } = payload;

        // Aggregation for Accounting
        // Key: InvoiceNo OR InvoiceNo_VKN
        const accAgg: Record<string, { total: number, totalMatrah: number, rows: any[] }> = {};
        const report4: any[] = []; // Hatalı Muhasebe Kayıtları (Fatura no yok/hatalı)

        console.log(`Worker: Reconciling ${eInvoices.length} E-Invoices against ${accountingVATRows.length} VAT rows and ${accountingMatrahRows.length} Matrah rows.`);

        const addToAgg = (row: any, type: 'VAT' | 'MATRAH') => {
            const fNo = row["Fatura No"];
            const vkn = row["VKN"];
            const amount = type === 'VAT' ? row["Alacak Tutarı"] : (row["Matrah"] || 0);

            if (!fNo) return;

            // If VKN is present, use specific key. Otherwise use generic fNo key.
            const key = vkn ? `${fNo}_${vkn}` : fNo;

            if (!accAgg[key]) accAgg[key] = { total: 0, totalMatrah: 0, rows: [] };

            if (type === 'VAT') accAgg[key].total += amount;
            else accAgg[key].totalMatrah += amount;

            accAgg[key].rows.push({ ...row, source: type });
        };

        // Process VAT Rows
        accountingVATRows.forEach((row: any) => {
            if (row.validationError) {
                report4.push(row);
                return;
            }
            addToAgg(row, 'VAT');
        });

        // Process Matrah Rows
        accountingMatrahRows.forEach((row: any) => {
            addToAgg(row, 'MATRAH');
        });

        console.log(`Worker: Aggregated ${Object.keys(accAgg).length} unique invoice keys from accounting.`);

        const report1: any[] = []; // E-Invoice var, Accounting yok
        const report2: any[] = []; // Accounting var, E-Invoice yok
        const report3: any[] = []; // KDV Farkları

        // We need to keep track of matched accounting keys to know which ones are left for Report 2
        const matchedAccKeys = new Set<string>();

        eInvoices.forEach((ei: any) => {
            const fNo = ei["Fatura No"];
            const vkn = ei["VKN"];

            // Try strict match first (with VKN), then fallback to invoice number only
            const strictKey = vkn ? `${fNo}_${vkn}` : fNo;
            const fallbackKey = fNo;

            let matchedKey: string | null = null;
            let accData = null;

            if (accAgg[strictKey]) {
                matchedKey = strictKey;
                accData = accAgg[strictKey];
            } else if (accAgg[fallbackKey]) {
                // Soft Match: Accounting has entry with NO VKN, so we match by number only
                matchedKey = fallbackKey;
                accData = accAgg[fallbackKey];
            }

            if (!matchedKey || !accData) {
                report1.push(ei);
            } else {
                matchedAccKeys.add(matchedKey);

                const currency = (ei["Para Birimi"] || '').toLocaleUpperCase('tr-TR');
                const isTry = currency.includes('TRY') || currency.includes('TL');
                const kur = ei["Döviz Kuru"] || 1;

                const eiKdvConverted = isTry ? ei["KDV Tutarı"] : (ei["KDV Tutarı"] * kur);
                // Matrah is mostly in the same currency as KDV, so apply same conversion
                const eiMatrahConverted = isTry ? ei["Matrah"] : (ei["Matrah"] * kur);

                const diffKdv = Math.abs(eiKdvConverted - accData.total);
                const diffMatrah = Math.abs(eiMatrahConverted - accData.totalMatrah);

                // Report if either KDV or Matrah has diff
                if (diffKdv > tolerance || diffMatrah > tolerance) {
                    report3.push({
                        "Kaynak Dosya": ei["Kaynak Dosya"],
                        "Fatura Tarihi": ei["Fatura Tarihi"],
                        "Fatura No": fNo,
                        "VKN": vkn, // Add VKN to report
                        "Para Birimi": ei["Para Birimi"] || 'TL',
                        "Kur": kur,
                        "E-Fat Matrah": ei["Matrah"], // Display original
                        "E-Fat KDV": ei["KDV Tutarı"], // Display original
                        "Muh. Matrah": accData.totalMatrah,
                        "Muh. KDV": accData.total,
                        "Matrah Farkı": eiMatrahConverted - accData.totalMatrah,
                        "KDV Farkı": eiKdvConverted - accData.total
                    });
                }
            }
        });

        // Any accounting key not matched is Report 2 (Accounting only)
        Object.keys(accAgg).forEach(key => {
            if (!matchedAccKeys.has(key)) {
                accAgg[key].rows.forEach(r => report2.push(r));
            }
        });

        self.postMessage({
            type: 'RECONCILE_SUCCESS',
            payload: { report1, report2, report3, report4 }
        });
    }
};
