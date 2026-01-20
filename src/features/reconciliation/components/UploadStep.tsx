import React, { useState } from 'react';
import { Upload, FileSpreadsheet, X, ChevronRight, FileUp } from 'lucide-react';
import { cn, Button } from '../../../components/common/Button';


interface UploadStepProps {
    type: 'EINVOICE' | 'ACCOUNTING';
    files: File[];
    onFilesChange: (files: File[]) => void;
    onNext: () => void;
    onDemo: () => void;
}

export function UploadStep({ type, files, onFilesChange, onNext, onDemo }: UploadStepProps) {
    const [isDragging, setIsDragging] = useState(false);
    const max = type === 'EINVOICE' ? 5 : 2;

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = Array.from(e.dataTransfer.files)
            .filter(f => f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls'))
            .slice(0, max - files.length);
        if (dropped.length > 0) onFilesChange([...files, ...dropped]);
    };

    const title = type === 'EINVOICE' ? 'E-Fatura Listesini Yükle' : 'Muhasebe Kayıtlarını Yükle';
    const description = type === 'EINVOICE'
        ? 'GİB veya Entegratör portalından indirdiğiniz Excel formatındaki e-fatura listesini buraya yükleyin.'
        : 'Muhasebe programınızdan (Logo, Mikro, Zirve vb.) aldığınız muavin dökümünü (Excel) buraya yükleyin.';

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/10 text-blue-500 mb-4 ring-1 ring-blue-600/20">
                    <FileUp size={32} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
                <p className="text-slate-400 max-w-lg mx-auto">{description}</p>
            </div>

            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => {
                    const input = document.getElementById(`file-upload-${type}`) as HTMLInputElement;
                    if (input) input.click();
                }}
                className={cn(
                    "relative group border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 cursor-pointer overflow-hidden",
                    isDragging
                        ? "border-blue-500 bg-blue-500/10 scale-[1.02]"
                        : "border-slate-700 hover:border-blue-500/40 hover:bg-slate-800/50 bg-slate-900/30"
                )}
            >
                <input
                    type="file"
                    id={`file-upload-${type}`}
                    className="hidden"
                    multiple
                    accept=".xlsx, .xls"
                    onChange={(e) => {
                        const selected = Array.from(e.target.files || [])
                            .filter((f: any) => f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls'))
                            .slice(0, max - files.length);
                        if (selected.length > 0) onFilesChange([...files, ...selected]);
                    }}
                />

                <div className="relative z-10 transition-transform duration-300 group-hover:-translate-y-2">
                    <div className="w-20 h-20 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-xl border border-slate-700 group-hover:border-blue-500/50 group-hover:shadow-[0_0_30px_rgba(37,99,235,0.15)] transition-all">
                        <Upload className="text-slate-400 group-hover:text-blue-400 w-8 h-8 transition-colors" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Dosyaları Buraya Sürükleyin</h3>
                    <p className="text-sm text-slate-500">veya bilgisayarınızdan seçmek için tıklayın</p>
                </div>
            </div>

            {files.length > 0 && (
                <div className="mt-6 space-y-3">
                    {files.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-xl animate-fade-in group hover:border-blue-500/30 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                                    <FileSpreadsheet className="text-emerald-500 w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{f.name}</p>
                                    <p className="text-xs text-slate-500">{(f.size / 1024).toFixed(1)} KB • Hazır</p>
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onFilesChange(files.filter((_, idx) => idx !== i)); }}
                                className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-slate-500 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-8 flex items-center justify-between">
                <Button variant="ghost" onClick={onDemo} size="sm">
                    Örnek Veri Kullan
                </Button>

                <Button
                    disabled={files.length === 0}
                    onClick={onNext}
                    size="lg"
                    rightIcon={<ChevronRight size={18} />}
                    className="px-8"
                >
                    Devam Et
                </Button>
            </div>
        </div>
    );
}
