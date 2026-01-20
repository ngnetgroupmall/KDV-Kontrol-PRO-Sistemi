import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, Link2, ArrowRight, Layers, Save, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { cn } from '../../../components/common/Button';

interface MappingStepProps {
    file: File;
    canonicalFields: { key: string; label: string; required: boolean }[];
    onComplete: (mapping: Record<string, string>, headerRowIndex: number) => void;
    onCancel: () => void;
}

export function MappingStep({ file, canonicalFields, onComplete, onCancel }: MappingStepProps) {
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
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
            const keywords = ['TARİH', 'AÇIKLAMA', 'FATURA', 'ALACAK', 'BORÇ', 'MÜŞTERİ', 'STATÜ', 'REF.NO', 'KDV'];

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
        <div className="animate-fade-in space-y-6">
            <Card className="p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                            <Link2 className="w-7 h-7 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white">Sütun Eşleştirme</h3>
                            <p className="text-slate-400">Dosya: <span className="text-blue-400 font-medium">{file.name}</span></p>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                        <div className="flex items-center gap-3">
                            <p className="text-3xl font-black text-blue-500 leading-none">{mappedCount}/{canonicalFields.length}</p>
                            <div className="flex flex-col items-start leading-none opacity-50">
                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Alan</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Eşleşti</span>
                            </div>
                        </div>
                        {saveStatus === 'saved' && (
                            <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-500 px-3 py-1 rounded-full border border-emerald-500/30 animate-pulse">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                                <span className="text-[10px] font-black tracking-widest uppercase italic whitespace-nowrap">Hafızadan Yüklendi</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mapping Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mb-8">
                    {canonicalFields.map(field => {
                        const isMultiColumn = field.key === 'KDV Tutarı';
                        const currentVal = mapping[field.key] || '';
                        const selectedCols = isMultiColumn && currentVal.includes('|||')
                            ? currentVal.split('|||')
                            : [currentVal];

                        // Determine if mapped
                        const isMapped = selectedCols.some(c => !!c && c !== '') && selectedCols[0] !== '— YOKTUR —';

                        const handleMultiChange = (index: number, val: string) => {
                            const newCols = [...selectedCols];
                            newCols[index] = val;
                            const newVal = newCols.join('|||');
                            setMapping({ ...mapping, [field.key]: newVal });
                            setSaveStatus('idle');
                        };

                        const addColumn = () => {
                            const newCols = [...selectedCols, ''];
                            setMapping({ ...mapping, [field.key]: newCols.join('|||') });
                        };

                        const removeColumn = (index: number) => {
                            const newCols = selectedCols.filter((_, i) => i !== index);
                            setMapping({ ...mapping, [field.key]: newCols.length ? newCols.join('|||') : '' });
                        };

                        return (
                            <div
                                key={field.key}
                                className={cn(
                                    "p-5 rounded-xl border-2 transition-all duration-300",
                                    isMapped
                                        ? (mapping[field.key] === '— YOKTUR —' ? 'bg-slate-800/30 border-slate-700' : 'bg-blue-500/5 border-blue-500/30 shadow-lg shadow-blue-500/5')
                                        : 'bg-red-500/5 border-red-500/20 shadow-xl shadow-red-500/5'
                                )}
                            >
                                {/* Field Name */}
                                <div className="min-w-0 mb-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={cn(
                                            "font-bold text-base uppercase tracking-tight block truncate",
                                            isMapped ? 'text-slate-200' : 'text-red-400'
                                        )}>
                                            {field.label}
                                        </span>
                                        {field.required ? (
                                            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Zorunlu</span>
                                        ) : (
                                            <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">İsteğe Bağlı</span>
                                        )}
                                    </div>
                                    {!isMapped && (
                                        <div className="mt-2 flex items-center gap-2 text-red-400 text-xs font-bold animate-pulse">
                                            <AlertCircle size={12} strokeWidth={3} /> Lütfen bir sütun seçin
                                        </div>
                                    )}
                                    {isMultiColumn && (
                                        <div className="mt-2 text-right">
                                            <button
                                                onClick={addColumn}
                                                className="text-[10px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-2 py-1 rounded border border-blue-500/20 flex items-center gap-1 transition-colors ml-auto"
                                            >
                                                <Layers size={10} /> + Çoklu KDV Sütunu Ekle
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Input Area */}
                                <div className="space-y-2">
                                    {selectedCols.map((colVal, colIndex) => (
                                        <div key={colIndex} className="relative group flex items-center gap-2">
                                            <div className="relative w-full">
                                                <select
                                                    className={cn(
                                                        "w-full bg-slate-900 text-white border-2 p-3 pr-10 rounded-xl outline-none transition-all appearance-none cursor-pointer font-medium text-sm shadow-sm",
                                                        !!colVal && colVal !== ''
                                                            ? 'border-blue-500/40 focus:border-blue-500 hover:border-blue-500/60'
                                                            : 'border-red-500/40 focus:border-red-500 hover:border-red-500/60'
                                                    )}
                                                    value={colVal || ''}
                                                    onChange={(e) => {
                                                        if (isMultiColumn) {
                                                            handleMultiChange(colIndex, e.target.value);
                                                        } else {
                                                            setMapping({ ...mapping, [field.key]: e.target.value });
                                                            setSaveStatus('idle');
                                                        }
                                                    }}
                                                >
                                                    <option value="" className="text-slate-500">— LÜTFEN SÜTUN SEÇİN —</option>
                                                    {!field.required && colIndex === 0 && (
                                                        <option value="— YOKTUR —" className="text-slate-400 font-bold">— YOKTUR —</option>
                                                    )}
                                                    {headers.map(h => <option key={h} value={h} className="text-slate-200">{h}</option>)}
                                                </select>
                                                <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-all ${!!colVal && colVal !== '' ? 'text-blue-500' : 'text-slate-600'}`}>
                                                    <Layers size={16} />
                                                </div>
                                            </div>

                                            {isMultiColumn && selectedCols.length > 1 && (
                                                <button
                                                    onClick={() => removeColumn(colIndex)}
                                                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors shrink-0"
                                                    title="Bu sütunu kaldır"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Preview */}
                <div className="mb-8">
                    <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-400">
                        📋 Veri Önizleme <span className="text-slate-500 font-normal text-sm">(İlk 5 satır)</span>
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/50">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-slate-800">
                                    {headers.slice(0, 8).map(h => (
                                        <th key={h} className="p-3 text-left font-bold text-slate-400 uppercase tracking-wide border-b border-slate-700">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((row, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                        {headers.slice(0, 8).map((_, j) => (
                                            <td key={j} className="p-3 border-b border-slate-800 font-medium text-slate-300">{row[j] || '-'}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-8 border-t border-slate-800 mt-8">
                    {/* Left side: Persistence Tools */}
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            onClick={saveMapping}
                            disabled={!allRequiredMapped}
                            leftIcon={<Save size={18} />}
                            title="Bu dosya formatı için eşleştirmeleri hafızaya kaydet"
                            size="sm"
                        >
                            {saveStatus === 'saved' ? 'KAYDEDİLDİ' : 'Hafızaya Kaydet'}
                        </Button>

                        <button
                            onClick={clearMemory}
                            className="text-xs font-bold text-slate-600 hover:text-red-400 transition-colors flex items-center gap-1 px-3"
                            title="Tüm kayıtlı eşleştirme hafızasını temizle"
                        >
                            <Trash2 size={14} /> Hafızayı Sil
                        </button>
                    </div>

                    {/* Right side: Navigation */}
                    <div className="flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={onCancel}
                            leftIcon={<RotateCcw size={18} />}
                        >
                            Geri Dön
                        </Button>

                        <Button
                            variant="primary"
                            disabled={!allRequiredMapped}
                            onClick={() => onComplete(mapping, detectedHeaderRow)}
                            rightIcon={<ArrowRight size={20} />}
                        >
                            Tamamla ve Devam Et
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
