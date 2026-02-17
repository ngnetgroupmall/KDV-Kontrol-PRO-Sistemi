import { Calendar, Hash, Minus, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { matchesSearchAcrossFields } from '../../../utils/search';
import type { VoucherEditSource } from '../../common/types';
import type {
    VoucherAddRowRequest,
    VoucherEditField,
    VoucherEditRequest,
} from '../../common/voucherEditService';

export interface VoucherAccountOption {
    code: string;
    name: string;
}

export interface VoucherMutationResponse {
    ok: boolean;
    error?: string;
    focusVoucherNo?: string;
}

export interface VoucherDetailRow {
    source: VoucherEditSource;
    sourceAccountCode: string;
    sourceTransactionIndex: number;
    sourceTransactionId?: string;
    voucherNo?: string;
    accountCode: string;
    accountName: string;
    documentNo?: string;
    date: Date | null;
    description: string;
    debit: number;
    credit: number;
    currencyCode?: string;
    exchangeRate?: number;
    fxDebit?: number;
    fxCredit?: number;
    fxBalance?: number;
}

interface VoucherDetailModalProps {
    source: VoucherEditSource;
    voucherNo: string | null;
    rows: VoucherDetailRow[];
    accountOptions?: VoucherAccountOption[];
    onClose: () => void;
    onVoucherChange?: (voucherNo: string) => void;
    onRowEdit?: (request: VoucherEditRequest) => Promise<VoucherMutationResponse>;
    onBatchRowEdit?: (requests: VoucherEditRequest[]) => Promise<VoucherMutationResponse>;
    onAddRow?: (request: VoucherAddRowRequest) => Promise<VoucherMutationResponse>;
}

type EditableCellField = Exclude<VoucherEditField, 'account'>;

interface EditingCellState {
    rowKey: string;
    field: EditableCellField;
    value: string;
}

interface AddRowDraft {
    voucherNo: string;
    accountCode: string;
    accountName: string;
    date: string;
    documentNo: string;
    description: string;
    debit: string;
    credit: string;
    currencyCode: string;
    exchangeRate: string;
    fxMovement: string;
    fxBalance: string;
}

type PendingEditMap = Record<string, VoucherEditRequest>;

import { formatCurrency, formatDate } from '../../../utils/formatters';

const VIRTUAL_ROW_HEIGHT = 44;
const VIRTUAL_OVERSCAN = 12;
const VIRTUALIZATION_ROW_THRESHOLD = 120;

const toInputDate = (value: Date | null | undefined): string => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatFxNumber = (value: number | undefined): string => {
    if (typeof value !== 'number') return '';
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(value);
};

const getFxMovement = (fxDebit: number | undefined, fxCredit: number | undefined): number => {
    const debit = typeof fxDebit === 'number' ? fxDebit : 0;
    const credit = typeof fxCredit === 'number' ? fxCredit : 0;
    return debit - credit;
};

const formatSignedFxMovement = (fxDebit: number | undefined, fxCredit: number | undefined): string => {
    const movement = getFxMovement(fxDebit, fxCredit);
    if (Math.abs(movement) < 0.0001) return '';
    const sign = movement > 0 ? '+' : '-';
    return `${sign}${formatFxNumber(Math.abs(movement))}`;
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

const buildRowKey = (row: VoucherDetailRow): string => {
    return `${row.source}|${row.sourceTransactionId || `${row.sourceAccountCode}|${row.sourceTransactionIndex}`}`;
};

const buildPendingEditKey = (rowKey: string, field: VoucherEditField): string => `${rowKey}|${field}`;

const createInitialAddRowDraft = (voucherNo: string | null, defaultOption?: VoucherAccountOption): AddRowDraft => ({
    voucherNo: String(voucherNo || '').trim(),
    accountCode: defaultOption?.code || '',
    accountName: defaultOption?.name || '',
    date: '',
    documentNo: String(voucherNo || '').trim(),
    description: '',
    debit: '',
    credit: '',
    currencyCode: '',
    exchangeRate: '',
    fxMovement: '',
    fxBalance: '',
});

const getEditableCellInitialValue = (row: VoucherDetailRow, field: EditableCellField): string => {
    switch (field) {
        case 'date':
            return toInputDate(row.date);
        case 'documentNo':
            return String(row.documentNo || '');
        case 'description':
            return String(row.description || '');
        case 'debit':
            return row.debit ? String(row.debit) : '';
        case 'credit':
            return row.credit ? String(row.credit) : '';
        case 'currencyCode':
            return String(row.currencyCode || '');
        case 'exchangeRate':
            return typeof row.exchangeRate === 'number' ? String(row.exchangeRate) : '';
        case 'fxMovement': {
            const movement = getFxMovement(row.fxDebit, row.fxCredit);
            return Math.abs(movement) < 0.0001 ? '' : String(movement);
        }
        case 'fxBalance':
            return typeof row.fxBalance === 'number' ? String(row.fxBalance) : '';
        default:
            return '';
    }
};

export default function VoucherDetailModal({
    source,
    voucherNo,
    rows,
    accountOptions,
    onClose,
    onVoucherChange,
    onRowEdit,
    onBatchRowEdit,
    onAddRow,
}: VoucherDetailModalProps) {
    const [editingCell, setEditingCell] = useState<EditingCellState | null>(null);
    const [pendingEdits, setPendingEdits] = useState<PendingEditMap>({});
    const [isSavingChanges, setIsSavingChanges] = useState(false);
    const [accountPickerRowKey, setAccountPickerRowKey] = useState<string | null>(null);
    const [accountPickerQuery, setAccountPickerQuery] = useState('');
    const [showAddRowForm, setShowAddRowForm] = useState(false);
    const [isAddingRow, setIsAddingRow] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [minimizedVoucherKey, setMinimizedVoucherKey] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [virtualScrollTop, setVirtualScrollTop] = useState(0);
    const [virtualViewportHeight, setVirtualViewportHeight] = useState(0);

    const canEdit = !!onRowEdit || !!onBatchRowEdit;

    const effectiveAccountOptions = useMemo<VoucherAccountOption[]>(() => {
        const map = new Map<string, string>();
        (accountOptions || []).forEach((option) => {
            const code = String(option.code || '').trim();
            if (!code) return;
            map.set(code, String(option.name || '').trim());
        });
        rows.forEach((row) => {
            const code = String(row.accountCode || '').trim();
            if (!code) return;
            if (!map.has(code)) {
                map.set(code, String(row.accountName || '').trim());
            }
        });
        return Array.from(map.entries())
            .map(([code, name]) => ({ code, name }))
            .sort((left, right) => {
                const codeCompare = left.code.localeCompare(right.code, 'tr-TR');
                if (codeCompare !== 0) return codeCompare;
                return left.name.localeCompare(right.name, 'tr-TR');
            });
    }, [accountOptions, rows]);

    const [addRowDraft, setAddRowDraft] = useState<AddRowDraft>(() => (
        createInitialAddRowDraft(voucherNo, effectiveAccountOptions[0])
    ));

    const rowByKey = useMemo(() => {
        const map = new Map<string, VoucherDetailRow>();
        rows.forEach((row) => {
            map.set(buildRowKey(row), row);
        });
        return map;
    }, [rows]);

    const pendingCount = useMemo(() => Object.keys(pendingEdits).length, [pendingEdits]);

    const getPendingEdit = (rowKey: string, field: VoucherEditField): VoucherEditRequest | undefined => {
        return pendingEdits[buildPendingEditKey(rowKey, field)];
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        container.scrollTop = 0;

        const frameId = window.requestAnimationFrame(() => {
            setVirtualScrollTop(container.scrollTop || 0);
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [voucherNo]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const updateViewport = () => {
            setVirtualViewportHeight(container.clientHeight || 0);
        };

        updateViewport();
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => updateViewport());
            observer.observe(container);
            return () => observer.disconnect();
        }

        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, [voucherNo, showAddRowForm, errorMessage]);

    const handleCloseRequest = () => {
        if (pendingCount > 0) {
            const shouldClose = window.confirm('Kaydedilmemis degisiklikler var. Kaydetmeden cikilsin mi?');
            if (!shouldClose) return;
        }
        setMinimizedVoucherKey(null);
        onClose();
    };

    const isMinimized = Boolean(voucherNo && minimizedVoucherKey === voucherNo);

    useEscapeKey(() => {
        if (accountPickerRowKey) {
            setAccountPickerRowKey(null);
            setAccountPickerQuery('');
            return;
        }
        if (editingCell) {
            setEditingCell(null);
            return;
        }
        if (showAddRowForm) {
            setShowAddRowForm(false);
            return;
        }
        handleCloseRequest();
    }, !!voucherNo && !isMinimized);

    if (!voucherNo) return null;

    if (isMinimized) {
        return createPortal(
            <div className="fixed bottom-3 right-[380px] z-[215] w-[360px] rounded-xl border border-slate-700 bg-[#0b1220]/95 shadow-2xl backdrop-blur-sm">
                <div className="px-3 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Fis Detayi</p>
                        <p className="text-sm text-blue-300 font-mono truncate" title={voucherNo}>{voucherNo}</p>
                        <p className="text-[11px] text-slate-500">
                            {rows.length} satir | Bekleyen degisiklik: {pendingCount}
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setMinimizedVoucherKey(null)}
                            className="px-2.5 py-1.5 rounded border border-blue-500/40 text-blue-200 text-xs font-semibold hover:bg-blue-500/10 transition-colors"
                        >
                            Ac
                        </button>
                        <button
                            type="button"
                            onClick={handleCloseRequest}
                            className="p-1.5 rounded border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 transition-colors"
                            title="Kapat"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    const hasForexData = rows.some((row) => (
        hasForexContent(row.currencyCode, row.exchangeRate, row.fxDebit, row.fxCredit, row.fxBalance)
    ));

    const totals = rows.reduce(
        (accumulator, row) => {
            accumulator.debit += row.debit;
            accumulator.credit += row.credit;
            return accumulator;
        },
        { debit: 0, credit: 0 }
    );
    const tableMinWidthClass = hasForexData ? 'min-w-[1260px]' : 'min-w-[1020px]';
    const tableColumnCount = hasForexData ? 11 : 7;
    const shouldVirtualizeRows = rows.length >= VIRTUALIZATION_ROW_THRESHOLD;
    const rowCapacity = Math.max(1, Math.ceil(Math.max(virtualViewportHeight, VIRTUAL_ROW_HEIGHT) / VIRTUAL_ROW_HEIGHT));
    const virtualStartIndex = shouldVirtualizeRows
        ? Math.max(0, Math.floor(virtualScrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN)
        : 0;
    const virtualEndIndex = shouldVirtualizeRows
        ? Math.min(rows.length, virtualStartIndex + rowCapacity + (VIRTUAL_OVERSCAN * 2))
        : rows.length;
    const visibleRows = shouldVirtualizeRows ? rows.slice(virtualStartIndex, virtualEndIndex) : rows;
    const topSpacerHeight = shouldVirtualizeRows ? virtualStartIndex * VIRTUAL_ROW_HEIGHT : 0;
    const bottomSpacerHeight = shouldVirtualizeRows
        ? Math.max(0, (rows.length - virtualEndIndex) * VIRTUAL_ROW_HEIGHT)
        : 0;

    const filteredAccountOptions = effectiveAccountOptions.filter((option) => {
        return matchesSearchAcrossFields(accountPickerQuery, [option.code, option.name]);
    });

    const startCellEdit = (row: VoucherDetailRow, field: EditableCellField) => {
        if (!canEdit) return;
        setErrorMessage(null);
        const rowKey = buildRowKey(row);
        const pending = getPendingEdit(rowKey, field);
        setEditingCell({
            rowKey,
            field,
            value: pending?.value ?? getEditableCellInitialValue(row, field),
        });
    };

    const cancelCellEdit = () => {
        setEditingCell(null);
    };

    const commitCellEdit = () => {
        if (!editingCell) return;
        if (!canEdit) {
            setEditingCell(null);
            return;
        }

        const targetRow = rowByKey.get(editingCell.rowKey);
        if (!targetRow) {
            setEditingCell(null);
            return;
        }

        const request: VoucherEditRequest = {
            locator: {
                source: targetRow.source,
                accountCode: targetRow.sourceAccountCode,
                transactionIndex: targetRow.sourceTransactionIndex,
                transactionId: targetRow.sourceTransactionId,
                voucherNo: targetRow.voucherNo,
            },
            field: editingCell.field,
            value: editingCell.value,
        };

        const originalValue = getEditableCellInitialValue(targetRow, editingCell.field);
        const pendingKey = buildPendingEditKey(editingCell.rowKey, editingCell.field);
        setPendingEdits((current) => {
            const next = { ...current };
            if (request.value === originalValue) {
                delete next[pendingKey];
                return next;
            }
            next[pendingKey] = request;
            return next;
        });
        setEditingCell(null);
    };

    const selectAccountForRow = (option: VoucherAccountOption) => {
        if (!canEdit || !accountPickerRowKey) return;

        const targetRow = rowByKey.get(accountPickerRowKey);
        if (!targetRow) {
            setAccountPickerRowKey(null);
            setAccountPickerQuery('');
            return;
        }

        const request: VoucherEditRequest = {
            locator: {
                source: targetRow.source,
                accountCode: targetRow.sourceAccountCode,
                transactionIndex: targetRow.sourceTransactionIndex,
                transactionId: targetRow.sourceTransactionId,
                voucherNo: targetRow.voucherNo,
            },
            field: 'account',
            value: option.code,
            targetAccountCode: option.code,
            targetAccountName: option.name,
        };

        const isSameAccount = (
            option.code === targetRow.accountCode &&
            (option.name || '') === (targetRow.accountName || '')
        );
        const pendingKey = buildPendingEditKey(accountPickerRowKey, 'account');
        setPendingEdits((current) => {
            const next = { ...current };
            if (isSameAccount) {
                delete next[pendingKey];
            } else {
                next[pendingKey] = request;
            }
            return next;
        });

        setAccountPickerRowKey(null);
        setAccountPickerQuery('');
    };

    const resetAddRowForm = () => {
        setAddRowDraft(createInitialAddRowDraft(voucherNo, effectiveAccountOptions[0]));
    };

    const toggleAddRowForm = () => {
        setErrorMessage(null);
        if (!showAddRowForm) {
            setAddRowDraft((current) => ({
                ...current,
                voucherNo: current.voucherNo || String(voucherNo || '').trim(),
                documentNo: current.documentNo || String(voucherNo || '').trim(),
            }));
        }
        setShowAddRowForm((current) => !current);
    };

    const handleAddRow = async () => {
        if (!onAddRow) return;
        setErrorMessage(null);
        setIsAddingRow(true);

        const result = await onAddRow({
            source,
            voucherNo: addRowDraft.voucherNo,
            accountCode: addRowDraft.accountCode,
            accountName: addRowDraft.accountName,
            date: addRowDraft.date,
            documentNo: addRowDraft.documentNo,
            description: addRowDraft.description,
            debit: addRowDraft.debit,
            credit: addRowDraft.credit,
            currencyCode: addRowDraft.currencyCode,
            exchangeRate: addRowDraft.exchangeRate,
            fxMovement: addRowDraft.fxMovement,
            fxBalance: addRowDraft.fxBalance,
        });

        setIsAddingRow(false);
        if (!result.ok) {
            setErrorMessage(result.error || 'Satir eklenemedi.');
            return;
        }

        setShowAddRowForm(false);
        resetAddRowForm();
        if (result.focusVoucherNo) {
            onVoucherChange?.(result.focusVoucherNo);
        }
    };

    const clearPendingEdits = () => {
        setPendingEdits({});
        setEditingCell(null);
    };

    const handleSavePendingEdits = async () => {
        if (!canEdit) return;
        const requests = Object.values(pendingEdits);
        if (!requests.length) return;

        setErrorMessage(null);
        setIsSavingChanges(true);

        let focusVoucherNo: string | undefined;
        if (onBatchRowEdit) {
            const result = await onBatchRowEdit(requests);
            if (!result.ok) {
                setErrorMessage(result.error || 'Degisiklikler kaydedilemedi.');
                setIsSavingChanges(false);
                return;
            }
            if (result.focusVoucherNo) {
                focusVoucherNo = result.focusVoucherNo;
            }
        } else if (onRowEdit) {
            for (const request of requests) {
                const result = await onRowEdit(request);
                if (!result.ok) {
                    setErrorMessage(result.error || 'Degisiklikler kaydedilemedi.');
                    setIsSavingChanges(false);
                    return;
                }
                if (result.focusVoucherNo) {
                    focusVoucherNo = result.focusVoucherNo;
                }
            }
        }

        setIsSavingChanges(false);
        setPendingEdits({});
        if (focusVoucherNo && focusVoucherNo !== voucherNo) {
            onVoucherChange?.(focusVoucherNo);
        }
    };

    const renderEditableCell = (
        row: VoucherDetailRow,
        field: EditableCellField,
        displayValue: string,
        className: string,
        inputClassName: string
    ) => {
        const rowKey = buildRowKey(row);
        const isEditing = editingCell?.rowKey === rowKey && editingCell.field === field;
        const pending = getPendingEdit(rowKey, field);
        const hasPending = !!pending;
        const shownValue = pending ? pending.value : displayValue;

        if (isEditing) {
            return (
                <input
                    autoFocus
                    type={field === 'date' ? 'date' : 'text'}
                    value={editingCell.value}
                    onChange={(event) => {
                        const nextValue = event.target.value;
                        setEditingCell((current) => {
                            if (!current) return current;
                            if (current.rowKey !== rowKey || current.field !== field) return current;
                            return { ...current, value: nextValue };
                        });
                    }}
                    onBlur={() => void commitCellEdit()}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            commitCellEdit();
                            return;
                        }
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            event.stopPropagation();
                            cancelCellEdit();
                        }
                    }}
                    className={inputClassName}
                    disabled={isSavingChanges}
                />
            );
        }

        return (
            <button
                type="button"
                onClick={() => startCellEdit(row, field)}
                className={`${className} w-full text-left rounded px-1 -mx-1 transition-colors hover:bg-slate-800/50 ${isSavingChanges ? 'opacity-70 pointer-events-none' : ''} ${hasPending ? 'ring-1 ring-amber-500/50 bg-amber-500/10' : ''}`}
                title="Tiklayip duzenleyin"
            >
                {shownValue || '-'}
            </button>
        );
    };

    return createPortal(
        <>
            <div className="fixed inset-0 z-[220] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                <div className="bg-[#0b1220] border border-slate-700 w-full max-w-[98vw] h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-700 bg-slate-900/70 flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wide">
                                <Hash size={14} />
                                Fis Detayi
                            </div>
                            <h2 className="text-lg font-bold text-white mt-1">{voucherNo}</h2>
                            <p className="text-xs text-slate-500 mt-1">{rows.length} satir bulundu. Hucreye tiklayarak duzenleyebilirsiniz.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void handleSavePendingEdits()}
                                disabled={pendingCount === 0 || isSavingChanges}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-500/40 text-blue-200 hover:bg-blue-500/10 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSavingChanges ? 'Kaydediliyor...' : `Degisiklikleri Kaydet (${pendingCount})`}
                            </button>
                            <button
                                type="button"
                                onClick={clearPendingEdits}
                                disabled={pendingCount === 0 || isSavingChanges}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700/20 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Degisiklikleri Temizle
                            </button>
                            <button
                                type="button"
                                onClick={toggleAddRowForm}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 transition-colors text-xs font-semibold"
                            >
                                <Plus size={14} />
                                Satir Ekle / Yeni Fis
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setAccountPickerRowKey(null);
                                    setAccountPickerQuery('');
                                    setEditingCell(null);
                                    setMinimizedVoucherKey(voucherNo);
                                }}
                                className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
                                title="Alta Al"
                            >
                                <Minus size={18} />
                            </button>
                            <button
                                onClick={handleCloseRequest}
                                className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
                                title="Kapat (Esc)"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {errorMessage && (
                        <div className="px-4 py-2 border-b border-red-500/30 bg-red-500/10 text-xs text-red-200">
                            {errorMessage}
                        </div>
                    )}

                    {showAddRowForm && (
                        <div className="p-4 border-b border-slate-700 bg-slate-900/40 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                                <input
                                    value={addRowDraft.voucherNo}
                                    onChange={(event) => setAddRowDraft((current) => ({ ...current, voucherNo: event.target.value }))}
                                    placeholder="Fis No"
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    value={addRowDraft.accountCode}
                                    onChange={(event) => {
                                        const nextCode = event.target.value;
                                        const matched = effectiveAccountOptions.find((option) => option.code === nextCode);
                                        setAddRowDraft((current) => ({
                                            ...current,
                                            accountCode: nextCode,
                                            accountName: matched ? matched.name : current.accountName,
                                        }));
                                    }}
                                    placeholder="Hesap Kodu"
                                    list="voucher-account-options"
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    value={addRowDraft.accountName}
                                    onChange={(event) => setAddRowDraft((current) => ({ ...current, accountName: event.target.value }))}
                                    placeholder="Hesap Adi"
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    type="date"
                                    value={addRowDraft.date}
                                    onChange={(event) => setAddRowDraft((current) => ({ ...current, date: event.target.value }))}
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    value={addRowDraft.debit}
                                    onChange={(event) => setAddRowDraft((current) => ({ ...current, debit: event.target.value }))}
                                    placeholder="Borc"
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    value={addRowDraft.credit}
                                    onChange={(event) => setAddRowDraft((current) => ({ ...current, credit: event.target.value }))}
                                    placeholder="Alacak"
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                                <input
                                    value={addRowDraft.documentNo}
                                    onChange={(event) => setAddRowDraft((current) => ({ ...current, documentNo: event.target.value }))}
                                    placeholder="Evrak No"
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    value={addRowDraft.description}
                                    onChange={(event) => setAddRowDraft((current) => ({ ...current, description: event.target.value }))}
                                    placeholder="Aciklama"
                                    className="md:col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    value={addRowDraft.currencyCode}
                                    onChange={(event) => setAddRowDraft((current) => ({ ...current, currencyCode: event.target.value }))}
                                    placeholder="Doviz"
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    value={addRowDraft.exchangeRate}
                                    onChange={(event) => setAddRowDraft((current) => ({ ...current, exchangeRate: event.target.value }))}
                                    placeholder="Kur"
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    value={addRowDraft.fxMovement}
                                    onChange={(event) => setAddRowDraft((current) => ({ ...current, fxMovement: event.target.value }))}
                                    placeholder="Doviz Hareket (+/-)"
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    value={addRowDraft.fxBalance}
                                    onChange={(event) => setAddRowDraft((current) => ({ ...current, fxBalance: event.target.value }))}
                                    placeholder="Doviz Bakiye"
                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <datalist id="voucher-account-options">
                                {effectiveAccountOptions.map((option) => (
                                    <option key={`${option.code}-${option.name}`} value={option.code}>
                                        {option.code} - {option.name}
                                    </option>
                                ))}
                            </datalist>
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddRowForm(false);
                                        resetAddRowForm();
                                    }}
                                    className="px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-slate-500 transition-colors text-xs font-semibold"
                                >
                                    Vazgec
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleAddRow()}
                                    className="px-3 py-1.5 rounded border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 transition-colors text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                    disabled={isAddingRow}
                                >
                                    {isAddingRow ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div
                        ref={scrollContainerRef}
                        onScroll={(event) => setVirtualScrollTop(event.currentTarget.scrollTop)}
                        className="flex-1 overflow-auto custom-scrollbar bg-slate-900/50"
                    >
                        <table className={`w-full ${tableMinWidthClass} text-left border-collapse table-fixed text-[11px] sm:text-xs`}>
                            <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="p-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-24">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} /> Tarih
                                        </div>
                                    </th>
                                    <th className="p-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-20">Hesap</th>
                                    <th className="p-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-44">Hesap Adi</th>
                                    <th className="p-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-28">Evrak No</th>
                                    <th className="p-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Aciklama</th>
                                    <th className="p-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-28">Borc</th>
                                    <th className="p-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-28">Alacak</th>
                                    {hasForexData && (
                                        <>
                                            <th className="p-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-20">Dvz</th>
                                            <th className="p-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-20">Kur</th>
                                            <th className="p-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-28">Doviz Hareket</th>
                                            <th className="p-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-28">Doviz Bakiye</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {topSpacerHeight > 0 && (
                                    <tr aria-hidden="true">
                                        <td colSpan={tableColumnCount} style={{ height: topSpacerHeight, padding: 0, border: 'none' }} />
                                    </tr>
                                )}
                                {visibleRows.map((row) => {
                                    const rowKey = buildRowKey(row);
                                    const pendingAccountEdit = getPendingEdit(rowKey, 'account');
                                    const shownAccountCode = pendingAccountEdit?.targetAccountCode || row.accountCode;
                                    const shownAccountName = pendingAccountEdit?.targetAccountName || row.accountName;
                                    const hasPendingAccount = !!pendingAccountEdit;
                                    const fxMovementLabel = formatSignedFxMovement(row.fxDebit, row.fxCredit);
                                    const showForexRow = hasForexContent(
                                        row.currencyCode,
                                        row.exchangeRate,
                                        row.fxDebit,
                                        row.fxCredit,
                                        row.fxBalance
                                    );
                                    return (
                                        <tr key={rowKey} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="p-2.5 text-slate-300 font-mono whitespace-nowrap">
                                                {renderEditableCell(row, 'date', formatDate(row.date), 'text-slate-300 font-mono whitespace-nowrap', 'w-full bg-slate-900 border border-blue-500/40 rounded px-1.5 py-1 text-xs text-slate-100 focus:outline-none')}
                                            </td>
                                            <td className="p-2.5 text-blue-300 font-mono whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!canEdit || isSavingChanges) return;
                                                        setErrorMessage(null);
                                                        setAccountPickerRowKey(rowKey);
                                                        setAccountPickerQuery('');
                                                    }}
                                                    className={`w-full text-left rounded px-1 -mx-1 transition-colors hover:bg-slate-800/50 ${isSavingChanges ? 'opacity-70 pointer-events-none' : ''} ${hasPendingAccount ? 'ring-1 ring-amber-500/50 bg-amber-500/10' : ''}`}
                                                    title="Hesap secmek icin tiklayin"
                                                >
                                                    {shownAccountCode}
                                                </button>
                                            </td>
                                            <td className="p-2.5 text-slate-300">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!canEdit || isSavingChanges) return;
                                                        setErrorMessage(null);
                                                        setAccountPickerRowKey(rowKey);
                                                        setAccountPickerQuery('');
                                                    }}
                                                    className={`w-full text-left rounded px-1 -mx-1 transition-colors hover:bg-slate-800/50 truncate ${isSavingChanges ? 'opacity-70 pointer-events-none' : ''} ${hasPendingAccount ? 'ring-1 ring-amber-500/50 bg-amber-500/10' : ''}`}
                                                    title={shownAccountName || ''}
                                                >
                                                    {shownAccountName || '-'}
                                                </button>
                                            </td>
                                            <td className="p-2.5 text-slate-300 font-mono break-all">
                                                {renderEditableCell(row, 'documentNo', String(row.documentNo || '-'), 'text-slate-300 font-mono break-all', 'w-full bg-slate-900 border border-blue-500/40 rounded px-1.5 py-1 text-xs text-slate-100 focus:outline-none')}
                                            </td>
                                            <td className="p-2.5 text-slate-300">
                                                {renderEditableCell(row, 'description', String(row.description || '-'), 'text-slate-300 truncate', 'w-full bg-slate-900 border border-blue-500/40 rounded px-1.5 py-1 text-xs text-slate-100 focus:outline-none')}
                                            </td>
                                            <td className="p-2.5 text-slate-300 font-mono text-right">
                                                {renderEditableCell(row, 'debit', row.debit > 0 ? formatCurrency(row.debit) : '-', 'text-slate-300 font-mono text-right', 'w-full bg-slate-900 border border-blue-500/40 rounded px-1.5 py-1 text-xs text-slate-100 text-right focus:outline-none')}
                                            </td>
                                            <td className="p-2.5 text-slate-300 font-mono text-right">
                                                {renderEditableCell(row, 'credit', row.credit > 0 ? formatCurrency(row.credit) : '-', 'text-slate-300 font-mono text-right', 'w-full bg-slate-900 border border-blue-500/40 rounded px-1.5 py-1 text-xs text-slate-100 text-right focus:outline-none')}
                                            </td>
                                            {hasForexData && (
                                                <>
                                                    <td className="p-2.5 text-slate-300 whitespace-nowrap">
                                                        {renderEditableCell(row, 'currencyCode', showForexRow ? (row.currencyCode || '') : '', 'text-slate-300 whitespace-nowrap', 'w-full bg-slate-900 border border-blue-500/40 rounded px-1.5 py-1 text-xs text-slate-100 focus:outline-none')}
                                                    </td>
                                                    <td className="p-2.5 text-slate-300 font-mono text-right whitespace-nowrap">
                                                        {renderEditableCell(row, 'exchangeRate', showForexRow ? formatFxNumber(row.exchangeRate) : '', 'text-slate-300 font-mono text-right whitespace-nowrap', 'w-full bg-slate-900 border border-blue-500/40 rounded px-1.5 py-1 text-xs text-slate-100 text-right focus:outline-none')}
                                                    </td>
                                                    <td className="p-2.5 text-slate-300 font-mono text-right whitespace-nowrap">
                                                        {renderEditableCell(row, 'fxMovement', showForexRow ? fxMovementLabel : '', 'text-slate-300 font-mono text-right whitespace-nowrap', 'w-full bg-slate-900 border border-blue-500/40 rounded px-1.5 py-1 text-xs text-slate-100 text-right focus:outline-none')}
                                                    </td>
                                                    <td className="p-2.5 text-slate-300 font-mono text-right whitespace-nowrap">
                                                        {renderEditableCell(row, 'fxBalance', showForexRow ? formatFxNumber(row.fxBalance) : '', 'text-slate-300 font-mono text-right whitespace-nowrap', 'w-full bg-slate-900 border border-blue-500/40 rounded px-1.5 py-1 text-xs text-slate-100 text-right focus:outline-none')}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                                {bottomSpacerHeight > 0 && (
                                    <tr aria-hidden="true">
                                        <td colSpan={tableColumnCount} style={{ height: bottomSpacerHeight, padding: 0, border: 'none' }} />
                                    </tr>
                                )}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={tableColumnCount} className="p-12 text-center text-slate-500">
                                            Bu fis numarasina ait satir bulunamadi.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t border-slate-700 bg-slate-800/30 text-xs text-slate-400 flex items-center justify-between">
                        <span>Toplam Borc: <span className="font-bold text-emerald-300">{formatCurrency(totals.debit)}</span></span>
                        <span>Toplam Alacak: <span className="font-bold text-rose-300">{formatCurrency(totals.credit)}</span></span>
                    </div>
                </div>
            </div>

            {accountPickerRowKey && (
                <div
                    className="fixed inset-0 z-[230] bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4"
                    onClick={() => {
                        setAccountPickerRowKey(null);
                        setAccountPickerQuery('');
                    }}
                >
                    <div
                        className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="p-4 border-b border-slate-700 flex items-center gap-2">
                            <Search size={15} className="text-slate-500" />
                            <input
                                autoFocus
                                value={accountPickerQuery}
                                onChange={(event) => setAccountPickerQuery(event.target.value)}
                                placeholder="Hesap kodu/adi ara (orn: 6*, 60*)"
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="max-h-[380px] overflow-auto divide-y divide-slate-800">
                            {filteredAccountOptions.map((option) => (
                                <button
                                    key={`${option.code}-${option.name}`}
                                    type="button"
                                    onClick={() => void selectAccountForRow(option)}
                                    className="w-full px-4 py-2.5 text-left hover:bg-slate-800/60 transition-colors"
                                >
                                    <span className="text-sm text-blue-300 font-mono">{option.code}</span>
                                    <span className="text-sm text-slate-200 ml-3">{option.name || '-'}</span>
                                </button>
                            ))}
                            {filteredAccountOptions.length === 0 && (
                                <div className="px-4 py-8 text-center text-sm text-slate-500">
                                    Hesap bulunamadi.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>,
        document.body
    );
}
