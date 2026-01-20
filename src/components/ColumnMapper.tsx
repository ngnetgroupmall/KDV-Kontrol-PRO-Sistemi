import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, Link2, ArrowRight, Layers, Save, Trash2, RotateCcw } from 'lucide-react';

interface Props {
    file: File;
    canonicalFields: { key: string; label: string; required: boolean }[];
    onComplete: (mapping: Record<string, string | string[]>, headerRowIndex: number) => void;
    onCancel: () => void;
}

export default function ColumnMapper({ file, canonicalFields, onComplete, onCancel }: Props) {
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string | string[]>>({});
    const [preview, setPreview] = useState<any[]>([]);
    const [detectedHeaderRow, setDetectedHeaderRow] = useState<number>(0);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'cleared'>('idle');

    // Create a unique fingerprint for the excel file based on its headers
    const getFingerprint = (h: string[]) => {
        return h.slice().sort().join('|');
    };

    useEffect(() => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', sheetRows: 50 });
            const firstSheetName = workbook.SheetNames[0];
            const firstSheet = workbook.Sheets[firstSheetName];
            const allRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

            // Intelligent Header Search
            let headerRowIndex = 0;
            const keywords = ['TARİH', 'AÇIKLAMA', 'FATURA', 'ALACAK', 'BORÇ', 'MÜŞTERİ', 'STATÜ', 'REF.NO'];

            for (let i = 0; i < Math.min(allRows.length, 20); i++) {
                const row = (allRows[i] || []).map(v => String(v || '').toLocaleUpperCase('tr-TR'));
                const matches = row.filter(cell => keywords.some(k => cell.includes(k))).length;
                if (matches >= 2) {
                    headerRowIndex = i;
                    break;
                }
            }

            const h = (allRows[headerRowIndex] as string[]) || [];
            const cleanHeaders = h.map(val => String(val || '').trim()).filter(val => val !== '');
            setHeaders(cleanHeaders);
            setPreview(allRows.slice(headerRowIndex + 1, headerRowIndex + 6));
            setDetectedHeaderRow(headerRowIndex);

            // 1. Try to load from saved templates
            const fingerprint = getFingerprint(cleanHeaders);
            const savedMappings = JSON.parse(localStorage.getItem('mapping_templates') || '{}');

            if (savedMappings[fingerprint]) {
                setMapping(savedMappings[fingerprint]);
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 3000);
            } else {
                // 2. Fallback to auto-match
                const newMapping: any = {};
                canonicalFields.forEach(cf => {
                    const normCF = cf.label.toLocaleLowerCase('tr-TR').replace(/\s+/g, '');

                    // First try exact fuzzy match
                    let match = cleanHeaders.find(header => {
                        const normH = header.toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
                        return normH.includes(normCF) || normCF.includes(normH);
                    });

                    // Special logic for KDV if no single match found
                    if (!match && cf.key === 'KDV Tutarı') {
                        // Find all columns starting with "KDV" (case insensitive)
                        const kdvMatches = cleanHeaders.filter(header => {
                            const normH = header.toLocaleLowerCase('tr-TR');
                            return normH.includes('kdv') && (normH.includes('%') || normH.includes('oran'));
                        });

                        if (kdvMatches.length > 0) {
                            newMapping[cf.key] = kdvMatches.join('|||');
                            return; // Skip standard assignment
                        }
                    }

                    if (match) newMapping[cf.key] = match;
                });
                setMapping(newMapping);
            }
        };
        reader.readAsArrayBuffer(file);
    }, [file, canonicalFields]);

    const saveMapping = () => {
        const fingerprint = getFingerprint(headers);
        const savedMappings = JSON.parse(localStorage.getItem('mapping_templates') || '{}');
        savedMappings[fingerprint] = mapping;
        localStorage.setItem('mapping_templates', JSON.stringify(savedMappings));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const clearMemory = () => {
        if (window.confirm('Tüm kayıtlı eşleştirme şablonlarını silmek istediğinize emin misiniz?')) {
            localStorage.removeItem('mapping_templates');
            setSaveStatus('cleared');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }
    };

    const allRequiredMapped = canonicalFields
        .filter(f => f.required)
        .every(f => !!mapping[f.key] && mapping[f.key] !== '— YOKTUR —');

    const mappedCount = canonicalFields.filter(f => !!mapping[f.key] && mapping[f.key] !== '— YOKTUR —').length;

    return (
        <div className="wizard-step">
            <div className="card glass">
                {/* Header */}
                <div className="v-flex-between mb-8 pb-6 border-b border-white/10">
                    <div className="v-flex-row gap-4">
                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                            <Link2 className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold">Sütun Eşleştirme</h3>
                            <p className="text-text-muted">Dosya: <span className="text-accent font-medium">{file.name}</span></p>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                        <div className="flex items-center gap-3">
                            <p className="text-3xl font-black text-primary leading-none">{mappedCount}/{canonicalFields.length}</p>
                            <div className="flex flex-col items-start leading-none opacity-50">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Alan</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Eşleşti</span>
                            </div>
                        </div>
                        {saveStatus === 'saved' && (
                            <div className="flex items-center gap-2 bg-success/20 text-success px-3 py-1 rounded-full border border-success/30 animate-pulse">
                                <div className="w-1.5 h-1.5 bg-success rounded-full animate-ping"></div>
                                <span className="text-[10px] font-black tracking-widest uppercase italic text-nowrap">Hafızadan Yüklendi</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mapping Grid */}
                <div className="grid gap-3 mb-8">
                    {canonicalFields.map(field => {
                        const isKDV = field.key === 'KDV Tutarı';
                        // Check if current mapping for this field is an array (multi-column mode)
                        const isMultiMode = Array.isArray(mapping[field.key]);
                        const isMapped = !!mapping[field.key] && (Array.isArray(mapping[field.key]) ? (mapping[field.key] as string[]).length > 0 : true);

                        return (
                            <div
                                key={field.key}
                                className={`v-grid-mapper p-5 rounded-2xl border-2 transition-all duration-300 ${isMapped
                                    ? (mapping[field.key] === '— YOKTUR —' ? 'bg-white/5 border-white/10' : 'bg-success/5 border-success/20 shadow-lg shadow-success/5')
                                    : 'bg-error/5 border-error/30 shadow-xl shadow-error/5 pulse-error'
                                    }`}
                            >
                                {/* Field Name */}
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`font-black text-base uppercase tracking-tight block truncate ${isMapped ? 'text-white/90' : 'v-text-error'}`}>
                                            {field.label}
                                        </span>
                                        {field.required ? (
                                            <span className="text-[10px] bg-error/20 text-error px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Zorunlu</span>
                                        ) : (
                                            <span className="text-[10px] bg-white/10 text-text-muted px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">İsteğe Bağlı</span>
                                        )}
                                    </div>
                                    {!isMapped && (
                                        <div className="mt-1 v-flex-row gap-2 v-bg-error text-white text-[10px] font-black px-2 py-0.5 rounded-full v-animate-pulse uppercase">
                                            <AlertCircle size={10} strokeWidth={4} /> {isMultiMode ? 'En Az Bir Sütun Seçilmeli' : 'Sütun Seçilmeli'}
                                        </div>
                                    )}

                                    {/* Multi-Column Toggle for KDV */}
                                    {isKDV && (
                                        <div className="mt-3">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={isMultiMode}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setMapping({ ...mapping, [field.key]: [] });
                                                        } else {
                                                            setMapping({ ...mapping, [field.key]: '' });
                                                        }
                                                        setSaveStatus('idle');
                                                    }}
                                                />
                                                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 relative"></div>
                                                <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">
                                                    Çoklu KDV Sütunu (%1, %10, %20...)
                                                </span>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="flex justify-center">
                                    <ArrowRight size={24} className={`shrink-0 transition-all ${isMapped ? 'text-success/50' : 'v-text-error scale-110'}`} />
                                </div>

                                {/* Input Area */}
                                <div className="relative group">
                                    {isMultiMode ? (
                                        // Multi-Select UI
                                        <div className={`w-full bg-bg-main text-text-main border-2 p-3 rounded-2xl outline-none transition-all max-h-48 overflow-y-auto ${isMapped
                                            ? 'border-success/40'
                                            : 'border-error bg-error/5 shadow-error/20'
                                            }`}>
                                            <p className="text-xs font-bold text-slate-400 mb-2 sticky top-0 bg-bg-main pb-2 border-b border-white/10 z-10">
                                                Toplam KDV'yi oluşturacak sütunları seçin:
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {headers.map(h => {
                                                    const selected = (mapping[field.key] as string[]).includes(h);
                                                    return (
                                                        <label key={h} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all ${selected ? 'bg-blue-500/20 border-blue-500/50' : 'hover:bg-white/5 border-transparent'}`}>
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500 bg-slate-700"
                                                                checked={selected}
                                                                onChange={(e) => {
                                                                    const current = (mapping[field.key] as string[]) || [];
                                                                    let updated;
                                                                    if (e.target.checked) {
                                                                        updated = [...current, h];
                                                                    } else {
                                                                        updated = current.filter(x => x !== h);
                                                                    }
                                                                    setMapping({ ...mapping, [field.key]: updated });
                                                                    setSaveStatus('idle');
                                                                }}
                                                            />
                                                            <span className={`text-xs font-bold truncate ${selected ? 'text-blue-400' : 'text-slate-400'}`}>{h}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        // Standard Single Select UI
                                        <>
                                            <select
                                                className={`w-full bg-bg-main text-text-main border-2 p-4 pr-12 rounded-2xl outline-none transition-all appearance-none cursor-pointer font-bold text-sm shadow-2xl ${isMapped
                                                    ? 'border-success/40 focus:border-success hover:border-success/60'
                                                    : 'border-error focus:border-error v-text-error bg-error/5 hover:bg-error/10 shadow-error/20'
                                                    }`}
                                                value={(mapping[field.key] as string) || ''}
                                                onChange={(e) => {
                                                    setMapping({ ...mapping, [field.key]: e.target.value });
                                                    setSaveStatus('idle');
                                                }}
                                            >
                                                <option value="" className="v-text-error font-bold">— LÜTFEN SÜTUN SEÇİN —</option>
                                                {!field.required && (
                                                    <option value="— YOKTUR —" className="bg-bg-card text-accent font-bold">— YOKTUR —</option>
                                                )}
                                                {headers.map(h => <option key={h} value={h} className="bg-bg-card text-text-main">{h}</option>)}
                                            </select>
                                            <div className={`absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none transition-all group-hover:scale-125 ${isMapped ? 'text-success' : 'v-text-error v-animate-bounce'}`}>
                                                <Layers size={20} />
                                            </div>

                                            {!isMapped && (
                                                <div className="absolute -top-1 -right-1 w-3 h-3 v-bg-error rounded-full animate-ping pointer-events-none"></div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Preview */}
                <div className="mb-8">
                    <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-white/50">
                        📋 Veri Önizleme <span className="text-text-muted font-normal text-sm">(İlk 5 satır)</span>
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-bg-main">
                                    {headers.slice(0, 8).map(h => (
                                        <th key={h} className="p-3 text-left font-bold text-text-muted uppercase tracking-wide border-b border-white/5">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((row, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                        {headers.slice(0, 8).map((_, j) => (
                                            <td key={j} className="p-3 border-b border-white/5 font-medium opacity-80">{row[j] || '-'}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Actions */}
                <div className="v-flex-between pt-12 border-t border-white/10 mt-8">
                    {/* Left side: Persistence Tools */}
                    <div className="v-flex-gap-4">
                        <button
                            onClick={saveMapping}
                            disabled={!allRequiredMapped}
                            className="v-btn-save group"
                            title="Bu dosya formatı için eşleştirmeleri hafızaya kaydet"
                        >
                            <Save size={18} className="transition-transform group-hover:scale-110" />
                            <span>{saveStatus === 'saved' ? 'KAYDEDİLDİ' : 'Hafızaya Kaydet'}</span>
                        </button>

                        <button
                            onClick={clearMemory}
                            className="v-btn-delete group"
                            title="Tüm kayıtlı eşleştirme hafızasını temizle"
                        >
                            <Trash2 size={16} className="opacity-50 transition-all group-hover:opacity-100 group-hover:rotate-12" />
                            <span>{saveStatus === 'cleared' ? 'TEMİZLENDİ' : 'Hafızayı Sil'}</span>
                        </button>
                    </div>

                    {/* Right side: Navigation */}
                    <div className="v-flex-end">
                        <button
                            onClick={onCancel}
                            className="v-btn-back"
                        >
                            <RotateCcw size={18} /> Geri Dön
                        </button>

                        <button
                            disabled={!allRequiredMapped}
                            onClick={() => onComplete(mapping, detectedHeaderRow)}
                            className="v-btn-next group"
                        >
                            <span>Tamamla ve Devam Et</span>
                            <ArrowRight size={26} strokeWidth={4} className="transition-transform group-hover:translate-x-2" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
