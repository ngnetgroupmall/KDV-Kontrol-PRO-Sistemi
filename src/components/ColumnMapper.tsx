import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ArrowRight, Save, Trash2, ArrowLeft, Check } from 'lucide-react';

interface Props {
    file: File;
    canonicalFields: { key: string; label: string; required: boolean }[];
    onComplete: (mapping: Record<string, string>, headerRowIndex: number) => void;
    onCancel: () => void;
}

export default function ColumnMapper({ file, canonicalFields, onComplete, onCancel }: Props) {
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [preview, setPreview] = useState<any[]>([]);
    const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
    const [templateName, setTemplateName] = useState('');
    const [templates, setTemplates] = useState<{ name: string; mapping: Record<string, string> }[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('column_templates');
        if (saved) setTemplates(JSON.parse(saved));
    }, []);

    useEffect(() => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', sheetRows: 20 });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const allRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

            // Detect header row
            let detectedIndex = 0;
            const keywords = ['TARİH', 'AÇIKLAMA', 'FATURA', 'TUTAR', 'ALACAK', 'STATÜ'];
            for (let i = 0; i < Math.min(allRows.length, 10); i++) {
                const row = (allRows[i] || []).map(v => String(v || '').toLocaleUpperCase('tr-TR'));
                if (row.filter(cell => keywords.some(k => cell.includes(k))).length >= 2) {
                    detectedIndex = i;
                    break;
                }
            }

            setHeaderRowIndex(detectedIndex);
            const h = (allRows[detectedIndex] as string[]) || [];
            const cleanHeaders = h.map(val => String(val || '').trim()).filter(val => val !== '');
            setHeaders(cleanHeaders);
            setPreview(allRows.slice(detectedIndex + 1, detectedIndex + 4));

            // Auto-match
            const newMapping: any = {};
            canonicalFields.forEach(field => {
                const normField = field.label.toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
                const match = cleanHeaders.find(header => {
                    const normH = header.toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
                    return normH.includes(normField) || normField.includes(normH);
                });
                if (match) newMapping[field.key] = match;
            });
            setMapping(newMapping);
        };
        reader.readAsArrayBuffer(file);
    }, [file, canonicalFields]);

    const saveAsTemplate = () => {
        const newTemplates = [...templates, { name: templateName, mapping }];
        setTemplates(newTemplates);
        localStorage.setItem('column_templates', JSON.stringify(newTemplates));
        setTemplateName('');
    };

    const deleteTemplate = (name: string) => {
        const newTemplates = templates.filter(t => t.name !== name);
        setTemplates(newTemplates);
        localStorage.setItem('column_templates', JSON.stringify(newTemplates));
    };

    const loadTemplate = (t: any) => {
        setMapping(t.mapping);
    };

    return (
        <div className="flex flex-col gap-8 animate-slide-up">
            <div className="text-center">
                <h3 className="text-3xl font-bold mb-2">Kolon Eşleştirme</h3>
                <p className="text-text-muted italic">Dosyanızdaki başlıkları uygulama alanlarıyla eşleştirin.</p>
                <p className="text-xs text-primary-light font-bold mt-2 uppercase tracking-widest">{file.name}</p>
            </div>

            <div className="glass-card p-8 lg:p-12">
                <div className="flex flex-wrap justify-between items-center gap-6 mb-10 border-b border-white/5 pb-8">
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-bold text-text-muted uppercase tracking-wider">Başlık Satırı:</label>
                        <input
                            type="number"
                            min="1"
                            value={headerRowIndex + 1}
                            onChange={(e) => setHeaderRowIndex(Math.max(0, parseInt(e.target.value) - 1))}
                            className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-bold focus:border-primary-light outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={saveAsTemplate}
                            disabled={!templateName.trim()}
                            className="btn-base btn-secondary text-xs"
                        >
                            <Save size={16} /> Şablon Kaydet
                        </button>
                        <input
                            placeholder="Şablon İsmi..."
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-primary-light outline-none lg:w-48"
                        />
                    </div>
                </div>

                {templates.length > 0 && (
                    <div className="mb-10 p-6 bg-white/[0.02] rounded-xl border border-white/5">
                        <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Kayıtlı Şablonlar</p>
                        <div className="flex flex-wrap gap-3">
                            {templates.map((t, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <button
                                        onClick={() => loadTemplate(t)}
                                        className="btn-base btn-secondary !py-2 !px-4 text-xs hover:!bg-primary/10 hover:!border-primary/30"
                                    >
                                        {t.name}
                                    </button>
                                    <button onClick={() => deleteTemplate(t.name)} className="text-danger p-1 hover:bg-danger/10 rounded-md">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid gap-4">
                    {canonicalFields.map(field => (
                        <div key={field.key} className="glass-card bg-white/[0.02] border-white/5 px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8 group hover:bg-white/[0.04] transition-colors">
                            <div className="lg:w-64">
                                <p className="font-bold text-sm flex items-center gap-2">
                                    {field.label}
                                    {field.required && <span className="text-danger">*</span>}
                                </p>
                                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mt-1">{field.key}</p>
                            </div>

                            <div className="flex-1 flex items-center gap-4">
                                <ArrowRight size={16} className="text-text-muted opacity-30 group-hover:opacity-100 group-hover:text-primary-light transition-all" />
                                <select
                                    value={mapping[field.key] || ''}
                                    onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary-light outline-none appearance-none cursor-pointer"
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px' }}
                                >
                                    <option value="" className="bg-bg-card italic">-- Kolon Seçin --</option>
                                    {headers.map(h => (
                                        <option key={h} value={h} className="bg-bg-card">{h}</option>
                                    ))}
                                    {!field.required && <option value="— YOKTUR —" className="bg-bg-card text-primary-light font-bold text-xs">— YOKTUR —</option>}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap justify-between items-center gap-6">
                    <button onClick={onCancel} className="btn-base btn-secondary px-8">
                        <ArrowLeft size={18} /> Geri Dön
                    </button>

                    <div className="flex items-center gap-8">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Kolon Durumu</p>
                            <p className={`text-sm font-bold ${Object.keys(mapping).length >= canonicalFields.filter(f => f.required).length ? 'text-success' : 'text-warning'}`}>
                                {Object.keys(mapping).length} / {canonicalFields.length} Eşleşti
                            </p>
                        </div>
                        <button
                            disabled={!canonicalFields.every(f => !f.required || mapping[f.key])}
                            onClick={() => onComplete(mapping, headerRowIndex)}
                            className={`btn-base btn-primary px-12 py-4 text-lg ${!canonicalFields.every(f => !f.required || mapping[f.key]) ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                        >
                            Uygula ve Devam Et <Check size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {preview.length > 0 && (
                <div className="glass-card overflow-hidden">
                    <div className="p-6 border-b border-white/5 bg-white/[0.01]">
                        <h4 className="font-bold text-sm uppercase tracking-widest text-text-muted">Veri Önizleme (İlk 3 Satır)</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="saas-table">
                            <thead>
                                <tr>
                                    {headers.map(h => <th key={h}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((row, i) => (
                                    <tr key={i}>
                                        {headers.map(h => <td key={h}>{String(row[h] || '-')}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
