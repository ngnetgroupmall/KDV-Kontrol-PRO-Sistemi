import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface UploadSectionProps {
    onFileSelect: (file: File) => void;
}

export default function UploadSection({ onFileSelect }: UploadSectionProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSelect(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSelect(e.target.files[0]);
        }
    };

    const validateAndSelect = (file: File) => {
        if (!file.name.match(/\.(xlsx|xls)$/)) {
            alert("Lütfen geçerli bir Excel dosyası yükleyin (.xlsx veya .xls)");
            return;
        }
        onFileSelect(file);
    };

    return (
        <div className="w-full max-w-2xl mx-auto animate-fade-in">
            <div
                className={`
                    border-3 border-dashed rounded-3xl p-12 text-center transition-all duration-300 cursor-pointer
                    ${isDragging
                        ? 'border-blue-500 bg-blue-500/10 scale-105'
                        : 'border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/50'
                    }
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                    <Upload className={`w-10 h-10 ${isDragging ? 'text-blue-400' : 'text-slate-400'}`} />
                </div>

                <h3 className="text-2xl font-bold text-white mb-3">
                    Kebir Dosyasını Yükle
                </h3>
                <p className="text-slate-400 mb-8 max-w-md mx-auto">
                    Excel formatındaki (.xlsx) Kebir dosyanızı buraya sürükleyin veya seçmek için tıklayın.
                </p>

                <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25">
                    Dosya Seç
                </button>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".xlsx,.xls"
                    onChange={handleFileInput}
                />
            </div>

            <div className="mt-8 bg-blue-900/20 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                <FileSpreadsheet className="text-blue-400 shrink-0 mt-1" size={20} />
                <div className="text-sm">
                    <p className="text-blue-200 font-bold mb-1">Dosya Formatı Nasıl Olmalı?</p>
                    <p className="text-blue-200/60">
                        Dosyanızda 'Hesap Kodu', 'Borç' ve 'Alacak' sütunları mutlaka bulunmalıdır.
                        Sistem otomatik olarak başlık satırını tespit etmeye çalışacaktır.
                    </p>
                </div>
            </div>
        </div>
    );
}
