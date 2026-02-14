import { Calendar, Download, FileText, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { AccountDetail } from '../../common/types';

type AccountTypeMode = 'TL' | 'FOREX' | 'AUTO';
type AccountTypeSource = 'INFERRED' | 'MANUAL';

export interface AccountStatementRowIssue {
    code: string;
    message: string;
}

interface AccountStatementModalProps {
    account: AccountDetail | null;
    isForexAccount: boolean;
    inferredCurrency?: string;
    accountTypeSource?: AccountTypeSource;
    inferenceReason?: string;
    rowIssueByIndex?: Record<number, AccountStatementRowIssue>;
    onAccountTypeChange?: (mode: AccountTypeMode) => void;
    onClose: () => void;
    onVoucherClick: (voucherNo: string) => void;
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

const normalizeCurrencyCode = (currencyCode: string | undefined): string => {
    return String(currencyCode || '').trim().toLocaleUpperCase('tr-TR');
};

const isTlCurrencyCode = (currencyCode: string | undefined): boolean => {
    const normalized = normalizeCurrencyCode(currencyCode);
    if (!normalized) return false;
    return normalized === 'TL' || normalized.includes('TRY');
};

const resolveDisplayForexCurrency = (
    transactionCurrencyCode: string | undefined,
    inferredCurrency: string | undefined,
    hasFxData: boolean
): string => {
    if (!hasFxData) return '';

    const normalized = normalizeCurrencyCode(transactionCurrencyCode);
    if (normalized && !isTlCurrencyCode(normalized)) return normalized;
    return inferredCurrency || '';
};

export default function AccountStatementModal({
    account,
    isForexAccount,
    inferredCurrency,
    accountTypeSource = 'INFERRED',
    inferenceReason,
    rowIssueByIndex,
    onAccountTypeChange,
    onClose,
    onVoucherClick,
}: AccountStatementModalProps) {
    if (!account) return null;
    const hasRowIssueColumn = Object.keys(rowIssueByIndex || {}).length > 0;

    const handleDownloadExcel = async () => {
        const XLSX = await import('xlsx');

        const rows = account.transactions.map((transaction, index) => {
            const voucherNo = String(transaction.voucherNo || '').trim();
            const documentNo = String(transaction.documentNo || '').trim() || voucherNo;
            const fxMovement = getFxMovement(transaction.fxDebit, transaction.fxCredit);
            const fxMovementLabel = formatSignedFxMovement(transaction.fxDebit, transaction.fxCredit);
            const hasFxMovement = fxMovementLabel !== '';
            const hasFxBalance = typeof transaction.fxBalance === 'number' && Math.abs(transaction.fxBalance) >= 0.0001;
            const hasForexData = hasFxMovement || hasFxBalance;
            const rowIssue = rowIssueByIndex?.[index];
            const rowIssueLabel = rowIssue ? `[${rowIssue.code}] ${rowIssue.message}` : '';
            const forexCurrency = resolveDisplayForexCurrency(
                transaction.currencyCode,
                inferredCurrency,
                hasForexData
            );

            if (!isForexAccount) {
                return {
                    Tarih: formatDate(transaction.date),
                    'Fis No': voucherNo,
                    'Evrak No': documentNo,
                    Aciklama: transaction.description || '',
                    Hata: rowIssueLabel,
                    Borc: transaction.debit,
                    Alacak: transaction.credit,
                    Bakiye: typeof transaction.balance === 'number' ? transaction.balance : '',
                };
            }

            return {
                Tarih: formatDate(transaction.date),
                'Fis No': voucherNo,
                'Evrak No': documentNo,
                Aciklama: transaction.description || '',
                Hata: rowIssueLabel,
                'Borc TL': transaction.debit,
                'Alacak TL': transaction.credit,
                'Bakiye TL': typeof transaction.balance === 'number' ? transaction.balance : '',
                'Doviz Turu': hasForexData ? forexCurrency : '',
                'Doviz Hareket': hasForexData && hasFxMovement ? fxMovement : '',
                'Doviz Bakiye': hasForexData && typeof transaction.fxBalance === 'number' ? transaction.fxBalance : '',
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Ekstre');

        const safeCode = String(account.code || 'hesap').replace(/[^\w.-]+/g, '_');
        const fileDate = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `ekstre_${safeCode}_${fileDate}.xlsx`);
    };

    return createPortal(
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#0f172a] border border-slate-700 w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-2xl font-mono font-bold text-blue-400">{account.code}</span>
                            <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs font-bold uppercase">Hesap Ekstresi</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${isForexAccount ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30' : 'bg-slate-700 text-slate-200 border border-slate-600'}`}>
                                {isForexAccount ? 'Doviz Hesabi' : 'TL Hesabi'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${accountTypeSource === 'MANUAL' ? 'bg-amber-600/20 text-amber-200 border border-amber-500/30' : 'bg-slate-700 text-slate-300 border border-slate-600'}`}>
                                {accountTypeSource === 'MANUAL' ? 'Manuel' : 'Tahmin'}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-white mt-1">{account.name || 'Hesap Adi Yok'}</h2>
                        <p className="text-xs text-slate-400 mt-2">{inferenceReason || 'Hesap tipi manuel olarak duzeltilebilir.'}</p>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <button
                                type="button"
                                onClick={() => onAccountTypeChange?.('TL')}
                                className={`px-3 py-1.5 rounded border text-xs font-semibold transition-colors ${!isForexAccount ? 'bg-slate-200 text-slate-900 border-slate-100' : 'bg-slate-900/60 text-slate-200 border-slate-600 hover:border-slate-400'}`}
                            >
                                TL
                            </button>
                            <button
                                type="button"
                                onClick={() => onAccountTypeChange?.('FOREX')}
                                className={`px-3 py-1.5 rounded border text-xs font-semibold transition-colors ${isForexAccount ? 'bg-blue-500 text-white border-blue-400' : 'bg-slate-900/60 text-slate-200 border-slate-600 hover:border-blue-400'}`}
                            >
                                Doviz
                            </button>
                            {accountTypeSource === 'MANUAL' && (
                                <button
                                    type="button"
                                    onClick={() => onAccountTypeChange?.('AUTO')}
                                    className="px-3 py-1.5 rounded border border-amber-500/40 text-amber-200 text-xs font-semibold hover:bg-amber-500/10 transition-colors"
                                >
                                    Tahmine Don
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void handleDownloadExcel()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/40 text-blue-200 hover:bg-blue-500/10 transition-colors text-xs font-semibold"
                        >
                            <Download size={14} />
                            Excel Indir
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-px bg-slate-700 p-px">
                    <div className="bg-[#0f172a] p-4">
                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Toplam Borc TL</p>
                        <p className="text-lg font-bold text-emerald-400">{formatCurrency(account.totalDebit)}</p>
                    </div>
                    <div className="bg-[#0f172a] p-4">
                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Toplam Alacak TL</p>
                        <p className="text-lg font-bold text-rose-400">{formatCurrency(account.totalCredit)}</p>
                    </div>
                    <div className="bg-[#0f172a] p-4">
                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Bakiye TL</p>
                        <p className={`text-lg font-bold ${account.balance >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                            {formatCurrency(Math.abs(account.balance))} {account.balance >= 0 ? '(B)' : '(A)'}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar bg-slate-900/50">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-36">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} /> Tarih
                                    </div>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-40">
                                    <div className="flex items-center gap-2">
                                        <FileText size={14} /> Fis No
                                    </div>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-40">
                                    Evrak No
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                                    Aciklama
                                </th>
                                {hasRowIssueColumn && (
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-64">
                                        Hata
                                    </th>
                                )}
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-36">
                                    {isForexAccount ? 'Borc TL' : 'Borc'}
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-36">
                                    {isForexAccount ? 'Alacak TL' : 'Alacak'}
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-36">
                                    {isForexAccount ? 'Bakiye TL' : 'Bakiye'}
                                </th>
                                {isForexAccount && (
                                    <>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-28">
                                            Doviz Turu
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-36">
                                            Doviz Hareket
                                        </th>
                                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-36">
                                            Doviz Bakiye
                                        </th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {account.transactions.map((transaction, index) => {
                                const voucherNo = String(transaction.voucherNo || '').trim();
                                const documentNo = String(transaction.documentNo || '').trim() || voucherNo;
                                const rowIssue = rowIssueByIndex?.[index];
                                const fxMovementLabel = formatSignedFxMovement(transaction.fxDebit, transaction.fxCredit);
                                const hasFxMovement = fxMovementLabel !== '';
                                const hasFxBalance = typeof transaction.fxBalance === 'number' && Math.abs(transaction.fxBalance) >= 0.0001;
                                const hasForexData = hasFxMovement || hasFxBalance;
                                const forexCurrency = resolveDisplayForexCurrency(
                                    transaction.currencyCode,
                                    inferredCurrency,
                                    hasForexData
                                );

                                return (
                                    <tr
                                        key={`${account.code}-${index}`}
                                        className={`${rowIssue ? 'bg-red-500/10 hover:bg-red-500/15' : 'hover:bg-slate-800/30'} transition-colors`}
                                    >
                                        <td className="p-4 text-sm text-slate-300 font-mono whitespace-nowrap">
                                            {formatDate(transaction.date)}
                                        </td>
                                        <td className="p-4 text-sm whitespace-nowrap">
                                            {voucherNo ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onVoucherClick(voucherNo)}
                                                    className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-mono"
                                                    title="Bu fisin detayini ac"
                                                >
                                                    {voucherNo}
                                                </button>
                                            ) : (
                                                <span className="text-slate-500">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-slate-300 font-mono whitespace-nowrap">
                                            {documentNo || '-'}
                                        </td>
                                        <td className="p-4 text-sm text-slate-300">{transaction.description || '-'}</td>
                                        {hasRowIssueColumn && (
                                            <td className="p-4 text-sm text-red-200">
                                                {rowIssue ? (
                                                    <span className="inline-flex items-center gap-2">
                                                        <span className="px-2 py-0.5 rounded border border-red-400/50 bg-red-500/10 text-[11px] font-bold text-red-200">
                                                            {rowIssue.code}
                                                        </span>
                                                        <span>{rowIssue.message}</span>
                                                    </span>
                                                ) : (
                                                    ''
                                                )}
                                            </td>
                                        )}
                                        <td className="p-4 text-sm text-slate-300 font-mono text-right whitespace-nowrap">
                                            {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}
                                        </td>
                                        <td className="p-4 text-sm text-slate-300 font-mono text-right whitespace-nowrap">
                                            {transaction.credit > 0 ? formatCurrency(transaction.credit) : '-'}
                                        </td>
                                        <td className="p-4 text-sm text-slate-300 font-mono text-right whitespace-nowrap">
                                            {typeof transaction.balance === 'number' ? formatCurrency(transaction.balance) : '-'}
                                        </td>
                                        {isForexAccount && (
                                            <>
                                                <td className="p-4 text-sm text-slate-300 whitespace-nowrap">
                                                    {hasForexData ? forexCurrency : ''}
                                                </td>
                                                <td className="p-4 text-sm text-slate-300 font-mono text-right whitespace-nowrap">
                                                    {hasForexData ? fxMovementLabel : ''}
                                                </td>
                                                <td className="p-4 text-sm text-slate-300 font-mono text-right whitespace-nowrap">
                                                    {hasForexData ? formatFxNumber(transaction.fxBalance) : ''}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                            {account.transactions.length === 0 && (
                                <tr>
                                    <td colSpan={(isForexAccount ? 10 : 7) + (hasRowIssueColumn ? 1 : 0)} className="p-12 text-center text-slate-500">
                                        Bu hesapta hareket bulunamadi.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-800/30 text-xs text-slate-500">
                    Toplam {account.transactionCount} hareket listelendi.
                </div>
            </div>
        </div>,
        document.body
    );
}
