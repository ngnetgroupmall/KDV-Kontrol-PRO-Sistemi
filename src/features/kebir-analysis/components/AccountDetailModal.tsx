import { X, Calendar, FileText, ArrowRight } from 'lucide-react';
import type { AccountDetail } from '../../common/types';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { formatCurrency, formatDate } from '../../../utils/formatters';

interface AccountDetailModalProps {
    account: AccountDetail | null;
    onClose: () => void;
}

export default function AccountDetailModal({ account, onClose }: AccountDetailModalProps) {
    useEscapeKey(onClose, !!account);
    if (!account) return null;



    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#0f172a] border border-slate-700 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-mono font-bold text-blue-400">{account.code}</span>
                            <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs font-bold uppercase">Hesap Ekstresi</span>
                        </div>
                        <h2 className="text-xl font-bold text-white mt-1">{account.name || 'İsimsiz Hesap'}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-px bg-slate-700 p-px">
                    <div className="bg-[#0f172a] p-4">
                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Toplam Borç</p>
                        <p className="text-lg font-bold text-emerald-400">{formatCurrency(account.totalDebit)}</p>
                    </div>
                    <div className="bg-[#0f172a] p-4">
                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Toplam Alacak</p>
                        <p className="text-lg font-bold text-red-400">{formatCurrency(account.totalCredit)}</p>
                    </div>
                    <div className="bg-[#0f172a] p-4">
                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Bakiye</p>
                        <div className="flex items-center gap-2">
                            <p className={`text-lg font-bold ${account.balance >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                                {formatCurrency(Math.abs(account.balance))}
                            </p>
                            <span className="text-xs font-bold text-slate-500">{account.balance >= 0 ? '(B)' : '(A)'}</span>
                        </div>
                    </div>
                </div>

                {/* Transaction Table */}
                <div className="flex-1 overflow-auto custom-scrollbar bg-slate-900/50">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-32">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} /> Tarih
                                    </div>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-32">
                                    <div className="flex items-center gap-2">
                                        <FileText size={14} /> Fiş No
                                    </div>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Açıklama</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-40">Borç</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-40">Alacak</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {account.transactions.map((tx, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                                    <td className="p-4 text-sm text-slate-300 font-mono whitespace-nowrap">
                                        {formatDate(tx.date)}
                                    </td>
                                    <td className="p-4 text-sm text-blue-400 font-mono whitespace-nowrap">
                                        {tx.voucherNo || '-'}
                                    </td>
                                    <td className="p-4 text-sm text-slate-300 max-w-md truncate group-hover:whitespace-normal group-hover:overflow-visible">
                                        {tx.description}
                                    </td>
                                    <td className="p-4 text-sm text-slate-300 font-mono text-right">
                                        {tx.debit > 0 ? formatCurrency(tx.debit) : '-'}
                                    </td>
                                    <td className="p-4 text-sm text-slate-300 font-mono text-right">
                                        {tx.credit > 0 ? formatCurrency(tx.credit) : '-'}
                                    </td>
                                </tr>
                            ))}
                            {account.transactions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-500">
                                        Kayıt bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-800/30 text-xs text-slate-500 flex justify-between">
                    <span>Toplam {account.transactionCount} hareket listelendi.</span>
                    <span className="flex items-center gap-1">
                        Sıralama: Tarih <ArrowRight size={12} />
                    </span>
                </div>
            </div>
        </div>
    );
}
