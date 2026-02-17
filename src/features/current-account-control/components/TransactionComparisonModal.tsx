import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Circle, Info, X } from 'lucide-react';
import type { ComparableTransaction, ComparisonResult, TransactionReviewMap } from '../utils/types';
import { useCompany } from '../../../context/CompanyContext';
import {
    buildReviewKey as buildTransactionReviewKey,
    countCorrectedRows,
    getAccountScopeKey,
} from '../utils/reviewHelpers';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

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

const formatFxAmount = (value: number | undefined): string => {
    if (typeof value !== 'number') return '';
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(value);
};

const getFxMovement = (
    fxDebit: number | undefined,
    fxCredit: number | undefined
): number => {
    const debit = typeof fxDebit === 'number' ? fxDebit : 0;
    const credit = typeof fxCredit === 'number' ? fxCredit : 0;
    return debit - credit;
};

const formatSignedFxMovement = (
    fxDebit: number | undefined,
    fxCredit: number | undefined
): string => {
    const movement = getFxMovement(fxDebit, fxCredit);
    if (Math.abs(movement) < 0.0001) return '';

    const sign = movement > 0 ? '+' : '-';
    return `${sign}${formatFxAmount(Math.abs(movement))}`;
};

const isTlCurrencyCode = (currencyCode: string | undefined): boolean => {
    const normalized = String(currencyCode || '').trim().toLocaleUpperCase('tr-TR');
    if (!normalized) return false;
    return normalized === 'TL' || normalized.includes('TRY');
};

const hasForexContent = (
    currencyCode: string | undefined,
    exchangeRate: number | undefined,
    fxDebit: number | undefined,
    fxCredit: number | undefined,
    fxBalance: number | undefined
): boolean => {
    if (Math.abs(getFxMovement(fxDebit, fxCredit)) >= 0.0001) return true;
    if (typeof fxBalance === 'number' && Math.abs(fxBalance) >= 0.0001) return true;
    if (currencyCode && !isTlCurrencyCode(currencyCode)) return true;
    if (typeof exchangeRate === 'number' && Math.abs(exchangeRate - 1) >= 0.0001 && !isTlCurrencyCode(currencyCode)) return true;
    return false;
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

const normalizeVoucherNo = (value: unknown): string => {
    return String(value ?? '')
        .trim()
        .toLocaleUpperCase('tr-TR')
        .replace(/\s+/g, '');
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

    interface VoucherLedgerLine {
        date: Date | null;
        source: 'SMMM DOSYA' | 'FIRMA DOSYA' | 'KEBIR';
        accountCode: string;
        accountName: string;
        description: string;
        debit: number;
        credit: number;
        voucherNo: string;
        currencyCode?: string;
        exchangeRate?: number;
        fxDebit?: number;
        fxCredit?: number;
        fxBalance?: number;
    }

    const { activeCompany } = useCompany();
    const contentRef = useRef<HTMLDivElement>(null);
    const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
    const [selectedVoucherNo, setSelectedVoucherNo] = useState<string | null>(null);

    useEscapeKey(onClose, !!result);



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

        contentRef.current?.scrollTo({ top: 0, behavior: 'auto' });

        return () => {
            document.body.style.position = originalPosition;
            document.body.style.top = originalTop;
            document.body.style.width = originalWidth;
            document.body.style.overflowY = originalOverflowY;
            window.scrollTo(0, scrollY);
        };
    }, []);

    const smmmAllRows = (result.smmmAccount?.transactions || []).map((tx) => ({
        date: toDateKey(tx.date),
        debit: tx.debit,
        credit: tx.credit,
        balance: typeof tx.balance === 'number' ? tx.balance : undefined,
        description: String(tx.description || '').trim(),
        voucherNo: String(tx.voucherNo || '').trim() || undefined,
        currencyCode: String(tx.currencyCode || '').trim() || undefined,
        exchangeRate: typeof tx.exchangeRate === 'number' ? tx.exchangeRate : undefined,
        fxDebit: typeof tx.fxDebit === 'number' ? tx.fxDebit : undefined,
        fxCredit: typeof tx.fxCredit === 'number' ? tx.fxCredit : undefined,
        fxBalance: typeof tx.fxBalance === 'number' ? tx.fxBalance : undefined,
    }));

    const firmaAllRows = (result.firmaAccount?.transactions || []).map((tx) => ({
        date: toDateKey(tx.date),
        debit: tx.debit,
        credit: tx.credit,
        balance: typeof tx.balance === 'number' ? tx.balance : undefined,
        description: String(tx.description || '').trim(),
        voucherNo: String(tx.voucherNo || '').trim() || undefined,
        currencyCode: String(tx.currencyCode || '').trim() || undefined,
        exchangeRate: typeof tx.exchangeRate === 'number' ? tx.exchangeRate : undefined,
        fxDebit: typeof tx.fxDebit === 'number' ? tx.fxDebit : undefined,
        fxCredit: typeof tx.fxCredit === 'number' ? tx.fxCredit : undefined,
        fxBalance: typeof tx.fxBalance === 'number' ? tx.fxBalance : undefined,
    }));

    const accountScopeKey = getAccountScopeKey(result);

    const voucherLedgerIndex = useMemo(() => {
        const index = new Map<string, VoucherLedgerLine[]>();
        const smmmFullData = activeCompany?.currentAccount?.smmmFullData || [];
        const firmaFullData = activeCompany?.currentAccount?.firmaFullData || [];
        const kebirMizan = activeCompany?.kebirAnalysis?.mizan || [];
        const hasCurrentAccountFullData = smmmFullData.length > 0 || firmaFullData.length > 0;

        const addFromAccounts = (
            accounts: typeof smmmFullData,
            source: VoucherLedgerLine['source']
        ) => {
            accounts.forEach((account) => {
                account.transactions.forEach((transaction) => {
                    const rawVoucherNo = String(transaction.voucherNo || '').trim();
                    const voucherKey = normalizeVoucherNo(rawVoucherNo);
                    if (!voucherKey) return;

                    const existing = index.get(voucherKey) || [];
                    existing.push({
                        date: transaction.date,
                        source,
                        accountCode: account.code,
                        accountName: account.name,
                        description: String(transaction.description || '').trim(),
                        debit: transaction.debit,
                        credit: transaction.credit,
                        voucherNo: rawVoucherNo,
                        currencyCode: String(transaction.currencyCode || '').trim() || undefined,
                        exchangeRate: typeof transaction.exchangeRate === 'number' ? transaction.exchangeRate : undefined,
                        fxDebit: typeof transaction.fxDebit === 'number' ? transaction.fxDebit : undefined,
                        fxCredit: typeof transaction.fxCredit === 'number' ? transaction.fxCredit : undefined,
                        fxBalance: typeof transaction.fxBalance === 'number' ? transaction.fxBalance : undefined,
                    });
                    index.set(voucherKey, existing);
                });
            });
        };

        if (hasCurrentAccountFullData) {
            addFromAccounts(smmmFullData, 'SMMM DOSYA');
            addFromAccounts(firmaFullData, 'FIRMA DOSYA');
        } else if (kebirMizan.length > 0) {
            addFromAccounts(kebirMizan, 'KEBIR');
        }

        index.forEach((lines) => {
            lines.sort((left, right) => {
                const leftTime = left.date ? left.date.getTime() : Number.MAX_SAFE_INTEGER;
                const rightTime = right.date ? right.date.getTime() : Number.MAX_SAFE_INTEGER;
                if (leftTime !== rightTime) return leftTime - rightTime;
                return left.accountCode.localeCompare(right.accountCode, 'tr-TR');
            });
        });

        return index;
    }, [activeCompany?.currentAccount?.smmmFullData, activeCompany?.currentAccount?.firmaFullData, activeCompany?.kebirAnalysis?.mizan]);

    const hasVoucherSourceData = useMemo(() => {
        return voucherLedgerIndex.size > 0;
    }, [voucherLedgerIndex]);

    const selectedVoucherLines = useMemo(() => {
        if (!selectedVoucherNo) return [];
        return voucherLedgerIndex.get(normalizeVoucherNo(selectedVoucherNo)) || [];
    }, [selectedVoucherNo, voucherLedgerIndex]);

    const selectedVoucherTotals = useMemo(() => {
        return selectedVoucherLines.reduce(
            (acc, line) => {
                acc.debit += line.debit;
                acc.credit += line.credit;
                return acc;
            },
            { debit: 0, credit: 0 }
        );
    }, [selectedVoucherLines]);

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

    const smmmSplit = splitRowsByReview(result.unmatchedSmmmTransactions, 'SMMM');
    const firmaSplit = splitRowsByReview(result.unmatchedFirmaTransactions, 'FIRMA');

    const openVoucherLedger = (voucherNo: string | undefined) => {
        const clean = String(voucherNo || '').trim();
        if (!clean) return;
        setSelectedVoucherNo(clean);
    };

    const renderVoucherCell = (voucherNo: string | undefined) => {
        const clean = String(voucherNo || '').trim();
        if (!clean) {
            return <span className="text-slate-500">-</span>;
        }

        return (
            <button
                onClick={() => openVoucherLedger(clean)}
                className="text-blue-300 hover:text-blue-200 underline underline-offset-2 font-mono"
                title="Kebirde bu fis numarasini gor"
            >
                {clean}
            </button>
        );
    };

    const getRowErrorLabel = (
        row: ComparableTransaction,
        mode: 'MOVEMENT' | 'REVIEWABLE'
    ): string => {
        if (!row.date || row.date === 'TARIHSIZ') return 'Tarih yok';
        if (row.debit > 0 && row.credit > 0) return 'Borc/Alacak birlikte';
        if (row.debit === 0 && row.credit === 0) return 'Tutar yok';
        if (mode === 'REVIEWABLE') return 'Eslesmedi';
        return '';
    };

    const renderMovementTable = (rows: ComparableTransaction[]) => {
        if (!rows.length) {
            return <div className="text-sm text-slate-500 p-4 text-center">Kayit bulunamadi.</div>;
        }

        const showForexColumns = rows.some((row) => (
            hasForexContent(row.currencyCode, row.exchangeRate, row.fxDebit, row.fxCredit, row.fxBalance)
        ));

        return (
            <div className="overflow-auto max-h-[290px] border border-slate-700 rounded-lg">
                <table className="w-full text-xs">
                    <thead className="bg-slate-900 sticky top-0">
                        <tr>
                            <th className="text-left p-2 text-slate-400 uppercase">Tarih</th>
                            <th className="text-left p-2 text-slate-400 uppercase">Fis No</th>
                            <th className="text-right p-2 text-slate-400 uppercase">Borc</th>
                            <th className="text-right p-2 text-slate-400 uppercase">Alacak</th>
                            <th className="text-right p-2 text-slate-400 uppercase">Bakiye</th>
                            {showForexColumns && (
                                <>
                                    <th className="text-left p-2 text-slate-400 uppercase">Dvz</th>
                                    <th className="text-right p-2 text-slate-400 uppercase">Kur</th>
                                    <th className="text-right p-2 text-slate-400 uppercase">Dvz Hareket</th>
                                    <th className="text-right p-2 text-slate-400 uppercase">Dvz Bakiye</th>
                                </>
                            )}
                            <th className="text-left p-2 text-slate-400 uppercase">Aciklama</th>
                            <th className="text-left p-2 text-slate-400 uppercase">Hata</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {rows.map((row, index) => {
                            const showForexRow = hasForexContent(
                                row.currencyCode,
                                row.exchangeRate,
                                row.fxDebit,
                                row.fxCredit,
                                row.fxBalance
                            );
                            const errorLabel = getRowErrorLabel(row, 'MOVEMENT');
                            return (
                                <tr
                                    key={`${row.date}-${row.debit}-${row.credit}-${row.description || ''}-${index}`}
                                    className="hover:bg-slate-800/40"
                                >
                                    <td className="p-2 text-slate-300 whitespace-nowrap">{formatDateLabel(row.date)}</td>
                                    <td className="p-2 whitespace-nowrap">{renderVoucherCell(row.voucherNo)}</td>
                                    <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{formatAmount(row.debit)}</td>
                                    <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{formatAmount(row.credit)}</td>
                                    <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">
                                        {typeof row.balance === 'number' ? formatAmount(row.balance) : '-'}
                                    </td>
                                    {showForexColumns && (
                                        <>
                                            <td className="p-2 text-slate-300 whitespace-nowrap">{showForexRow ? (row.currencyCode || '') : ''}</td>
                                            <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{showForexRow ? formatFxAmount(row.exchangeRate) : ''}</td>
                                            <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{showForexRow ? formatSignedFxMovement(row.fxDebit, row.fxCredit) : ''}</td>
                                            <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{showForexRow ? formatFxAmount(row.fxBalance) : ''}</td>
                                        </>
                                    )}
                                    <td className="p-2 text-slate-300">{row.description || '-'}</td>
                                    <td className="p-2 text-[11px] text-amber-300 whitespace-nowrap">{errorLabel}</td>
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

        const showForexColumns = rows.some(({ row }) => (
            hasForexContent(row.currencyCode, row.exchangeRate, row.fxDebit, row.fxCredit, row.fxBalance)
        ));

        return (
            <div className="overflow-auto max-h-[290px] border border-slate-700 rounded-lg">
                <table className="w-full text-xs">
                    <thead className="bg-slate-900 sticky top-0">
                        <tr>
                            <th className="text-left p-2 text-slate-400 uppercase">Tarih</th>
                            <th className="text-left p-2 text-slate-400 uppercase">Fis No</th>
                            <th className="text-right p-2 text-slate-400 uppercase">Borc</th>
                            <th className="text-right p-2 text-slate-400 uppercase">Alacak</th>
                            <th className="text-right p-2 text-slate-400 uppercase">Bakiye</th>
                            {showForexColumns && (
                                <>
                                    <th className="text-left p-2 text-slate-400 uppercase">Dvz</th>
                                    <th className="text-right p-2 text-slate-400 uppercase">Kur</th>
                                    <th className="text-right p-2 text-slate-400 uppercase">Dvz Hareket</th>
                                    <th className="text-right p-2 text-slate-400 uppercase">Dvz Bakiye</th>
                                </>
                            )}
                            <th className="text-left p-2 text-slate-400 uppercase">Aciklama</th>
                            <th className="text-left p-2 text-slate-400 uppercase">Hata</th>
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
                            const showForexRow = hasForexContent(
                                row.currencyCode,
                                row.exchangeRate,
                                row.fxDebit,
                                row.fxCredit,
                                row.fxBalance
                            );
                            const errorLabel = getRowErrorLabel(row, 'REVIEWABLE');

                            return (
                                <tr
                                    key={`${row.date}-${row.debit}-${row.credit}-${row.description || ''}-${sourceIndex}-${index}`}
                                    className="hover:bg-slate-800/40"
                                >
                                    <td className="p-2 text-slate-300 whitespace-nowrap">{formatDateLabel(row.date)}</td>
                                    <td className="p-2 whitespace-nowrap">{renderVoucherCell(row.voucherNo)}</td>
                                    <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{formatAmount(row.debit)}</td>
                                    <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{formatAmount(row.credit)}</td>
                                    <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">
                                        {typeof row.balance === 'number' ? formatAmount(row.balance) : '-'}
                                    </td>
                                    {showForexColumns && (
                                        <>
                                            <td className="p-2 text-slate-300 whitespace-nowrap">{showForexRow ? (row.currencyCode || '') : ''}</td>
                                            <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{showForexRow ? formatFxAmount(row.exchangeRate) : ''}</td>
                                            <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{showForexRow ? formatSignedFxMovement(row.fxDebit, row.fxCredit) : ''}</td>
                                            <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{showForexRow ? formatFxAmount(row.fxBalance) : ''}</td>
                                        </>
                                    )}
                                    <td className="p-2 text-slate-300">{row.description || '-'}</td>
                                    <td className="p-2 text-[11px] text-amber-300 whitespace-nowrap">{errorLabel}</td>
                                    <td className="p-2">
                                        <button
                                            onClick={() => toggleCorrected(reviewKey)}
                                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded border transition-colors ${isCorrected
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
                className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm p-0 flex items-stretch justify-stretch"
                onClick={onClose}
            >
                <div
                    className="w-screen h-screen max-w-none bg-slate-900 overflow-hidden flex flex-col shadow-2xl"
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
                        {selectedVoucherNo && (
                            <div className="bg-slate-800/30 border border-blue-600/40 rounded-lg p-4">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-blue-300">
                                            Muhasebe Fisi - {selectedVoucherNo}
                                        </h4>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Cari detayda fis noya tiklayarak yuklenen dosyalardan eslesen muhasebe fisini goruyorsun.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedVoucherNo(null)}
                                        className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-700/40"
                                    >
                                        Kapat
                                    </button>
                                </div>

                                {!hasVoucherSourceData ? (
                                    <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-3">
                                        Fis detayi icin uygun kaynak bulunamadi. Cari dosyalarini tekrar isleyin veya Kebir Analizi yukleyin.
                                    </div>
                                ) : selectedVoucherLines.length === 0 ? (
                                    <div className="text-xs text-slate-400 bg-slate-900/50 border border-slate-700 rounded p-3">
                                        Bu fis numarasi icin kayit bulunamadi.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="overflow-auto max-h-[300px] border border-slate-700 rounded-lg">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-900 sticky top-0">
                                                    <tr>
                                                        <th className="text-left p-2 text-slate-400 uppercase">Tarih</th>
                                                        <th className="text-left p-2 text-slate-400 uppercase">Kaynak</th>
                                                        <th className="text-left p-2 text-slate-400 uppercase">Hesap Kodu</th>
                                                        <th className="text-left p-2 text-slate-400 uppercase">Hesap Adi</th>
                                                        <th className="text-left p-2 text-slate-400 uppercase">Aciklama</th>
                                                        <th className="text-right p-2 text-slate-400 uppercase">Borc</th>
                                                        <th className="text-right p-2 text-slate-400 uppercase">Alacak</th>
                                                        <th className="text-left p-2 text-slate-400 uppercase">Dvz</th>
                                                        <th className="text-right p-2 text-slate-400 uppercase">Kur</th>
                                                        <th className="text-right p-2 text-slate-400 uppercase">Dvz Hareket</th>
                                                        <th className="text-right p-2 text-slate-400 uppercase">Dvz Bakiye</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800">
                                                    {selectedVoucherLines.map((line, index) => {
                                                        const showForexRow = hasForexContent(
                                                            line.currencyCode,
                                                            line.exchangeRate,
                                                            line.fxDebit,
                                                            line.fxCredit,
                                                            line.fxBalance
                                                        );

                                                        return (
                                                            <tr key={`${line.accountCode}-${line.description}-${index}`} className="hover:bg-slate-800/30">
                                                                <td className="p-2 text-slate-300 whitespace-nowrap">
                                                                    {line.date ? line.date.toLocaleDateString('tr-TR') : '-'}
                                                                </td>
                                                                <td className="p-2 text-slate-300 whitespace-nowrap">{line.source}</td>
                                                                <td className="p-2 text-blue-300 font-mono whitespace-nowrap">{line.accountCode}</td>
                                                                <td className="p-2 text-slate-300">{line.accountName || '-'}</td>
                                                                <td className="p-2 text-slate-300">{line.description || '-'}</td>
                                                                <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{formatAmount(line.debit)}</td>
                                                                <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{formatAmount(line.credit)}</td>
                                                                <td className="p-2 text-slate-300 whitespace-nowrap">{showForexRow ? (line.currencyCode || '') : ''}</td>
                                                                <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{showForexRow ? formatFxAmount(line.exchangeRate) : ''}</td>
                                                                <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{showForexRow ? formatSignedFxMovement(line.fxDebit, line.fxCredit) : ''}</td>
                                                                <td className="p-2 text-right text-slate-300 font-mono whitespace-nowrap">{showForexRow ? formatFxAmount(line.fxBalance) : ''}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="flex justify-end gap-6 text-xs">
                                            <div className="text-slate-300">
                                                Toplam Borc: <span className="font-bold text-emerald-300">{formatAmount(selectedVoucherTotals.debit)}</span>
                                            </div>
                                            <div className="text-slate-300">
                                                Toplam Alacak: <span className="font-bold text-rose-300">{formatAmount(selectedVoucherTotals.credit)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

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
