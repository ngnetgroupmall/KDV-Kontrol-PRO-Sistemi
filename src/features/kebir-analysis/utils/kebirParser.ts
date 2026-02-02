import * as XLSX from 'xlsx';

export interface KebirAnalysisResult {
    totalLines: number;
    uniqueAccountCount: number;
    monthlyDensity: { month: number; count: number; volume: number }[];
    topAccounts: { code: string; name: string; count: number; volume: number }[];
    totalDebit: number;
    totalCredit: number;
    complexityScore: number;
    keyAccounts: Record<string, { count: number; volume: number }>;
    debugMeta?: {
        headerRowIndex: number;
        detectedColumns: Record<string, number>;
        successRate: string;
        fileName: string;
        dateMethod?: string;
        sampleDates?: string[];
        parsedDateCount?: number;
    };
}

export const parseKebirFile = async (file: File): Promise<KebirAnalysisResult> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

                if (rows.length < 2) { reject(new Error("Dosya boş.")); return; }

                const norm = (s: any) => String(s).replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase().trim();

                let hdrIdx = -1;
                let cols: Record<string, number> = {};
                let dateMethod = "None";

                // Find header row
                for (let i = 0; i < Math.min(50, rows.length); i++) {
                    const r = rows[i];
                    if (!r) continue;
                    const nr = r.map(norm);

                    const codeIdx = nr.findIndex(c => c === 'hesap kodu' || c.includes('hesap kodu'));
                    const debitIdx = nr.findIndex(c => c.includes('borç') || c.includes('borc'));

                    if (codeIdx >= 0 && debitIdx >= 0) {
                        hdrIdx = i;

                        nr.forEach((cell, idx) => {
                            if (cell.includes('tarih') && cols['date'] === undefined) {
                                cols['date'] = idx;
                                dateMethod = "Header";
                            }
                            if ((cell === 'hesap kodu' || cell.includes('hesap kodu')) && cols['code'] === undefined) {
                                cols['code'] = idx;
                            }
                            if ((cell.includes('hesap adı') || cell === 'açıklama') && cols['name'] === undefined) {
                                cols['name'] = idx;
                            }
                            if ((cell.includes('borç') || cell.includes('borc')) && cols['debit'] === undefined) {
                                cols['debit'] = idx;
                            }
                            if (cell.includes('alacak') && cols['credit'] === undefined) {
                                cols['credit'] = idx;
                            }
                        });
                        break;
                    }
                }

                if (hdrIdx === -1 || cols['code'] === undefined) {
                    reject(new Error("Başlık tespit edilemedi."));
                    return;
                }

                // Statistical date detection fallback
                if (cols['date'] === undefined) {
                    const scores: Record<number, number> = {};
                    for (let r = hdrIdx + 1; r < Math.min(rows.length, hdrIdx + 100); r++) {
                        const row = rows[r];
                        if (!row) continue;
                        row.forEach((val, c) => {
                            if (!val) return;
                            let ok = false;
                            if (val instanceof Date && !isNaN(val.getTime())) ok = true;
                            else {
                                const s = String(val).trim();
                                if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(s)) ok = true;
                            }
                            if (ok) scores[c] = (scores[c] || 0) + 1;
                        });
                    }
                    let best = -1, max = 0;
                    Object.entries(scores).forEach(([c, s]) => { if (s > max) { max = s; best = +c; } });
                    if (best >= 0 && max >= 5) { cols['date'] = best; dateMethod = `Stat(${best},${max})`; }
                }

                // Process Data
                let total = 0, tDebit = 0, tCredit = 0;
                const monthly = Array(12).fill(0).map((_, i) => ({ month: i + 1, count: 0, volume: 0 }));
                const mainAcc: Record<string, { count: number; volume: number; name: string }> = {};
                const subs = new Set<string>();
                const keys: Record<string, { count: number; volume: number }> = {
                    '102': { count: 0, volume: 0 }, '191': { count: 0, volume: 0 },
                    '391': { count: 0, volume: 0 }, '601': { count: 0, volume: 0 }
                };

                // Debug: collect sample dates
                const sampleDates: string[] = [];
                let parsedDateCount = 0;

                for (let i = hdrIdx + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row) continue;
                    const code = String(row[cols['code']] || '').trim();
                    if (!code || code.length < 3 || code.toLowerCase().includes('toplam')) continue;

                    subs.add(code);
                    const d = parseFloat(String(row[cols['debit']] || '0').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
                    const c = parseFloat(String(row[cols['credit']] || '0').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
                    const vol = d + c;
                    total++; tDebit += d; tCredit += c;

                    // Date parsing with detailed debug
                    if (cols['date'] !== undefined) {
                        const v = row[cols['date']];
                        let m = -1;

                        // Collect first 5 date samples for debug
                        if (sampleDates.length < 5 && v !== undefined && v !== null) {
                            sampleDates.push(`[${typeof v}] ${v instanceof Date ? v.toISOString() : String(v)}`);
                        }

                        if (v instanceof Date && !isNaN(v.getTime())) {
                            m = v.getMonth();
                        } else if (v) {
                            const s = String(v).trim();
                            // DD.MM.YYYY format
                            const dm = s.match(/^(\d{1,2})[./-](\d{1,2})[./-]/);
                            if (dm) {
                                m = parseInt(dm[2]) - 1;
                            }
                        }

                        if (m >= 0 && m < 12) {
                            monthly[m].count++;
                            monthly[m].volume += vol;
                            parsedDateCount++;
                        }
                    }

                    const main = code.substring(0, 3);
                    const nm = cols['name'] !== undefined ? String(row[cols['name']] || '') : '';
                    if (!mainAcc[main]) mainAcc[main] = { count: 0, volume: 0, name: nm };
                    mainAcc[main].count++; mainAcc[main].volume += vol;
                    if (!mainAcc[main].name && nm) mainAcc[main].name = nm;

                    if (keys[main]) { keys[main].count++; keys[main].volume += vol; }
                }

                const top = Object.entries(mainAcc)
                    .map(([code, v]) => ({ code, name: v.name, count: v.count, volume: v.volume }))
                    .sort((a, b) => b.count - a.count).slice(0, 50);

                let score = (total / 500) + (subs.size / 20);
                if (score > 10) score = 10;

                resolve({
                    totalLines: total,
                    uniqueAccountCount: subs.size,
                    monthlyDensity: monthly,
                    topAccounts: top,
                    totalDebit: tDebit,
                    totalCredit: tCredit,
                    complexityScore: Math.round(score * 10) / 10,
                    keyAccounts: keys,
                    debugMeta: {
                        headerRowIndex: hdrIdx,
                        detectedColumns: cols,
                        successRate: `${total} satır`,
                        fileName: file.name,
                        dateMethod,
                        sampleDates,
                        parsedDateCount
                    }
                });
            } catch (err) { reject(err); }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};
