import type { KebirAnalysisResult, AccountDetail } from '../../common/types';
import { formatCurrency } from '../../../utils/formatters';
import { Card } from '../../../components/common/Card';
import { BarChart2, Hash, Layers, PieChart, TrendingUp, RefreshCw, Activity, Bug, AlertTriangle, FileText } from 'lucide-react';
import { useState } from 'react';
import AccountDetailModal from './AccountDetailModal';
import MizanModal from './MizanModal';

interface AnalysisDashboardProps {
    data: KebirAnalysisResult;
    onReset: () => void;
}

export default function AnalysisDashboard({ data, onReset }: AnalysisDashboardProps) {
    const [chartMode, setChartMode] = useState<'VOLUME' | 'COUNT'>('COUNT');
    const [showDebug, setShowDebug] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<AccountDetail | null>(null);
    const [showMizan, setShowMizan] = useState(false);



    const maxMonthVal = Math.max(...data.monthlyDensity.map(m => chartMode === 'VOLUME' ? m.volume : m.count));

    // Calculate Active Months (months with data)
    const activeMonthCount = data.monthlyDensity.filter(m => m.count > 0).length || 1;

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header / Summary */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Analiz Sonuçları</h2>
                    <p className="text-slate-400">
                        {activeMonthCount} aylık veri analizi
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* Mizan Button */}
                    <button
                        onClick={() => setShowMizan(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                    >
                        <FileText size={16} />
                        Genel Mizanı İncele
                    </button>

                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        className={`p-2 rounded-lg transition-colors ${showDebug ? 'bg-red-500/20 text-red-500' : 'bg-slate-800 text-slate-500'}`}
                        title="Hata Ayıklama Bilgisi"
                    >
                        <Bug size={16} />
                    </button>
                    <button
                        onClick={onReset}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-700"
                    >
                        <RefreshCw size={16} />
                        Yeni Analiz
                    </button>
                </div>
            </div>

            {/* DEBUG INFO PANEL */}
            {showDebug && data.debugMeta && (
                <Card className="p-4 border-l-4 border-l-red-500 bg-red-500/10 mb-4 font-mono text-xs text-slate-300 overflow-x-auto">
                    <h4 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                        <AlertTriangle size={14} /> Debug Bilgileri
                    </h4>
                    <p><span className="text-slate-500">Dosya:</span> {data.debugMeta.fileName}</p>
                    <p><span className="text-slate-500">Tarih Metodu:</span> {data.debugMeta.dateMethod || 'Bilinmiyor'}</p>
                    <p><span className="text-slate-500">Col Map:</span> {JSON.stringify(data.debugMeta.detectedColumns)}</p>
                    <p><span className="text-slate-500">Ayrıştırılan Tarih:</span> {data.debugMeta.parsedDateCount || 0} adet</p>
                    {data.debugMeta.sampleDates && data.debugMeta.sampleDates.length > 0 && (
                        <div className="mt-2 text-[10px] text-yellow-400">
                            <p className="font-bold">Örnek Tarih Değerleri:</p>
                            {data.debugMeta.sampleDates.map((val: string, idx: number) => (
                                <p key={idx} className="ml-2">{idx + 1}. {val}</p>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-6 border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-3 mb-2">
                        <Layers className="text-blue-500" size={20} />
                        <h4 className="text-slate-400 text-sm font-bold uppercase">Toplam İşlem</h4>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{data.totalLines.toLocaleString()}</p>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                        <span>Aylık Ort: <span className="text-blue-400 font-bold">{Math.round(data.totalLines / activeMonthCount).toLocaleString()}</span></span>
                    </div>
                </Card>

                {/* Combined Account & Voucher Count Card */}
                <Card className="p-6 border-l-4 border-l-purple-500 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4">
                        <Hash className="text-purple-500" size={20} />
                        <h4 className="text-slate-400 text-sm font-bold uppercase">Varlık Sayıları</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-2xl font-bold text-white">{data.uniqueVoucherCount ? data.uniqueVoucherCount.toLocaleString() : '-'}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Tekil Fiş</p>
                            <p className="text-[9px] text-purple-400 font-medium">Ort: {data.avgUniqueVouchers}</p>
                        </div>
                        <div className="text-right border-l border-slate-700/50 pl-4">
                            <p className="text-2xl font-bold text-white">{data.uniqueAccountCount}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Tekil Hesap</p>
                            <p className="text-[9px] text-purple-400 font-medium">Ort: {data.avgUniqueAccounts}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-emerald-500">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="text-emerald-500" size={20} />
                        <h4 className="text-slate-400 text-sm font-bold uppercase">Toplam Hacim</h4>
                    </div>
                    <p className="text-xl font-bold text-white truncate mb-1" title={formatCurrency(data.totalDebit)}>
                        {formatCurrency(data.totalDebit)}
                    </p>
                    <p className="text-xs text-slate-500">
                        Aylık Ort: <span className="text-emerald-400 font-bold">{formatCurrency(data.totalDebit / activeMonthCount)}</span>
                    </p>
                </Card>

                <Card className="p-6 border-l-4 border-l-orange-500">
                    <div className="flex items-center gap-3 mb-2">
                        <PieChart className="text-orange-500" size={20} />
                        <h4 className="text-slate-400 text-sm font-bold uppercase">İş Yükü Puanı</h4>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                        <p className="text-3xl font-bold text-white">{data.complexityScore}</p>
                        <span className="text-lg text-slate-500 font-medium mb-1">/ 10</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                            style={{ width: `${(data.complexityScore / 10) * 100}%` }}
                        />
                    </div>
                </Card>
            </div>

            {/* Key Accounts Focus Section */}
            <div>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Activity className="text-red-400" size={20} />
                    Kritik Hesap Analizi
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['102', '191', '391', '601'].map(code => {
                        const stats = data.keyAccounts && data.keyAccounts[code] ? data.keyAccounts[code] : { count: 0, volume: 0 };
                        const avgVol = stats.volume / activeMonthCount;
                        return (
                            <Card key={code} className="p-4 bg-slate-800/40 border-slate-700">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="bg-slate-700 text-white px-2 py-1 rounded font-mono font-bold text-sm">
                                        {code}
                                    </div>
                                    <div className="text-xs text-slate-400 font-bold uppercase">
                                        {code === '102' ? 'Bankalar' :
                                            code === '191' ? 'İnd. KDV' :
                                                code === '391' ? 'Hes. KDV' : 'Yurtdışı Satış'}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-4 mt-4">
                                    <div className="flex items-end justify-between border-b border-slate-700/50 pb-2">
                                        <div>
                                            <p className="text-xl font-bold text-white">{stats.count}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Toplam Adet</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-blue-400">{Math.round(stats.count / activeMonthCount)}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Aylık Ort.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-emerald-400">{formatCurrency(stats.volume)}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Toplam Hacim</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-emerald-500">{formatCurrency(avgVol)}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Aylık Ort.</p>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Monthly Distribution Chart (Custom CSS Bars) */}
                <Card className="lg:col-span-2 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <BarChart2 className="text-slate-400" size={20} />
                            <h3 className="font-bold text-white">Aylık İşlem Yoğunluğu</h3>
                        </div>
                        {/* CHART TOGGLE */}
                        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                            <button
                                onClick={() => setChartMode('VOLUME')}
                                className={`px-3 py-1 text-xs font-bold rounded transition-colors ${chartMode === 'VOLUME' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                Hacim
                            </button>
                            <button
                                onClick={() => setChartMode('COUNT')}
                                className={`px-3 py-1 text-xs font-bold rounded transition-colors ${chartMode === 'COUNT' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                Adet
                            </button>
                        </div>
                    </div>

                    {data.monthlyDensity.every(m => m.count === 0) ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-700/50 rounded-xl">
                            <p>Verilerde tarih bilgisi bulunamadı.</p>
                            <button onClick={() => setShowDebug(true)} className="text-blue-400 hover:underline mt-2 text-xs">
                                Neden? (Debug)
                            </button>
                        </div>
                    ) : (
                        <div className="h-64 flex items-end gap-1">
                            {data.monthlyDensity.map((m, idx) => {
                                const val = chartMode === 'VOLUME' ? m.volume : m.count;
                                const heightPercent = maxMonthVal > 0 ? (val / maxMonthVal) * 100 : 0;
                                const barHeight = Math.max(heightPercent, val > 0 ? 5 : 0);

                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center group h-full">
                                        {/* Bar container - takes remaining space */}
                                        <div className="flex-1 w-full flex items-end justify-center relative">
                                            {/* Tooltip */}
                                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none transition-opacity z-10 border border-slate-700 shadow-xl">
                                                <div className="font-bold text-white">{['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][idx]}</div>
                                                <div className={`font-mono ${chartMode === 'VOLUME' ? 'text-emerald-400' : 'text-blue-400'}`}>
                                                    {chartMode === 'VOLUME' ? formatCurrency(m.volume) : m.count.toLocaleString() + ' Adet'}
                                                </div>
                                                <div className="text-slate-400">{chartMode === 'VOLUME' ? m.count.toLocaleString() + ' işlem' : formatCurrency(m.volume)}</div>
                                            </div>

                                            {/* Actual bar */}
                                            <div
                                                className="w-full max-w-[40px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all duration-300 hover:from-blue-500 hover:to-blue-300"
                                                style={{ height: `${barHeight}%` }}
                                            />
                                        </div>

                                        {/* Month label */}
                                        <span className="text-[10px] text-slate-500 mt-1 font-medium">
                                            {['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][idx]}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>

                {/* Top Accounts - COMPACT VIEW */}
                <Card className="p-0 overflow-hidden flex flex-col h-[400px]">
                    <div className="p-4 border-b border-[var(--border-color)] bg-slate-800/30">
                        <h3 className="font-bold text-white">En Aktif Ana Hesaplar</h3>
                    </div>
                    <div className="divide-y divide-[var(--border-color)] overflow-y-auto custom-scrollbar flex-1">
                        {data.topAccounts.slice(0, 20).map((acc, idx) => {
                            return (
                                <div key={idx} className="px-4 py-3 hover:bg-slate-800/30 transition-colors group flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-blue-400 font-bold">{acc.code}</span>
                                            {idx < 3 && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded font-bold">{idx + 1}</span>}
                                            <span className="text-sm text-slate-300 font-medium truncate max-w-[120px]" title={acc.name || ''}>
                                                {acc.name || '-'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                                            {formatCurrency(acc.volume)}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            {acc.count} İşlem
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            {/* MODALS */}
            {showMizan && data.mizan && (
                <MizanModal
                    data={data.mizan}
                    onClose={() => setShowMizan(false)}
                    onSelectAccount={(acc) => {
                        setSelectedAccount(acc);
                    }}
                />
            )}

            {selectedAccount && (
                <AccountDetailModal
                    account={selectedAccount}
                    onClose={() => setSelectedAccount(null)}
                />
            )}
        </div>
    );
}
