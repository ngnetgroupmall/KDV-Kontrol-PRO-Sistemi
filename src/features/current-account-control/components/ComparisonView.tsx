import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Filter, Link2, Search, Unlink, X, XCircle } from 'lucide-react';
import type { AccountDetail } from '../../common/types';
import type { ComparisonResult, MatchStatus, TransactionReviewMap } from '../utils/types';
import { getResultReviewSummary } from '../utils/reviewHelpers';
import { Card } from '../../../components/common/Card';
import TransactionComparisonModal from './TransactionComparisonModal';

interface ComparisonViewProps {
    results: ComparisonResult[];
    rowReviews: TransactionReviewMap;
    onManualMatch: (smmmCode: string, firmaCode: string) => Promise<void> | void;
    onClearManualMatch: (smmmCode: string) => Promise<void> | void;
    onRowReviewChange: (
        reviewKey: string,
        patch: Partial<{ corrected: boolean; note?: string }>
    ) => Promise<void> | void;
    onBulkRowReviewChange: (
        patches: Record<string, Partial<{ corrected: boolean; note?: string }>>
    ) => Promise<void> | void;
}

const TOLERANCE = 0.01;

const formatAmount = (value: number): string => {
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

export default function ComparisonView({
    results,
    rowReviews,
    onManualMatch,
    onClearManualMatch,
    onRowReviewChange,
    onBulkRowReviewChange,
}: ComparisonViewProps) {
    const [filter, setFilter] = useState<'ALL' | MatchStatus>('ALL');
    const [search, setSearch] = useState('');
    const [selectedResult, setSelectedResult] = useState<ComparisonResult | null>(null);
    const [manualSource, setManualSource] = useState<ComparisonResult | null>(null);
    const [manualTargetCode, setManualTargetCode] = useState('');
    const [manualSearch, setManualSearch] = useState('');
    const [isSubmittingManual, setIsSubmittingManual] = useState(false);

    const reviewedResults = useMemo(() => {
        const statusOrder: Record<MatchStatus, number> = {
            DIFFERENCE: 0,
            UNMATCHED_SMMM: 1,
            UNMATCHED_FIRMA: 2,
            MATCHED: 3,
        };

        return results
            .map((item) => {
                const reviewSummary = getResultReviewSummary(item, rowReviews);
                const isResolvedDifference = item.status === 'DIFFERENCE' && reviewSummary.allIssuesCorrected;
                const effectiveStatus: MatchStatus = isResolvedDifference ? 'MATCHED' : item.status;
                return {
                    item,
                    effectiveStatus,
                    isResolvedDifference,
                    reviewSummary,
                };
            })
            .sort((left, right) => {
                const orderDiff = statusOrder[left.effectiveStatus] - statusOrder[right.effectiveStatus];
                if (orderDiff !== 0) return orderDiff;
                const leftName = left.item.smmmAccount?.name || left.item.firmaAccount?.name || '';
                const rightName = right.item.smmmAccount?.name || right.item.firmaAccount?.name || '';
                return leftName.localeCompare(rightName, 'tr-TR');
            });
    }, [results, rowReviews]);

    const stats = useMemo(() => {
        return {
            total: reviewedResults.length,
            matched: reviewedResults.filter((entry) => entry.effectiveStatus === 'MATCHED').length,
            difference: reviewedResults.filter((entry) => entry.effectiveStatus === 'DIFFERENCE').length,
            unmatched: reviewedResults.filter(
                (entry) => entry.effectiveStatus === 'UNMATCHED_SMMM' || entry.effectiveStatus === 'UNMATCHED_FIRMA'
            ).length,
        };
    }, [reviewedResults]);

    const filteredResults = useMemo(() => {
        const query = search.trim().toLocaleLowerCase('tr-TR');

        return reviewedResults.filter((entry) => {
            const item = entry.item;
            const filterMatched = filter === 'ALL' || entry.effectiveStatus === filter;
            if (!filterMatched) return false;

            if (!query) return true;

            const pool = [
                item.smmmAccount?.name || '',
                item.smmmAccount?.code || '',
                item.firmaAccount?.name || '',
                item.firmaAccount?.code || '',
            ]
                .join(' ')
                .toLocaleLowerCase('tr-TR');

            return pool.includes(query);
        });
    }, [reviewedResults, filter, search]);

    const manualCandidates = useMemo(() => {
        const map = new Map<string, AccountDetail>();
        results.forEach((item) => {
            if (item.status === 'UNMATCHED_FIRMA' && item.firmaAccount) {
                map.set(item.firmaAccount.code, item.firmaAccount);
            }
        });

        if (manualSource?.firmaAccount) {
            map.set(manualSource.firmaAccount.code, manualSource.firmaAccount);
        }

        const list = Array.from(map.values());
        if (!manualSearch.trim()) return list;

        const query = manualSearch.trim().toLocaleLowerCase('tr-TR');
        return list.filter((item) =>
            `${item.code} ${item.name}`.toLocaleLowerCase('tr-TR').includes(query)
        );
    }, [results, manualSource, manualSearch]);

    useEffect(() => {
        if (!manualSource || !manualSearch.trim()) return;
        if (manualCandidates.length === 1) {
            setManualTargetCode(manualCandidates[0].code);
        }
    }, [manualCandidates, manualSearch, manualSource]);

    useEffect(() => {
        if (!manualSource) return;

        const scrollY = window.scrollY;
        const originalPosition = document.body.style.position;
        const originalTop = document.body.style.top;
        const originalWidth = document.body.style.width;
        const originalOverflowY = document.body.style.overflowY;

        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflowY = 'scroll';

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeManualDialog();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.position = originalPosition;
            document.body.style.top = originalTop;
            document.body.style.width = originalWidth;
            document.body.style.overflowY = originalOverflowY;
            window.scrollTo(0, scrollY);
        };
    }, [manualSource]);

    const openManualDialog = (result: ComparisonResult) => {
        if (!result.smmmAccount) return;
        setManualSource(result);
        setManualSearch('');
        setManualTargetCode(result.firmaAccount?.code || '');
    };

    const closeManualDialog = () => {
        if (isSubmittingManual) return;
        setManualSource(null);
        setManualTargetCode('');
        setManualSearch('');
    };

    const submitManualMatch = async (targetCode: string) => {
        if (!manualSource?.smmmAccount || !targetCode) return;
        setIsSubmittingManual(true);
        try {
            await onManualMatch(manualSource.smmmAccount.code, targetCode);
            closeManualDialog();
        } finally {
            setIsSubmittingManual(false);
        }
    };

    const confirmManualMatch = async () => {
        await submitManualMatch(manualTargetCode);
    };

    const handleManualSearchKeyDown = async (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (isSubmittingManual) return;

        const targetCode =
            manualTargetCode || (manualCandidates.length === 1 ? manualCandidates[0].code : '');

        if (!targetCode) return;
        if (!manualTargetCode) {
            setManualTargetCode(targetCode);
        }

        await submitManualMatch(targetCode);
    };

    const clearManual = async (result: ComparisonResult) => {
        if (!result.smmmAccount) return;
        setIsSubmittingManual(true);
        try {
            await onClearManualMatch(result.smmmAccount.code);
        } finally {
            setIsSubmittingManual(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-slate-800 border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
                            <Search size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Toplam Hesap</p>
                            <p className="text-2xl font-bold text-white">{stats.total}</p>
                        </div>
                    </div>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-500/20 rounded-lg text-green-400">
                            <Check size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Tam Eslesen</p>
                            <p className="text-2xl font-bold text-white">{stats.matched}</p>
                        </div>
                    </div>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-500/20 rounded-lg text-yellow-400">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Hatali/Farkli</p>
                            <p className="text-2xl font-bold text-white">{stats.difference}</p>
                        </div>
                    </div>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-500/20 rounded-lg text-red-400">
                            <XCircle size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Eksik/Fazla</p>
                            <p className="text-2xl font-bold text-white">{stats.unmatched}</p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Hesap adi veya kod ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-slate-500" />
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as 'ALL' | MatchStatus)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                        <option value="ALL">Tum Kayitlar</option>
                        <option value="MATCHED">Tam Eslesen</option>
                        <option value="DIFFERENCE">Hatali/Farkli</option>
                        <option value="UNMATCHED_SMMM">SMMM Tarafinda Eksik</option>
                        <option value="UNMATCHED_FIRMA">Firma Tarafinda Eksik</option>
                    </select>
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                            <tr>
                                <th className="px-4 py-3">Durum</th>
                                <th className="px-4 py-3 text-right">Skor</th>
                                <th className="px-4 py-3">SMMM Hesabi</th>
                                <th className="px-4 py-3">Firma Hesabi</th>
                                <th className="px-4 py-3 text-right">Bakiye Farki</th>
                                <th className="px-4 py-3 text-right">Borc Farki</th>
                                <th className="px-4 py-3 text-right">Alacak Farki</th>
                                <th className="px-4 py-3 text-right">Satir Farki</th>
                                <th className="px-4 py-3">Eylem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {filteredResults.map((entry) => {
                                const item = entry.item;
                                const rowDiffCount = item.transactionSummary.onlyInSmmm + item.transactionSummary.onlyInFirma;
                                const hasAmountDiff =
                                    Math.abs(item.difference) > TOLERANCE ||
                                    Math.abs(item.debitDifference) > TOLERANCE ||
                                    Math.abs(item.creditDifference) > TOLERANCE;
                                const isEvaluatedAsDifference = entry.effectiveStatus === 'DIFFERENCE';
                                const effectiveRowDiffCount = isEvaluatedAsDifference ? rowDiffCount : 0;
                                const showRowAsDifference = isEvaluatedAsDifference && (rowDiffCount > 0 || hasAmountDiff);

                                return (
                                    <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <StatusBadge
                                                status={item.status}
                                                isManual={item.isManual}
                                                isResolvedDifference={entry.isResolvedDifference}
                                            />
                                            {entry.reviewSummary.totalIssues > 0 && (
                                                <p
                                                    className={`text-[10px] mt-1 ${
                                                        entry.isResolvedDifference ? 'text-emerald-400' : 'text-slate-400'
                                                    }`}
                                                >
                                                    Duzeltildi: {entry.reviewSummary.correctedIssues}/{entry.reviewSummary.totalIssues}
                                                </p>
                                            )}
                                            {item.notes && <p className="text-[10px] text-amber-400 mt-1">{item.notes}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-300 font-mono">
                                            {item.isManual ? 'MANUEL' : `%${item.matchScore}`}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.smmmAccount ? (
                                                <div>
                                                    <div className="font-medium text-white">{item.smmmAccount.name}</div>
                                                    <div className="text-xs text-slate-500">{item.smmmAccount.code}</div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-600 italic">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.firmaAccount ? (
                                                <div>
                                                    <div className="font-medium text-white">{item.firmaAccount.name}</div>
                                                    <div className="text-xs text-slate-500">{item.firmaAccount.code}</div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-600 italic">-</span>
                                            )}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono ${(isEvaluatedAsDifference && Math.abs(item.difference) > TOLERANCE) ? 'text-red-400' : 'text-slate-300'}`}>
                                            {formatAmount(item.difference)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono ${(isEvaluatedAsDifference && Math.abs(item.debitDifference) > TOLERANCE) ? 'text-red-400' : 'text-slate-300'}`}>
                                            {formatAmount(item.debitDifference)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono ${(isEvaluatedAsDifference && Math.abs(item.creditDifference) > TOLERANCE) ? 'text-red-400' : 'text-slate-300'}`}>
                                            {formatAmount(item.creditDifference)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono ${showRowAsDifference ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                            {effectiveRowDiffCount}
                                        </td>
                                        <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                                            {item.smmmAccount && (item.status === 'UNMATCHED_SMMM' || item.isManual) && (
                                                <button
                                                    onClick={() => openManualDialog(item)}
                                                    className="text-violet-300 hover:text-white text-xs font-bold border border-violet-500/40 px-3 py-1 rounded hover:bg-violet-500/20 transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Link2 size={12} /> Manuel
                                                </button>
                                            )}
                                            {item.smmmAccount && item.isManual && (
                                                <button
                                                    onClick={() => clearManual(item)}
                                                    disabled={isSubmittingManual}
                                                    className="text-rose-300 hover:text-white text-xs font-bold border border-rose-500/40 px-3 py-1 rounded hover:bg-rose-500/20 transition-colors inline-flex items-center gap-1 disabled:opacity-60"
                                                >
                                                    <Unlink size={12} /> Kaldir
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setSelectedResult(item)}
                                                className="text-blue-400 hover:text-blue-300 text-xs font-bold border border-blue-500/30 px-3 py-1 rounded hover:bg-blue-500/10 transition-colors"
                                            >
                                                Detay
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredResults.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                                        Kayit bulunamadi.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedResult && (
                <TransactionComparisonModal
                    result={selectedResult}
                    rowReviews={rowReviews}
                    onRowReviewChange={onRowReviewChange}
                    onBulkRowReviewChange={onBulkRowReviewChange}
                    onClose={() => setSelectedResult(null)}
                />
            )}

            {manualSource &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={closeManualDialog}
                    >
                        <div
                            className="w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                    <h3 className="text-lg font-bold text-white">Manuel Cari Eslestirme</h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Arama yaptikca aday cariler asagida anlik listelenir.
                                    </p>
                                </div>
                                <button
                                    onClick={closeManualDialog}
                                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                    aria-label="Manuel eslestirme penceresini kapat"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3 mb-3">
                                <p className="text-xs text-slate-400">SMMM Hesabi</p>
                                <p className="text-sm text-white font-semibold">
                                    {manualSource.smmmAccount?.code} - {manualSource.smmmAccount?.name}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                    <input
                                        type="text"
                                        value={manualSearch}
                                        onChange={(e) => setManualSearch(e.target.value)}
                                        onKeyDown={handleManualSearchKeyDown}
                                        placeholder="Firma hesap ara (kod veya ad)"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                        autoFocus
                                    />
                                </div>

                                <div className="text-xs text-slate-400">
                                    {manualCandidates.length} aday bulundu
                                    {manualTargetCode ? ` - secilen: ${manualTargetCode}` : ''}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    Ipucu: Aramada Enter ile secili adayi hizli eslestirebilirsin.
                                </div>

                                <div className="border border-slate-700 rounded-lg overflow-auto max-h-[320px]">
                                    {manualCandidates.length === 0 ? (
                                        <div className="p-4 text-sm text-slate-500 text-center">Aday cari bulunamadi.</div>
                                    ) : (
                                        <div className="divide-y divide-slate-800">
                                            {manualCandidates.map((candidate) => {
                                                const isSelected = manualTargetCode === candidate.code;
                                                return (
                                                    <button
                                                        key={candidate.code}
                                                        onClick={() => setManualTargetCode(candidate.code)}
                                                        className={`w-full text-left p-3 transition-colors ${
                                                            isSelected
                                                                ? 'bg-violet-500/20 border-l-2 border-violet-400'
                                                                : 'hover:bg-slate-800/60'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className={`text-sm font-semibold ${isSelected ? 'text-violet-200' : 'text-white'}`}>
                                                                    {candidate.code}
                                                                </p>
                                                                <p className="text-xs text-slate-300 mt-0.5">{candidate.name}</p>
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                Bakiye: {formatAmount(candidate.balance)}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={closeManualDialog}
                                    className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                                >
                                    Vazgec
                                </button>
                                <button
                                    onClick={confirmManualMatch}
                                    disabled={!manualTargetCode || isSubmittingManual}
                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                >
                                    Eslestir
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}

function StatusBadge({
    status,
    isManual,
    isResolvedDifference,
}: {
    status: MatchStatus;
    isManual?: boolean;
    isResolvedDifference?: boolean;
}) {
    if (isResolvedDifference) {
        return <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-1 rounded font-bold">Duzeltildi</span>;
    }

    if (status === 'MATCHED' && isManual) {
        return <span className="bg-violet-500/20 text-violet-300 text-xs px-2 py-1 rounded font-bold">Manuel Eslesme</span>;
    }

    if (status === 'MATCHED') {
        return <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded font-bold">Eslesti</span>;
    }

    if (status === 'DIFFERENCE') {
        return <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded font-bold">Hatali/Farkli</span>;
    }

    if (status === 'UNMATCHED_SMMM') {
        return <span className="bg-red-500/10 text-red-400 text-xs px-2 py-1 rounded font-bold">SMMM'de Var</span>;
    }

    return <span className="bg-purple-500/10 text-purple-400 text-xs px-2 py-1 rounded font-bold">Firmada Var</span>;
}
