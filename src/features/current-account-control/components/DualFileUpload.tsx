import { useRef } from 'react';
import { Upload, X } from 'lucide-react';

interface DualFileUploadProps {
    smmmFile: File | null;
    firmaFile: File | null;
    onSmmmFileSelect: (file: File) => void;
    onFirmaFileSelect: (file: File) => void;
    onClearSmmm: () => void;
    onClearFirma: () => void;
}

export default function DualFileUpload({
    smmmFile,
    firmaFile,
    onSmmmFileSelect,
    onFirmaFileSelect,
    onClearSmmm,
    onClearFirma
}: DualFileUploadProps) {
    const smmmInputRef = useRef<HTMLInputElement>(null);
    const firmaInputRef = useRef<HTMLInputElement>(null);

    const handleDrop = (e: React.DragEvent, type: 'smmm' | 'firma') => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            if (type === 'smmm') onSmmmFileSelect(file);
            else onFirmaFileSelect(file);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* SMMM Dosyası */}
            <div
                className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${smmmFile ? 'border-green-500/50 bg-green-500/5' : 'border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/50'
                    }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, 'smmm')}
            >
                {smmmFile ? (
                    <>
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-400">
                            <Upload size={32} />
                        </div>
                        <p className="font-medium text-white text-center mb-1">{smmmFile.name}</p>
                        <p className="text-slate-400 text-sm">{(smmmFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button
                            onClick={onClearSmmm}
                            className="absolute top-4 right-4 p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 text-blue-400">
                            <Upload size={32} />
                        </div>
                        <p className="font-bold text-white text-lg mb-2">SMMM Kebir Dosyası</p>
                        <p className="text-slate-400 text-sm text-center mb-6">
                            Excel dosyasını buraya sürükleyin veya seçin
                        </p>
                        <input
                            type="file"
                            ref={smmmInputRef}
                            className="hidden"
                            accept=".xlsx,.xls"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) onSmmmFileSelect(file);
                            }}
                        />
                        <button
                            onClick={() => smmmInputRef.current?.click()}
                            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                            Dosya Seç
                        </button>
                    </>
                )}
            </div>

            {/* Firma Dosyası */}
            <div
                className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${firmaFile ? 'border-purple-500/50 bg-purple-500/5' : 'border-slate-700 hover:border-purple-500/50 hover:bg-slate-800/50'
                    }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, 'firma')}
            >
                {firmaFile ? (
                    <>
                        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 text-purple-400">
                            <Upload size={32} />
                        </div>
                        <p className="font-medium text-white text-center mb-1">{firmaFile.name}</p>
                        <p className="text-slate-400 text-sm">{(firmaFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button
                            onClick={onClearFirma}
                            className="absolute top-4 right-4 p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4 text-purple-400">
                            <Upload size={32} />
                        </div>
                        <p className="font-bold text-white text-lg mb-2">Firma Kayıtları (Kebir)</p>
                        <p className="text-slate-400 text-sm text-center mb-6">
                            Excel dosyasını buraya sürükleyin veya seçin
                        </p>
                        <input
                            type="file"
                            ref={firmaInputRef}
                            className="hidden"
                            accept=".xlsx,.xls"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) onFirmaFileSelect(file);
                            }}
                        />
                        <button
                            onClick={() => firmaInputRef.current?.click()}
                            className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                        >
                            Dosya Seç
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
