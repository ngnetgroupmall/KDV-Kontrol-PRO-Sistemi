import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
    AlertTriangle,
    BookOpen,
    Check,
    Download,
    Eye,
    EyeOff,
    Filter,
    Link2,
    Search,
    Unlink,
    X,
    XCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
type ViewFilter = 'ALL' | MatchStatus | 'UNMATCHED';

const formatAmount = (value: number): string => {
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

const formatFileDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*]/g;

const sanitizeFileName = (value: string): string => {
    const withoutControlChars = Array.from(value.trim())
        .filter((char) => char >= ' ' && char !== '\u007F')
        .join('');

    return withoutControlChars.replace(INVALID_FILE_NAME_CHARS, '_').replace(/\s+/g, '_');
};

const getCellTextLength = (value: unknown): number => {
    if (value === null || value === undefined) return 0;
    return String(value).length;
};

const buildColumnWidths = (headers: string[], rows: Array<Array<string | number>>): Array<{ wch: number }> => {
    return headers.map((header, columnIndex) => {
        let max = header.length;
        rows.forEach((row) => {
            max = Math.max(max, getCellTextLength(row[columnIndex]));
        });
        return { wch: Math.min(64, Math.max(11, max + 2)) };
    });
};

const createTableSheet = (
    title: string,
    headers: string[],
    rows: Array<Array<string | number>>,
    infoLines: string[] = [],
    numericColumns: number[] = []
) => {
    const aoa: Array<Array<string | number>> = [[title]];
    infoLines.forEach((line) => aoa.push([line]));
    aoa.push([]);
    aoa.push(headers);
    rows.forEach((row) => aoa.push(row));

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = infoLines.length + 2;

    worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 0) } },
        ...infoLines.map((_, index) => ({
            s: { r: index + 1, c: 0 },
            e: { r: index + 1, c: Math.max(headers.length - 1, 0) },
        })),
    ];
    worksheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({
            s: { r: headerRowIndex, c: 0 },
            e: { r: headerRowIndex, c: Math.max(headers.length - 1, 0) },
        }),
    };
    worksheet['!cols'] = buildColumnWidths(headers, rows);

    if (numericColumns.length > 0) {
        rows.forEach((row, rowIndex) => {
            const excelRowIndex = headerRowIndex + 1 + rowIndex;
            numericColumns.forEach((columnIndex) => {
                const value = row[columnIndex];
                if (typeof value !== 'number') return;
                const cellRef = XLSX.utils.encode_cell({ r: excelRowIndex, c: columnIndex });
                const cell = worksheet[cellRef];
                if (!cell) return;
                cell.z = '#,##0.00';
            });
        });
    }

    return worksheet;
};

const getStatusLabel = (status: MatchStatus): string => {
    if (status === 'MATCHED') return 'Eslesti';
    if (status === 'DIFFERENCE') return 'Hatali/Farkli';
    if (status === 'UNMATCHED_SMMM') return "SMMM'de Var";
    return 'Firmada Var';
};

export default function ComparisonView({
    results,
    rowReviews,
    onManualMatch,
    onClearManualMatch,
    onRowReviewChange,
    onBulkRowReviewChange,
}: ComparisonViewProps) {
    const isZeroBalanceUnmatched = (entry: {
        effectiveStatus: MatchStatus;
        item: ComparisonResult;
    }) => {
        if (entry.effectiveStatus === 'UNMATCHED_SMMM') {
            return Math.abs(entry.item.smmmAccount?.balance || 0) <= TOLERANCE;
        }
        if (entry.effectiveStatus === 'UNMATCHED_FIRMA') {
            return Math.abs(entry.item.firmaAccount?.balance || 0) <= TOLERANCE;
        }
        return false;
    };

    const [filter, setFilter] = useState<ViewFilter>('ALL');
    const [search, setSearch] = useState('');
    const [selectedResult, setSelectedResult] = useState<ComparisonResult | null>(null);
    const [manualSource, setManualSource] = useState<ComparisonResult | null>(null);
    const [manualTargetCode, setManualTargetCode] = useState('');
    const [manualSearch, setManualSearch] = useState('');
    const [isSubmittingManual, setIsSubmittingManual] = useState(false);
    const [hideZeroBalanceUnmatched, setHideZeroBalanceUnmatched] = useState(true);
    const [isManualDictionaryOpen, setIsManualDictionaryOpen] = useState(false);
    const [manualDictionarySearch, setManualDictionarySearch] = useState('');
    const [isClearingManualCode, setIsClearingManualCode] = useState<string | null>(null);

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

    const visibleReviewedResults = useMemo(() => {
        if (!hideZeroBalanceUnmatched) return reviewedResults;
        return reviewedResults.filter((entry) => !isZeroBalanceUnmatched(entry));
    }, [reviewedResults, hideZeroBalanceUnmatched]);

    const hiddenZeroUnmatchedCount = useMemo(
        () => reviewedResults.filter((entry) => isZeroBalanceUnmatched(entry)).length,
        [reviewedResults]
    );

    const stats = useMemo(() => {
        return {
            total: visibleReviewedResults.length,
            matched: visibleReviewedResults.filter((entry) => entry.effectiveStatus === 'MATCHED').length,
            difference: visibleReviewedResults.filter((entry) => entry.effectiveStatus === 'DIFFERENCE').length,
            unmatched: visibleReviewedResults.filter(
                (entry) => entry.effectiveStatus === 'UNMATCHED_SMMM' || entry.effectiveStatus === 'UNMATCHED_FIRMA'
            ).length,
        };
    }, [visibleReviewedResults]);

    const filteredResults = useMemo(() => {
        const query = search.trim().toLocaleLowerCase('tr-TR');

        return visibleReviewedResults.filter((entry) => {
            const item = entry.item;
            const filterMatched =
                filter === 'ALL' ||
                (filter === 'UNMATCHED'
                    ? entry.effectiveStatus === 'UNMATCHED_SMMM' || entry.effectiveStatus === 'UNMATCHED_FIRMA'
                    : entry.effectiveStatus === filter);
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
    }, [visibleReviewedResults, filter, search]);

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

    const manualDictionaryEntries = useMemo(() => {
        const map = new Map<string, { smmmAccount: AccountDetail; firmaAccount: AccountDetail }>();
        results.forEach((item) => {
            if (!item.isManual || !item.smmmAccount || !item.firmaAccount) return;
            map.set(item.smmmAccount.code, {
                smmmAccount: item.smmmAccount,
                firmaAccount: item.firmaAccount,
            });
        });

        return Array.from(map.values()).sort((left, right) =>
            left.smmmAccount.name.localeCompare(right.smmmAccount.name, 'tr-TR')
        );
    }, [results]);

    const filteredManualDictionaryEntries = useMemo(() => {
        const query = manualDictionarySearch.trim().toLocaleLowerCase('tr-TR');
        if (!query) return manualDictionaryEntries;

        return manualDictionaryEntries.filter((entry) =>
            `${entry.smmmAccount.code} ${entry.smmmAccount.name} ${entry.firmaAccount.code} ${entry.firmaAccount.name}`
                .toLocaleLowerCase('tr-TR')
                .includes(query)
        );
    }, [manualDictionaryEntries, manualDictionarySearch]);

    useEffect(() => {
        if (!manualSource || !manualSearch.trim()) return;
        if (manualCandidates.length === 1) {
            setManualTargetCode(manualCandidates[0].code);
        }
    }, [manualCandidates, manualSearch, manualSource]);

    useEffect(() => {
        if (isManualDictionaryOpen && manualDictionaryEntries.length === 0) {
            setIsManualDictionaryOpen(false);
            setManualDictionarySearch('');
        }
    }, [isManualDictionaryOpen, manualDictionaryEntries.length]);

    const closeManualDialog = useCallback(() => {
        if (isSubmittingManual) return;
        setManualSource(null);
        setManualTargetCode('');
        setManualSearch('');
    }, [isSubmittingManual]);

    const openManualDictionary = () => {
        setManualDictionarySearch('');
        setIsManualDictionaryOpen(true);
    };

    const closeManualDictionary = useCallback(() => {
        setIsManualDictionaryOpen(false);
        setManualDictionarySearch('');
    }, []);

    const isAnyOverlayOpen = Boolean(manualSource || isManualDictionaryOpen);

    useEffect(() => {
        if (!isAnyOverlayOpen) return;

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
            if (event.key !== 'Escape') return;

            if (manualSource) {
                closeManualDialog();
                return;
            }

            if (isManualDictionaryOpen) {
                closeManualDictionary();
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
    }, [closeManualDialog, closeManualDictionary, isAnyOverlayOpen, isManualDictionaryOpen, manualSource]);

    const openManualDialog = (result: ComparisonResult) => {
        if (!result.smmmAccount) return;
        setManualSource(result);
        setManualSearch('');
        setManualTargetCode(result.firmaAccount?.code || '');
    };

    const clearManualByCode = async (smmmCode: string) => {
        setIsClearingManualCode(smmmCode);
        try {
            await onClearManualMatch(smmmCode);
        } finally {
            setIsClearingManualCode(null);
        }
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
        await clearManualByCode(result.smmmAccount.code);
    };

    const handleCardFilterClick = (nextFilter: ViewFilter) => {
        setFilter((prev) => (prev === nextFilter ? 'ALL' : nextFilter));
    };

    const exportComparisonExcel = () => {
        if (filteredResults.length === 0) return;

        const now = new Date();
        const headers = [
            'Durum',
            'Manuel',
            'Duzeltildi',
            'Skor',
            'SMMM Kod',
            'SMMM Ad',
            'Firma Kod',
            'Firma Ad',
            'Bakiye Farki',
            'Borc Farki',
            'Alacak Farki',
            'Satir Farki',
        ];

        const rows: Array<Array<string | number>> = filteredResults.map((entry) => {
            const item = entry.item;
            const rowDiffCount = item.transactionSummary.onlyInSmmm + item.transactionSummary.onlyInFirma;
            const scoreText = item.isManual ? 'MANUEL' : `%${item.matchScore}`;
            return [
                getStatusLabel(entry.effectiveStatus),
                item.isManual ? 'Evet' : 'Hayir',
                entry.isResolvedDifference ? 'Evet' : 'Hayir',
                scoreText,
                item.smmmAccount?.code || '-',
                item.smmmAccount?.name || '-',
                item.firmaAccount?.code || '-',
                item.firmaAccount?.name || '-',
                item.difference,
                item.debitDifference,
                item.creditDifference,
                entry.effectiveStatus === 'DIFFERENCE' ? rowDiffCount : 0,
            ];
        });

        const infoLines = [
            `Filtre: ${filter}`,
            `Arama: ${search.trim() || '-'}`,
            `0 bakiye gizli: ${hideZeroBalanceUnmatched ? 'Evet' : 'Hayir'} (adet: ${hiddenZeroUnmatchedCount})`,
            `Kayit sayisi: ${filteredResults.length}`,
            `Uretim tarihi: ${now.toLocaleString('tr-TR')}`,
        ];

        const summarySheet = XLSX.utils.aoa_to_sheet([
            ['Cari Hesap Mutabakat Ozeti'],
            [`Toplam (gorunen): ${stats.total}`],
            [`Tam Eslesen: ${stats.matched}`],
            [`Hatali/Farkli: ${stats.difference}`],
            [`Eksik/Fazla: ${stats.unmatched}`],
            [`0 bakiyeden gizlenen: ${hideZeroBalanceUnmatched ? hiddenZeroUnmatchedCount : 0}`],
            [`Uretim tarihi: ${now.toLocaleString('tr-TR')}`],
        ]);
        summarySheet['!cols'] = [{ wch: 50 }];

        const tableSheet = createTableSheet(
            'Cari Hesap Karsilastirma Sonuclari',
            headers,
            rows,
            infoLines,
            [8, 9, 10, 11]
        );
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ozet');
        XLSX.utils.book_append_sheet(workbook, tableSheet, 'Sonuclar');
        XLSX.writeFile(
            workbook,
            `${sanitizeFileName(`Cari_Hesap_Sonuclari_${formatFileDate(now)}`)}.xlsx`
        );
    };

    const exportManualDictionaryExcel = () => {
        if (filteredManualDictionaryEntries.length === 0) return;

        const now = new Date();
        const headers = [
            'SMMM Kod',
            'SMMM Cari Adi',
            'SMMM Bakiye',
            'Firma Kod',
            'Firma Cari Adi',
            'Firma Bakiye',
            'Bakiye Farki',
        ];
        const rows: Array<Array<string | number>> = filteredManualDictionaryEntries.map((entry) => {
            const balanceDiff = (entry.smmmAccount.balance || 0) - (entry.firmaAccount.balance || 0);
            return [
                entry.smmmAccount.code,
                entry.smmmAccount.name,
                entry.smmmAccount.balance,
                entry.firmaAccount.code,
                entry.firmaAccount.name,
                entry.firmaAccount.balance,
                balanceDiff,
            ];
        });

        const infoLines = [
            `Toplam manuel eslesme: ${manualDictionaryEntries.length}`,
            `Disa aktarilan kayit: ${filteredManualDictionaryEntries.length}`,
            `Arama filtresi: ${manualDictionarySearch.trim() || '-'}`,
            `Uretim tarihi: ${now.toLocaleString('tr-TR')}`,
        ];

        const tableSheet = createTableSheet(
            'Manuel Cari Eslestirme Sozlugu',
            headers,
            rows,
            infoLines,
            [2, 5, 6]
        );
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, tableSheet, 'Manuel Sozluk');
        XLSX.writeFile(
            workbook,
            `${sanitizeFileName(`Manuel_Cari_Sozlugu_${formatFileDate(now)}`)}.xlsx`
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <button type="button" onClick={() => handleCardFilterClick('ALL')} className="w-full text-left">
                    <Card
                        className={`bg-slate-800 border-slate-700 transition-colors hover:border-blue-500/60 ${
                            filter === 'ALL' ? 'ring-1 ring-blue-500/60 border-blue-500/60' : ''
                        }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
                                <Search size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-400">Toplam Hesap</p>
                                <p className="text-2xl font-bold text-white">{stats.total}</p>
                                {hideZeroBalanceUnmatched && hiddenZeroUnmatchedCount > 0 && (
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        Gizli 0 bakiye: {hiddenZeroUnmatchedCount}
                                    </p>
                                )}
                            </div>
                        </div>
                    </Card>
                </button>

                <button type="button" onClick={() => handleCardFilterClick('MATCHED')} className="w-full text-left">
                    <Card
                        className={`bg-slate-800 border-slate-700 transition-colors hover:border-green-500/60 ${
                            filter === 'MATCHED' ? 'ring-1 ring-green-500/60 border-green-500/60' : ''
                        }`}
                    >
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
                </button>

                <button type="button" onClick={() => handleCardFilterClick('DIFFERENCE')} className="w-full text-left">
                    <Card
                        className={`bg-slate-800 border-slate-700 transition-colors hover:border-yellow-500/60 ${
                            filter === 'DIFFERENCE' ? 'ring-1 ring-yellow-500/60 border-yellow-500/60' : ''
                        }`}
                    >
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
                </button>

                <button type="button" onClick={() => handleCardFilterClick('UNMATCHED')} className="w-full text-left">
                    <Card
                        className={`bg-slate-800 border-slate-700 transition-colors hover:border-red-500/60 ${
                            filter === 'UNMATCHED' ? 'ring-1 ring-red-500/60 border-red-500/60' : ''
                        }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-500/20 rounded-lg text-red-400">
                                <XCircle size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-400">Eksik/Fazla</p>
                                <p className="text-2xl font-bold text-white">{stats.unmatched}</p>
                                {hiddenZeroUnmatchedCount > 0 && (
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        {hideZeroBalanceUnmatched
                                            ? `0 bakiyeden gizlenen: ${hiddenZeroUnmatchedCount}`
                                            : `0 bakiyeli gorunen: ${hiddenZeroUnmatchedCount}`}
                                    </p>
                                )}
                            </div>
                        </div>
                    </Card>
                </button>
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
                        onChange={(e) => setFilter(e.target.value as ViewFilter)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                        <option value="ALL">Tum Kayitlar</option>
                        <option value="MATCHED">Tam Eslesen</option>
                        <option value="DIFFERENCE">Hatali/Farkli</option>
                        <option value="UNMATCHED">Eksik/Fazla (Ikisi)</option>
                        <option value="UNMATCHED_SMMM">SMMM Tarafinda Eksik</option>
                        <option value="UNMATCHED_FIRMA">Firma Tarafinda Eksik</option>
                    </select>
                </div>

                <button
                    onClick={() => setHideZeroBalanceUnmatched((prev) => !prev)}
                    className="inline-flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 hover:border-slate-500 transition-colors"
                >
                    {hideZeroBalanceUnmatched ? <EyeOff size={16} /> : <Eye size={16} />}
                    {hideZeroBalanceUnmatched ? '0 Bakiye Gizli' : '0 Bakiye Goster'}
                </button>

                <button
                    onClick={exportComparisonExcel}
                    disabled={filteredResults.length === 0}
                    className="inline-flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 hover:border-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download size={16} />
                    Excel Aktar ({filteredResults.length})
                </button>

                <button
                    onClick={openManualDictionary}
                    disabled={manualDictionaryEntries.length === 0}
                    className="inline-flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 hover:border-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <BookOpen size={16} />
                    Manuel Sozluk ({manualDictionaryEntries.length})
                </button>
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
                                                    disabled={
                                                        isSubmittingManual ||
                                                        isClearingManualCode === item.smmmAccount.code
                                                    }
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
                    key={selectedResult.id}
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

            {isManualDictionaryOpen &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={closeManualDictionary}
                    >
                        <div
                            className="w-full max-w-5xl max-h-[88vh] bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white">Manuel Cari Sozlugu</h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Kaydedilen manuel eslestirmeleri bu ekrandan yonetebilirsin.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={exportManualDictionaryExcel}
                                        disabled={filteredManualDictionaryEntries.length === 0}
                                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-500/40 text-emerald-300 hover:text-white hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Download size={14} />
                                        Excel'e Aktar
                                    </button>
                                    <button
                                        onClick={closeManualDictionary}
                                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                        aria-label="Manuel sozluk penceresini kapat"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                <input
                                    type="text"
                                    value={manualDictionarySearch}
                                    onChange={(e) => setManualDictionarySearch(e.target.value)}
                                    placeholder="SMMM/Firma cari ara (kod veya ad)"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                                    autoFocus
                                />
                            </div>

                            <div className="text-xs text-slate-400 mb-3">
                                Toplam manuel eslesme: {manualDictionaryEntries.length}
                            </div>

                            <div className="border border-slate-700 rounded-lg overflow-auto max-h-[58vh]">
                                {filteredManualDictionaryEntries.length === 0 ? (
                                    <div className="p-6 text-sm text-slate-500 text-center">Manuel eslesme bulunamadi.</div>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                                            <tr>
                                                <th className="px-4 py-3">SMMM Hesabi</th>
                                                <th className="px-4 py-3">Firma Hesabi</th>
                                                <th className="px-4 py-3 text-right">Eylem</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {filteredManualDictionaryEntries.map((entry) => {
                                                const isRemoving = isClearingManualCode === entry.smmmAccount.code;
                                                return (
                                                    <tr key={entry.smmmAccount.code} className="hover:bg-slate-800/50">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-white">{entry.smmmAccount.name}</div>
                                                            <div className="text-xs text-slate-500">{entry.smmmAccount.code}</div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-white">{entry.firmaAccount.name}</div>
                                                            <div className="text-xs text-slate-500">{entry.firmaAccount.code}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                onClick={() => clearManualByCode(entry.smmmAccount.code)}
                                                                disabled={isRemoving}
                                                                className="text-rose-300 hover:text-white text-xs font-bold border border-rose-500/40 px-3 py-1 rounded hover:bg-rose-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                            >
                                                                {isRemoving ? 'Siliniyor...' : 'Kaldir'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={closeManualDictionary}
                                    className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                                >
                                    Kapat
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
