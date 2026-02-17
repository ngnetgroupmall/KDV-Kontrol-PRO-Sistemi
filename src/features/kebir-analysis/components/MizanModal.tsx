import { X, Search, Activity, FileText } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { AccountDetail } from '../../common/types';
import { formatCurrency } from '../../../utils/formatters';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

interface MizanModalProps {
    data: AccountDetail[];
    onClose: () => void;
    onSelectAccount: (account: AccountDetail) => void;
}

export default function MizanModal({ data, onClose, onSelectAccount }: MizanModalProps) {
    useEscapeKey(onClose, true);

    const [search, setSearch] = useState('');



    const filtered = useMemo(() => {
        return data.filter(acc =>
            acc.code.includes(search.trim()) ||
            acc.name.toLowerCase().includes(search.toLowerCase().trim())
        );
    }, [data, search]);

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#0f172a] border border-slate-700 w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-700 p-2 rounded-lg">
                            <FileText className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Genel Mizan</h2>
                            <p className="text-xs text-slate-400">Toplam {data.length} hesap</p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="flex-1 max-w-md relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Hesap Kodu veya Adı Ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 p-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto custom-scrollbar bg-slate-900/50">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-32">Hesap Kodu</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Hesap Adı</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-40">Toplam Borç</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-40">Toplam Alacak</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right w-40">Bakiye</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filtered.map((row, idx) => (
                                <tr
                                    key={idx}
                                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                    onClick={() => onSelectAccount(row)}
                                >
                                    <td className="p-4 text-sm text-blue-400 font-mono font-bold group-hover:text-blue-300">
                                        {row.code}
                                    </td>
                                    <td className="p-4 text-sm text-slate-300 font-medium">
                                        {row.name || '-'}
                                    </td>
                                    <td className="p-4 text-sm text-slate-300 font-mono text-right opacity-80">
                                        {formatCurrency(row.totalDebit)}
                                    </td>
                                    <td className="p-4 text-sm text-slate-300 font-mono text-right opacity-80">
                                        {formatCurrency(row.totalCredit)}
                                    </td>
                                    <td className="p-4 text-sm font-mono font-bold text-right bg-slate-800/20">
                                        <span className={row.balance >= 0 ? "text-blue-400" : "text-orange-400"}>
                                            {formatCurrency(Math.abs(row.balance))} {row.balance >= 0 ? '(B)' : '(A)'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <Activity className="text-slate-600 group-hover:text-blue-400 transition-colors" size={16} />
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-500">
                                        Sonuç bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-800/30 text-xs text-slate-500 flex justify-between">
                    <span>Detayını görmek istediğiniz hesaba tıklayın.</span>
                    <span>ESC ile kapatabilirsiniz.</span>
                </div>
            </div>
        </div>
    );
}
