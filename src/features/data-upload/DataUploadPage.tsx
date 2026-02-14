import { useRef, useState, type ChangeEvent } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Layers, RefreshCcw, Upload } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { parseKebirFile } from '../kebir-analysis/utils/kebirParser';

const EXCEL_ACCEPT = '.xlsx,.xls';

const isExcelFile = (file: File): boolean => /\.(xlsx|xls)$/i.test(file.name);

const toExcelFiles = (fileList: FileList | null): File[] => {
    if (!fileList) return [];
    return Array.from(fileList).filter(isExcelFile);
};

interface UploadPanelProps {
    title: string;
    description: string;
    files: File[];
    multiple?: boolean;
    onSelect: (files: File[]) => void;
}

function UploadPanel({
    title,
    description,
    files,
    multiple = false,
    onSelect,
}: UploadPanelProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const pickedFiles = toExcelFiles(event.target.files);
        onSelect(multiple ? pickedFiles : pickedFiles.slice(0, 1));
        event.target.value = '';
    };

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-3">
            <div>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="text-xs text-slate-400 mt-1">{description}</p>
            </div>

            <Button
                variant="secondary"
                size="sm"
                leftIcon={<Upload size={14} />}
                onClick={() => inputRef.current?.click()}
            >
                {multiple ? 'Dosyalari sec' : 'Dosya sec'}
            </Button>

            <input
                ref={inputRef}
                type="file"
                accept={EXCEL_ACCEPT}
                multiple={multiple}
                className="hidden"
                onChange={handleChange}
            />

            <div className="space-y-1">
                {files.length === 0 && (
                    <p className="text-xs text-slate-500">Yuklenen dosya yok.</p>
                )}
                {files.map((file) => (
                    <div
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="text-xs text-slate-200 bg-slate-800/70 border border-slate-700 rounded px-2 py-1 truncate"
                        title={file.name}
                    >
                        {file.name}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function DataUploadPage() {
    const {
        activeCompany,
        activeUploads,
        setActiveUploads,
        clearActiveUploads,
        patchActiveCompany,
    } = useCompany();
    const [kebirError, setKebirError] = useState<string | null>(null);
    const [kebirLoading, setKebirLoading] = useState(false);

    const setReconciliationFiles = (
        key: 'eInvoiceFiles' | 'accountingFiles' | 'accountingMatrahFiles',
        files: File[]
    ) => {
        setActiveUploads((current) => ({
            ...current,
            reconciliation: {
                ...current.reconciliation,
                [key]: files,
            },
        }));
    };

    const setCurrentAccountFile = (key: 'smmmFile' | 'firmaFile', file: File | null) => {
        setActiveUploads((current) => ({
            ...current,
            currentAccount: {
                ...current.currentAccount,
                [key]: file,
            },
        }));
    };

    const handleKebirUpload = async (file: File | null) => {
        setKebirError(null);

        setActiveUploads((current) => ({
            ...current,
            kebirFile: file,
        }));

        if (!file) {
            await patchActiveCompany(() => ({ kebirAnalysis: undefined }));
            return;
        }

        setKebirLoading(true);
        try {
            const result = await parseKebirFile(file);
            await patchActiveCompany(() => ({
                kebirAnalysis: result,
            }));
        } catch (error) {
            console.error('Kebir parse error:', error);
            setKebirError(error instanceof Error ? error.message : 'Kebir dosyasi islenemedi.');
        } finally {
            setKebirLoading(false);
        }
    };

    const resetCompanyData = async () => {
        clearActiveUploads();
        setKebirError(null);
        await patchActiveCompany(() => ({
            reconciliation: undefined,
            currentAccount: undefined,
            kebirAnalysis: undefined,
        }));
    };

    if (!activeCompany) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Layers className="text-slate-600 w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Firma secimi gerekli</h2>
                <p className="text-slate-400 max-w-md">
                    Veri yuklemek icin lutfen once bir firma secin.
                </p>
            </div>
        );
    }

    const smmmFiles = activeUploads.currentAccount.smmmFile ? [activeUploads.currentAccount.smmmFile] : [];
    const firmaFiles = activeUploads.currentAccount.firmaFile ? [activeUploads.currentAccount.firmaFile] : [];
    const kebirFiles = activeUploads.kebirFile ? [activeUploads.kebirFile] : [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Veri Yukleme Merkezi</h1>
                    <p className="text-slate-400 text-sm">
                        Bu ekrana yuklenen dosyalar firma bazli olarak tum modullerde kullanilir.
                    </p>
                    <p className="text-xs text-blue-300 mt-1">{activeCompany.name}</p>
                </div>

                <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<RefreshCcw size={14} />}
                    onClick={() => {
                        if (window.confirm('Firma verilerini sifirlamak istiyor musunuz?')) {
                            void resetCompanyData();
                        }
                    }}
                >
                    Firma verilerini sifirla
                </Button>
            </div>

            <Card className="space-y-4">
                <div className="flex items-center gap-2">
                    <FileSpreadsheet size={18} className="text-blue-400" />
                    <h2 className="text-lg font-semibold text-white">KDV Mutabakat dosyalari</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <UploadPanel
                        title="E-Fatura listeleri"
                        description="Satis/alis kontrolu icin e-fatura listelerini secin."
                        files={activeUploads.reconciliation.eInvoiceFiles}
                        multiple
                        onSelect={(files) => setReconciliationFiles('eInvoiceFiles', files)}
                    />
                    <UploadPanel
                        title="Muhasebe KDV"
                        description="191/391 tarafindaki muhasebe KDV dosyalarini secin."
                        files={activeUploads.reconciliation.accountingFiles}
                        multiple
                        onSelect={(files) => setReconciliationFiles('accountingFiles', files)}
                    />
                    <UploadPanel
                        title="Muhasebe Matrah"
                        description="Satis modulu icin matrah dosyalarini secin."
                        files={activeUploads.reconciliation.accountingMatrahFiles}
                        multiple
                        onSelect={(files) => setReconciliationFiles('accountingMatrahFiles', files)}
                    />
                </div>
            </Card>

            <Card className="space-y-4">
                <div className="flex items-center gap-2">
                    <Layers size={18} className="text-indigo-400" />
                    <h2 className="text-lg font-semibold text-white">Cari Hesap Kontrol dosyalari</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <UploadPanel
                        title="SMMM Kebir dosyasi"
                        description="SMMM tarafindan gelen tek dosya secilir."
                        files={smmmFiles}
                        onSelect={(files) => setCurrentAccountFile('smmmFile', files[0] || null)}
                    />
                    <UploadPanel
                        title="Firma Kebir dosyasi"
                        description="Firma tarafindan gelen tek dosya secilir."
                        files={firmaFiles}
                        onSelect={(files) => setCurrentAccountFile('firmaFile', files[0] || null)}
                    />
                </div>
            </Card>

            <Card className="space-y-4">
                <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    <h2 className="text-lg font-semibold text-white">Kebir Analiz dosyasi</h2>
                </div>
                <UploadPanel
                    title="Kebir dosyasi"
                    description="Dosya yuklendiginde analiz otomatik calistirilir ve kaydedilir."
                    files={kebirFiles}
                    onSelect={(files) => {
                        void handleKebirUpload(files[0] || null);
                    }}
                />

                {kebirLoading && (
                    <p className="text-sm text-blue-300">Kebir dosyasi analiz ediliyor...</p>
                )}

                {!kebirLoading && activeCompany.kebirAnalysis && (
                    <p className="text-sm text-emerald-300">
                        Kebir analizi hazir. Kebir Analizi modulu dogrudan bu veriyi kullanacak.
                    </p>
                )}

                {kebirError && (
                    <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <p>{kebirError}</p>
                    </div>
                )}
            </Card>
        </div>
    );
}
