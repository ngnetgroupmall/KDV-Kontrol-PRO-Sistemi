import { useEffect, useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import type { AccountDetail, MappingConfig } from '../common/types';
import type { ComparisonResult, TransactionReviewMap } from './utils/types';
import DualFileUpload from './components/DualFileUpload';
import ColumnMapper from './components/ColumnMapper';
import ComparisonView from './components/ComparisonView';
import { runComparison } from './utils/matchingService';

export default function CurrentAccountControlPage() {
    const { activeCompany, updateCompany } = useCompany();

    const [smmmFile, setSmmmFile] = useState<File | null>(null);
    const [firmaFile, setFirmaFile] = useState<File | null>(null);
    const [mappingMode, setMappingMode] = useState<'NONE' | 'SMMM' | 'FIRMA'>('NONE');
    const [isProcessing, setIsProcessing] = useState(false);

    const [localSmmmData, setLocalSmmmData] = useState<AccountDetail[]>([]);
    const [localFirmaData, setLocalFirmaData] = useState<AccountDetail[]>([]);
    const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
    const [manualMatches, setManualMatches] = useState<Record<string, string>>({});
    const [rowReviews, setRowReviews] = useState<TransactionReviewMap>({});

    useEffect(() => {
        setSmmmFile(null);
        setFirmaFile(null);
        setMappingMode('NONE');
        setComparisonResults([]);

        if (activeCompany?.currentAccount) {
            setLocalSmmmData(activeCompany.currentAccount.smmmData || []);
            setLocalFirmaData(activeCompany.currentAccount.firmaData || []);
            setManualMatches(activeCompany.currentAccount.manualMatches || {});
            setRowReviews(activeCompany.currentAccount.rowReviews || {});
        } else {
            setLocalSmmmData([]);
            setLocalFirmaData([]);
            setManualMatches({});
            setRowReviews({});
        }
    }, [activeCompany?.id]);

    const smmmData = useMemo(
        () => (localSmmmData.length > 0 ? localSmmmData : activeCompany?.currentAccount?.smmmData || []),
        [localSmmmData, activeCompany?.currentAccount?.smmmData]
    );

    const firmaData = useMemo(
        () => (localFirmaData.length > 0 ? localFirmaData : activeCompany?.currentAccount?.firmaData || []),
        [localFirmaData, activeCompany?.currentAccount?.firmaData]
    );

    const hasSmmm = smmmData.length > 0;
    const hasFirma = firmaData.length > 0;

    const persistManualMatches = async (nextManualMatches: Record<string, string>) => {
        if (!activeCompany) return;

        const currentData = activeCompany.currentAccount || {
            smmmData: [] as AccountDetail[],
            firmaData: [] as AccountDetail[],
            smmmFullData: [] as AccountDetail[],
            firmaFullData: [] as AccountDetail[],
            mappings: {} as MappingConfig,
            rowReviews: {} as TransactionReviewMap,
        };

        await updateCompany({
            ...activeCompany,
            currentAccount: {
                ...currentData,
                manualMatches: nextManualMatches,
            },
        });
    };

    const persistRowReviews = async (nextRowReviews: TransactionReviewMap) => {
        if (!activeCompany) return;

        const currentData = activeCompany.currentAccount || {
            smmmData: [] as AccountDetail[],
            firmaData: [] as AccountDetail[],
            smmmFullData: [] as AccountDetail[],
            firmaFullData: [] as AccountDetail[],
            mappings: {} as MappingConfig,
            manualMatches: {} as Record<string, string>,
        };

        await updateCompany({
            ...activeCompany,
            currentAccount: {
                ...currentData,
                rowReviews: nextRowReviews,
            },
        });
    };

    const handleMappingComplete = async (mapping: Record<string, string>) => {
        if (!activeCompany) return;

        setIsProcessing(true);
        try {
            const { parseExcelData } = await import('./utils/excelParser');
            const currentData = activeCompany.currentAccount || {
                smmmData: [] as AccountDetail[],
                firmaData: [] as AccountDetail[],
                smmmFullData: [] as AccountDetail[],
                firmaFullData: [] as AccountDetail[],
                mappings: {} as MappingConfig,
                manualMatches: {} as Record<string, string>,
                rowReviews: {} as TransactionReviewMap,
            };

            let updatedCompany = { ...activeCompany };

            if (mappingMode === 'SMMM' && smmmFile) {
                const parsed = await parseExcelData(smmmFile, mapping);
                const parsedFull = await parseExcelData(smmmFile, mapping, { includeAllAccounts: true });
                setLocalSmmmData(parsed);
                setComparisonResults([]);
                setRowReviews({});

                updatedCompany = {
                    ...activeCompany,
                    currentAccount: {
                        ...currentData,
                        smmmData: parsed,
                        smmmFullData: parsedFull,
                        mappings: { ...currentData.mappings, smmm: mapping },
                        rowReviews: {},
                    },
                };
            }

            if (mappingMode === 'FIRMA' && firmaFile) {
                const parsed = await parseExcelData(firmaFile, mapping);
                const parsedFull = await parseExcelData(firmaFile, mapping, { includeAllAccounts: true });
                setLocalFirmaData(parsed);
                setComparisonResults([]);
                setRowReviews({});

                updatedCompany = {
                    ...activeCompany,
                    currentAccount: {
                        ...currentData,
                        firmaData: parsed,
                        firmaFullData: parsedFull,
                        mappings: { ...currentData.mappings, firma: mapping },
                        rowReviews: {},
                    },
                };
            }

            await updateCompany(updatedCompany);
            setMappingMode('NONE');
        } catch (error) {
            console.error('Current account parse error:', error);
            alert('Dosya islenirken hata olustu. Lutfen sutun eslestirmesini kontrol edin.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRunComparison = () => {
        if (!hasSmmm || !hasFirma) return;

        setIsProcessing(true);
        setTimeout(() => {
            const results = runComparison(smmmData, firmaData, manualMatches);
            setComparisonResults(results);
            setIsProcessing(false);
        }, 50);
    };

    const handleManualMatch = async (smmmCode: string, firmaCode: string) => {
        const nextManualMatches = {
            ...manualMatches,
            [smmmCode]: firmaCode,
        };

        setManualMatches(nextManualMatches);
        setComparisonResults(runComparison(smmmData, firmaData, nextManualMatches));
        await persistManualMatches(nextManualMatches);
    };

    const handleClearManualMatch = async (smmmCode: string) => {
        const nextManualMatches = { ...manualMatches };
        delete nextManualMatches[smmmCode];

        setManualMatches(nextManualMatches);
        setComparisonResults(runComparison(smmmData, firmaData, nextManualMatches));
        await persistManualMatches(nextManualMatches);
    };

    const handleRowReviewChange = async (
        reviewKey: string,
        patch: Partial<{ corrected: boolean; note?: string }>
    ) => {
        const current = rowReviews[reviewKey] || { corrected: false, note: '' };
        const mergedCorrected = patch.corrected ?? current.corrected;
        const mergedNote = (patch.note ?? current.note ?? '').trim();
        const nextReviews = { ...rowReviews };

        if (!mergedCorrected && !mergedNote) {
            delete nextReviews[reviewKey];
        } else {
            nextReviews[reviewKey] = {
                corrected: mergedCorrected,
                note: mergedNote || undefined,
                updatedAt: new Date().toISOString(),
            };
        }

        setRowReviews(nextReviews);
        await persistRowReviews(nextReviews);
    };

    const handleBulkRowReviewChange = async (
        patches: Record<string, Partial<{ corrected: boolean; note?: string }>>
    ) => {
        const nextReviews = { ...rowReviews };

        Object.entries(patches).forEach(([reviewKey, patch]) => {
            const current = nextReviews[reviewKey] || { corrected: false, note: '' };
            const mergedCorrected = patch.corrected ?? current.corrected;
            const mergedNote = (patch.note ?? current.note ?? '').trim();

            if (!mergedCorrected && !mergedNote) {
                delete nextReviews[reviewKey];
            } else {
                nextReviews[reviewKey] = {
                    corrected: mergedCorrected,
                    note: mergedNote || undefined,
                    updatedAt: new Date().toISOString(),
                };
            }
        });

        setRowReviews(nextReviews);
        await persistRowReviews(nextReviews);
    };

    if (!activeCompany) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Layers className="text-slate-600 w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Firma Secimi Gerekli</h2>
                <p className="text-slate-400 max-w-md">
                    Cari hesap kontrolu icin lutfen once firma secin.
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 relative">
            {isProcessing && (
                <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
                    <div className="flex flex-col items-center gap-4 bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-2xl">
                        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-white">Isleniyor</h3>
                            <p className="text-slate-400 text-sm">Veriler hazirlaniyor...</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">{activeCompany.name}</h1>
                    <p className="text-slate-400 text-sm">Cari Hesap Kontrol ve Mutabakat</p>
                </div>
            </div>

            {mappingMode === 'NONE' && (
                <div className="space-y-8 animate-in fade-in">
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-4">1. Veri Dosyalarini Yukle</h2>
                        <DualFileUpload
                            smmmFile={smmmFile}
                            firmaFile={firmaFile}
                            onSmmmFileSelect={setSmmmFile}
                            onFirmaFileSelect={setFirmaFile}
                            onClearSmmm={() => setSmmmFile(null)}
                            onClearFirma={() => setFirmaFile(null)}
                        />

                        <div className="mt-3 text-xs text-slate-500 space-y-1">
                            <p>Sadece 120 / 320 / 159 / 340 / 336 hesaplari degerlendirilir.</p>
                            <p>Satir bazli kontrol: Tarih + Borc/Alacak (Evrak No ve Aciklama dikkate alinmaz).</p>
                            <p>Tolerans: 0.01 TL</p>
                        </div>

                        <div className="flex gap-8 mt-3 text-xs text-slate-500">
                            <div>
                                {hasSmmm ? (
                                    <span className="text-green-500">OK {smmmData.length} hesap hazir (SMMM)</span>
                                ) : (
                                    <span>Veri Yok (SMMM)</span>
                                )}
                            </div>
                            <div>
                                {hasFirma ? (
                                    <span className="text-purple-500">OK {firmaData.length} hesap hazir (Firma)</span>
                                ) : (
                                    <span>Veri Yok (Firma)</span>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="flex gap-4">
                        <button
                            disabled={!smmmFile}
                            onClick={() => setMappingMode('SMMM')}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex-1"
                        >
                            SMMM Verilerini Isle
                        </button>
                        <button
                            disabled={!firmaFile}
                            onClick={() => setMappingMode('FIRMA')}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex-1"
                        >
                            Firma Verilerini Isle
                        </button>
                    </section>
                </div>
            )}

            {mappingMode === 'SMMM' && smmmFile && (
                <ColumnMapper
                    file={smmmFile}
                    type="smmm"
                    onMappingComplete={handleMappingComplete}
                    onCancel={() => setMappingMode('NONE')}
                />
            )}

            {mappingMode === 'FIRMA' && firmaFile && (
                <ColumnMapper
                    file={firmaFile}
                    type="firma"
                    onMappingComplete={handleMappingComplete}
                    onCancel={() => setMappingMode('NONE')}
                />
            )}

            {hasSmmm && hasFirma && mappingMode === 'NONE' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                        <div className="text-slate-300 text-sm">
                            <p>Hazir Hesaplar</p>
                            <p className="text-white font-bold">{smmmData.length} (SMMM) vs {firmaData.length} (Firma)</p>
                        </div>
                        <button
                            onClick={handleRunComparison}
                            disabled={isProcessing}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-bold transition-all flex items-center gap-2"
                        >
                            <Layers size={20} />
                            Mutabakati Baslat
                        </button>
                    </div>

                    {comparisonResults.length > 0 && (
                        <ComparisonView
                            results={comparisonResults}
                            rowReviews={rowReviews}
                            onManualMatch={handleManualMatch}
                            onClearManualMatch={handleClearManualMatch}
                            onRowReviewChange={handleRowReviewChange}
                            onBulkRowReviewChange={handleBulkRowReviewChange}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
