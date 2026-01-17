import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, Link2, ArrowRight, Layers, Save, Trash2, RotateCcw } from 'lucide-react';

interface Props {
    file: File;
    canonicalFields: string[];
    onComplete: (mapping: Record<string, string>, headerRowIndex: number) => void;
    onCancel: () => void;
}

export default function ColumnMapper({ file, canonicalFields, onComplete, onCancel }: Props) {
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const REQUIRED_FIELDS = ['Fatura Tarihi', 'Fatura No', 'KDV Tutarı', 'Tarih', 'Alacak Tutarı'];
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
                    const normCF = cf.toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
                    const match = cleanHeaders.find(header => {
                        const normH = header.toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
                        return normH.includes(normCF) || normCF.includes(normH);
                    });
                    if (match) newMapping[cf] = match;
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
        .filter(f => REQUIRED_FIELDS.includes(f))
        .every(f => !!mapping[f] && mapping[f] !== '— YOKTUR —');

    const mappedCount = canonicalFields.filter(f => !!mapping[f] && mapping[f] !== '— YOKTUR —').length;

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
                        const isMapped = !!mapping[field];
                        return (
                            <div
                                key={field}
                                className={`v-grid-mapper p-5 rounded-2xl border-2 transition-all duration-300 ${isMapped
                                    ? (mapping[field] === '— YOKTUR —' ? 'bg-white/5 border-white/10' : 'bg-success/5 border-success/20 shadow-lg shadow-success/5')
                                    : 'bg-error/5 border-error/30 shadow-xl shadow-error/5 pulse-error'
                                    }`}
                            >
                                {/* Field Name */}
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`font-black text-base uppercase tracking-tight block truncate ${isMapped ? 'text-white/90' : 'v-text-error'}`}>
                                            {field}
                                        </span>
                                        {REQUIRED_FIELDS.includes(field) ? (
                                            <span className="text-[10px] bg-error/20 text-error px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Zorunlu</span>
                                        ) : (
                                            <span className="text-[10px] bg-white/10 text-text-muted px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">İsteğe Bağlı</span>
                                        )}
                                    </div>
                                    {!isMapped && (
                                        <div className="mt-1 v-flex-row gap-2 v-bg-error text-white text-[10px] font-black px-2 py-0.5 rounded-full v-animate-pulse uppercase">
                                            <AlertCircle size={10} strokeWidth={4} /> Sütun Seçilmeli
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="flex justify-center">
                                    <ArrowRight size={24} className={`shrink-0 transition-all ${isMapped ? 'text-success/50' : 'v-text-error scale-110'}`} />
                                </div>

                                {/* Select Input */}
                                <div className="relative group">
                                    <select
                                        className={`w-full bg-bg-main text-text-main border-2 p-4 pr-12 rounded-2xl outline-none transition-all appearance-none cursor-pointer font-bold text-sm shadow-2xl ${isMapped
                                            ? 'border-success/40 focus:border-success hover:border-success/60'
                                            : 'border-error focus:border-error v-text-error bg-error/5 hover:bg-error/10 shadow-error/20'
                                            }`}
                                        value={mapping[field] || ''}
                                        onChange={(e) => {
                                            setMapping({ ...mapping, [field]: e.target.value });
                                            setSaveStatus('idle');
                                        }}
                                    >
                                        <option value="" className="v-text-error font-bold">— LÜTFEN SÜTUN SEÇİN —</option>
                                        {!REQUIRED_FIELDS.includes(field) && (
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
