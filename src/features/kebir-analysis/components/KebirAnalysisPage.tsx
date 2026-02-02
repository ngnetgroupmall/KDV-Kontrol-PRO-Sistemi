import { useState } from 'react';
import { type KebirAnalysisResult, parseKebirFile } from '../utils/kebirParser';
import UploadSection from './UploadSection';
import AnalysisDashboard from './AnalysisDashboard';
import { AlertCircle } from 'lucide-react';

export default function KebirAnalysisPage() {
    const [step, setStep] = useState<'UPLOAD' | 'ANALYSIS'>('UPLOAD');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<KebirAnalysisResult | null>(null);

    const handleFileSelect = async (file: File) => {
        setLoading(true);
        setError(null);
        try {
            const result = await parseKebirFile(file);
            setData(result);
            setStep('ANALYSIS');
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Dosya işlenirken bilinmeyen bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setData(null);
        setStep('UPLOAD');
        setError(null);
    };

    return (
        <div className="space-y-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Kebir Analizi & Ücret Hesaplama</h1>
                <p className="text-slate-400">
                    Firma muhasebe kayıtlarını analiz ederek iş yükü ve işlem yoğunluğunu raporlayın.
                </p>
            </div>

            {loading && (
                <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                    <div className="w-16 h-16 border-4 border-blue-500/30 rounded-full animate-spin mb-4">
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                    </div>
                    <p className="text-lg font-bold text-white animate-pulse">Dosya Analiz Ediliyor...</p>
                    <p className="text-slate-400 text-sm mt-2">Bu işlem dosya boyutuna göre biraz zaman alabilir.</p>
                </div>
            )}

            {!loading && error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center gap-4 text-red-200 animate-in fade-in slide-in-from-top-4">
                    <AlertCircle className="shrink-0" size={24} />
                    <div>
                        <p className="font-bold text-red-100">Hata Oluştu</p>
                        <p>{error}</p>
                    </div>
                    <button
                        onClick={() => setError(null)}
                        className="ml-auto hover:bg-red-500/20 p-2 rounded-lg transition-colors"
                    >
                        Tekrar Dene
                    </button>
                </div>
            )}

            {!loading && !error && step === 'UPLOAD' && (
                <UploadSection onFileSelect={handleFileSelect} />
            )}

            {!loading && !error && step === 'ANALYSIS' && data && (
                <AnalysisDashboard data={data} onReset={handleReset} />
            )}
        </div>
    );
}
