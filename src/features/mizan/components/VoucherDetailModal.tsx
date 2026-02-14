import { Calendar, Hash, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface VoucherDetailRow {
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
    voucherNo: string | null;
    rows: VoucherDetailRow[];
    onClose: () => void;
}

const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
};

const formatDate = (value: Date | null | undefined): string => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('tr-TR');
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

export default function VoucherDetailModal({ voucherNo, rows, onClose }: VoucherDetailModalProps) {
    if (!voucherNo) return null;

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

    return createPortal(
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#0b1220] border border-slate-700 w-full max-w-6xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-700 bg-slate-900/70 flex items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wide">
                            <Hash size={14} />
                            Fis Detayi
                        </div>
                        <h2 className="text-xl font-bold text-white mt-1">{voucherNo}</h2>
                        <p className="text-xs text-slate-500 mt-1">{rows.length} satir bulundu.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar bg-slate-900/50">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-40">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} /> Tarih
                                    </div>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-32">Hesap</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Hesap Adi</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-40">Evrak No</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Aciklama</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-44">Borc</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-44">Alacak</th>
                                {hasForexData && (
                                    <>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-24">Dvz</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-32">Kur</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-36">Doviz Hareket</th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-36">Doviz Bakiye</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {rows.map((row, index) => {
                                const fxMovementLabel = formatSignedFxMovement(row.fxDebit, row.fxCredit);
                                const showForexRow = hasForexContent(
                                    row.currencyCode,
                                    row.exchangeRate,
                                    row.fxDebit,
                                    row.fxCredit,
                                    row.fxBalance
                                );
                                return (
                                <tr key={`${row.accountCode}-${index}`} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="p-4 text-sm text-slate-300 font-mono whitespace-nowrap">{formatDate(row.date)}</td>
                                    <td className="p-4 text-sm text-blue-300 font-mono whitespace-nowrap">{row.accountCode}</td>
                                    <td className="p-4 text-sm text-slate-300">{row.accountName || '-'}</td>
                                    <td className="p-4 text-sm text-slate-300 font-mono whitespace-nowrap">{row.documentNo || '-'}</td>
                                    <td className="p-4 text-sm text-slate-300">{row.description || '-'}</td>
                                    <td className="p-4 text-sm text-slate-300 font-mono text-right">
                                        {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                                    </td>
                                    <td className="p-4 text-sm text-slate-300 font-mono text-right">
                                        {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                                    </td>
                                    {hasForexData && (
                                        <>
                                            <td className="p-4 text-sm text-slate-300 whitespace-nowrap">{showForexRow ? (row.currencyCode || '') : ''}</td>
                                            <td className="p-4 text-sm text-slate-300 font-mono text-right whitespace-nowrap">{showForexRow ? formatFxNumber(row.exchangeRate) : ''}</td>
                                            <td className="p-4 text-sm text-slate-300 font-mono text-right whitespace-nowrap">{showForexRow ? fxMovementLabel : ''}</td>
                                            <td className="p-4 text-sm text-slate-300 font-mono text-right whitespace-nowrap">{showForexRow ? formatFxNumber(row.fxBalance) : ''}</td>
                                        </>
                                    )}
                                </tr>
                            );
                            })}
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={hasForexData ? 11 : 7} className="p-12 text-center text-slate-500">
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
        </div>,
        document.body
    );
}
