import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Circle, Info, X } from 'lucide-react';
import type { ComparableTransaction, ComparisonResult, TransactionReviewMap } from '../utils/types';
import {
    buildReviewKey as buildTransactionReviewKey,
    countCorrectedRows,
    getAccountScopeKey,
} from '../utils/reviewHelpers';

interface TransactionComparisonModalProps {
    result: ComparisonResult;
    rowReviews: TransactionReviewMap;
    onRowReviewChange: (
        reviewKey: string,
        patch: Partial<{ corrected: boolean; note?: string }>
    ) => Promise<void> | void;
    onBulkRowReviewChange: (
        patches: Record<string, Partial<{ corrected: boolean; note?: string }>>
    ) => Promise<void> | void;
    onClose: () => void;
}

const formatAmount = (value: number): string => {
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

const formatDateLabel = (value: string): string => {
    if (!value || value === 'TARIHSIZ') return 'Tarihsiz';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('tr-TR');
};

const toDateKey = (value: unknown): string => {
    if (!value) return 'TARIHSIZ';
    const parsed = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return 'TARIHSIZ';
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

export default function TransactionComparisonModal({
    result,
    rowReviews,
    onRowReviewChange,
    onBulkRowReviewChange,
    onClose,
}: TransactionComparisonModalProps) {
    interface IndexedRow {
        row: ComparableTransaction;
        sourceIndex: number;
    }

    const contentRef = useRef<HTMLDivElement>(null);
    const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

    useEffect(() => {
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
                onClose();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        contentRef.current?.scrollTo({ top: 0, behavior: 'auto' });

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.position = originalPosition;
            document.body.style.top = originalTop;
            document.body.style.width = originalWidth;
            document.body.style.overflowY = originalOverflowY;
            window.scrollTo(0, scrollY);
        };
    }, [onClose, result.id]);

    useEffect(() => {
        setDraftNotes({});
    }, [result.id]);

    const smmmAllRows = (result.smmmAccount?.transactions || []).map((tx) => ({
        date: toDateKey(tx.date),
        debit: tx.debit,
        credit: tx.credit,
        balance: typeof tx.balance === 'number' ? tx.balance : undefined,
        description: String(tx.description || '').trim(),
    }));

    const firmaAllRows = (result.firmaAccount?.transactions || []).map((tx) => ({
        date: toDateKey(tx.date),
        debit: tx.debit,
        credit: tx.credit,
        balance: typeof tx.balance === 'number' ? tx.balance : undefined,
        description: String(tx.description || '').trim(),
    }));

    const accountScopeKey = useMemo(() => {
        return getAccountScopeKey(result);
    }, [result.firmaAccount?.code, result.smmmAccount?.code]);

    const buildReviewKey = (side: 'SMMM' | 'FIRMA', row: ComparableTransaction, index: number): string => {
        return buildTransactionReviewKey(accountScopeKey, side, row, index);
    };

    const getEffectiveNote = (reviewKey: string): string => {
        if (Object.prototype.hasOwnProperty.call(draftNotes, reviewKey)) {
            return draftNotes[reviewKey];
        }
        return rowReviews[reviewKey]?.note || '';
    };

    const commitNote = (reviewKey: string, value: string) => {
        void onRowReviewChange(reviewKey, { note: value });
    };

    const toggleCorrected = (reviewKey: string) => {
        const current = rowReviews[reviewKey];
        const note = getEffectiveNote(reviewKey).trim();
        void onRowReviewChange(reviewKey, {
            corrected: !current?.corrected,
            note,
        });
    };

    const handleNoteKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>, reviewKey: string) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            const target = event.currentTarget;
            commitNote(reviewKey, target.value);
            target.blur();
        }
    };

    const smmmCorrectedCount = useMemo(
        () => countCorrectedRows(result.unmatchedSmmmTransactions, 'SMMM', accountScopeKey, rowReviews),
        [result.unmatchedSmmmTransactions, rowReviews, accountScopeKey]
    );

    const firmaCorrectedCount = useMemo(
        () => countCorrectedRows(result.unmatchedFirmaTransactions, 'FIRMA', accountScopeKey, rowReviews),
        [result.unmatchedFirmaTransactions, rowReviews, accountScopeKey]
    );

    const splitRowsByReview = (rows: ComparableTransaction[], side: 'SMMM' | 'FIRMA') => {
        const unresolved: IndexedRow[] = [];
        const corrected: IndexedRow[] = [];

        rows.forEach((row, index) => {
            const reviewKey = buildReviewKey(side, row, index);
            if (rowReviews[reviewKey]?.corrected) {
                corrected.push({ row, sourceIndex: index });
            } else {
                unresolved.push({ row, sourceIndex: index });
            }
        });

        return { unresolved, corrected };
    };

    const markAllAsCorrected = async (rows: IndexedRow[], side: 'SMMM' | 'FIRMA') => {
        if (!rows.length) return;

        const patches: Record<string, Partial<{ corrected: boolean; note?: string }>> = {};
        rows.forEach(({ row, sourceIndex }) => {
            const reviewKey = buildReviewKey(side, row, sourceIndex);
            patches[reviewKey] = {
                corrected: true,
                note: getEffectiveNote(reviewKey).trim(),
            };
        });

        await onBulkRowReviewChange(patches);
    };

    const smmmSplit = useMemo(
        () => splitRowsByReview(result.unmatchedSmmmTransactions, 'SMMM'),
        [result.unmatchedSmmmTransactions, rowReviews, accountScopeKey]
    );

    const firmaSplit = useMemo(
        () => splitRowsByReview(result.unmatchedFirmaTransactions, 'FIRMA'),
        [result.unmatchedFirmaTransactions, rowReviews, accountScopeKey]
    );

    const renderMovementTable = (rows: ComparableTransaction[]) => {
        if (!rows.length) {
            return <div className="text-sm text-slate-500 p-4 text-center">Kayit bulunamadi.</div>;
        }

        return (
            <div className="overflow-auto max-h-[290px] border border-slate-700 rounded-lg">
                <table className="w-full text-xs">
                    <thead className="bg-slate-900 sticky top-0">
                        <tr>
                            <th className="text-left p-2 text-slate-400 uppercase">Tarih</th>
                            <th className="text-right p-2 text-slate-400 uppercase">Borc</th>
                            <th className="text-right p-2 text-slate-400 uppercase">Alacak</th>
                            <th className="text-right p-2 text-slate-400 uppercase">Bakiye</th>
                            <th className="text-left p-2 text-slate-400 uppercase">Aciklama</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {rows.map((row, index) => {
                            return (
                                <tr
                                    key={`${row.date}-${row.debit}-${row.credit}-${row.description || ''}-${index}`}
                                    className="hover:bg-slate-800/40"
                                >
                                    <td className="p-2 text-slate-300 whitespace-nowrap">{formatDateLabel(row.date)}</td>
                                    <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{formatAmount(row.debit)}</td>
                                    <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{formatAmount(row.credit)}</td>
                                    <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">
                                        {typeof row.balance === 'number' ? formatAmount(row.balance) : '-'}
                                    </td>
                                    <td className="p-2 text-slate-300">{row.description || '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderReviewableTable = (rows: IndexedRow[], side: 'SMMM' | 'FIRMA') => {
        if (!rows.length) {
            return <div className="text-sm text-slate-500 p-4 text-center">Kayit bulunamadi.</div>;
        }

        return (
            <div className="overflow-auto max-h-[290px] border border-slate-700 rounded-lg">
                <table className="w-full text-xs">
                    <thead className="bg-slate-900 sticky top-0">
                        <tr>
                            <th className="text-left p-2 text-slate-400 uppercase">Tarih</th>
                            <th className="text-right p-2 text-slate-400 uppercase">Borc</th>
                            <th className="text-right p-2 text-slate-400 uppercase">Alacak</th>
                            <th className="text-right p-2 text-slate-400 uppercase">Bakiye</th>
                            <th className="text-left p-2 text-slate-400 uppercase">Aciklama</th>
                            <th className="text-left p-2 text-slate-400 uppercase">Durum</th>
                            <th className="text-left p-2 text-slate-400 uppercase min-w-[320px]">Not</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {rows.map(({ row, sourceIndex }, index) => {
                            const reviewKey = buildReviewKey(side, row, sourceIndex);
                            const review = rowReviews[reviewKey];
                            const isCorrected = !!review?.corrected;
                            const noteValue = getEffectiveNote(reviewKey);

                            return (
                                <tr
                                    key={`${row.date}-${row.debit}-${row.credit}-${row.description || ''}-${sourceIndex}-${index}`}
                                    className="hover:bg-slate-800/40"
                                >
                                    <td className="p-2 text-slate-300 whitespace-nowrap">{formatDateLabel(row.date)}</td>
                                    <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{formatAmount(row.debit)}</td>
                                    <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{formatAmount(row.credit)}</td>
                                    <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">
                                        {typeof row.balance === 'number' ? formatAmount(row.balance) : '-'}
                                    </td>
                                    <td className="p-2 text-slate-300">{row.description || '-'}</td>
                                    <td className="p-2">
                                        <button
                                            onClick={() => toggleCorrected(reviewKey)}
                                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded border transition-colors ${
                                                isCorrected
                                                    ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20'
                                                    : 'text-slate-300 border-slate-600 hover:border-slate-500 hover:bg-slate-800'
                                            }`}
                                        >
                                            {isCorrected ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                                            {isCorrected ? 'Duzeltildi' : 'Isaretle'}
                                        </button>
                                    </td>
                                    <td className="p-2">
                                        <textarea
                                            value={noteValue}
                                            onChange={(event) => {
                                                const value = event.target.value;
                                                setDraftNotes((prev) => ({ ...prev, [reviewKey]: value }));
                                            }}
                                            onBlur={(event) => commitNote(reviewKey, event.target.value)}
                                            onKeyDown={(event) => handleNoteKeyDown(event, reviewKey)}
                                            placeholder="Not ekle..."
                                            rows={2}
                                            className="w-full min-w-[320px] bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-y"
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        createPortal(
            <div
                className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm p-1 md:p-2 flex items-start justify-center"
                onClick={onClose}
            >
                <div
                    className="w-[99vw] h-[98vh] max-w-none bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex flex-col shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                <div className="p-5 border-b border-slate-700 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-white">Cari Hesap Detay Karsilastirma</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Eslestirme skoru %{result.matchScore}
                        </p>
                        <div className="mt-3 text-xs text-slate-300 space-y-1">
                            <p><span className="text-slate-500">SMMM:</span> {result.smmmAccount?.code || '-'} / {result.smmmAccount?.name || '-'}</p>
                            <p><span className="text-slate-500">Firma:</span> {result.firmaAccount?.code || '-'} / {result.firmaAccount?.name || '-'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        aria-label="Detay penceresini kapat"
                    >
                        <X size={22} />
                    </button>
                </div>

                <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/80">
                    <div className="flex items-start gap-2 text-xs text-slate-300">
                        <Info size={14} className="mt-[1px] text-blue-400 shrink-0" />
                        <p>
                            Satir bazli eslestirme sadece <span className="text-blue-300 font-semibold">Tarih + Borc + Alacak</span> ile yapilir.
                            Aciklama sadece okunabilirlik icin gosterilir, karsilastirmaya dahil degildir.
                        </p>
                    </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-slate-800">
                    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                        <p className="text-[11px] text-slate-500 uppercase">Bakiye Farki</p>
                        <p className="text-lg font-bold text-white">{formatAmount(result.difference)}</p>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                        <p className="text-[11px] text-slate-500 uppercase">Borc Farki</p>
                        <p className="text-lg font-bold text-white">{formatAmount(result.debitDifference)}</p>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                        <p className="text-[11px] text-slate-500 uppercase">Alacak Farki</p>
                        <p className="text-lg font-bold text-white">{formatAmount(result.creditDifference)}</p>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                        <p className="text-[11px] text-slate-500 uppercase">Satir Farki</p>
                        <p className="text-lg font-bold text-white">
                            {result.transactionSummary.onlyInSmmm + result.transactionSummary.onlyInFirma}
                        </p>
                    </div>
                </div>

                <div ref={contentRef} className="flex-1 overflow-auto p-5 space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-slate-800/20 border border-slate-700 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-red-400 mb-3">
                                SMMM Tarafinda Eslesmeyen Hareketler ({smmmSplit.unresolved.length})
                                {smmmSplit.corrected.length > 0 && (
                                    <span className="ml-2 text-xs text-emerald-300 font-medium">
                                        Duzeltildi: {smmmCorrectedCount}
                                    </span>
                                )}
                            </h4>
                            {smmmSplit.unresolved.length > 0 && (
                                <div className="mb-3">
                                    <button
                                        onClick={() => void markAllAsCorrected(smmmSplit.unresolved, 'SMMM')}
                                        className="text-xs px-3 py-1.5 rounded border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                                    >
                                        Tumunu Duzeltildi Isaretle
                                    </button>
                                </div>
                            )}
                            {renderReviewableTable(smmmSplit.unresolved, 'SMMM')}
                        </div>
                        <div className="bg-slate-800/20 border border-slate-700 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-purple-400 mb-3">
                                Firma Tarafinda Eslesmeyen Hareketler ({firmaSplit.unresolved.length})
                                {firmaSplit.corrected.length > 0 && (
                                    <span className="ml-2 text-xs text-emerald-300 font-medium">
                                        Duzeltildi: {firmaCorrectedCount}
                                    </span>
                                )}
                            </h4>
                            {firmaSplit.unresolved.length > 0 && (
                                <div className="mb-3">
                                    <button
                                        onClick={() => void markAllAsCorrected(firmaSplit.unresolved, 'FIRMA')}
                                        className="text-xs px-3 py-1.5 rounded border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                                    >
                                        Tumunu Duzeltildi Isaretle
                                    </button>
                                </div>
                            )}
                            {renderReviewableTable(firmaSplit.unresolved, 'FIRMA')}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-slate-800/20 border border-emerald-700/40 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-emerald-300 mb-3">
                                SMMM Duzeltilen Hareketler ({smmmSplit.corrected.length})
                            </h4>
                            {renderMovementTable(smmmSplit.corrected.map((item) => item.row))}
                        </div>
                        <div className="bg-slate-800/20 border border-emerald-700/40 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-emerald-300 mb-3">
                                Firma Duzeltilen Hareketler ({firmaSplit.corrected.length})
                            </h4>
                            {renderMovementTable(firmaSplit.corrected.map((item) => item.row))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-slate-800/20 border border-slate-700 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-slate-200 mb-3">
                                SMMM Tum Hareketler ({result.smmmAccount?.transactions.length || 0})
                            </h4>
                            {renderMovementTable(smmmAllRows)}
                        </div>
                        <div className="bg-slate-800/20 border border-slate-700 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-slate-200 mb-3">
                                Firma Tum Hareketler ({result.firmaAccount?.transactions.length || 0})
                            </h4>
                            {renderMovementTable(firmaAllRows)}
                        </div>
                    </div>
                </div>
                </div>
            </div>,
            document.body
        )
    );
}
