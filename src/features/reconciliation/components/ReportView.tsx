import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Filter, Check } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { cn } from '../../../components/common/Button';
import { applyStyledSheet } from '../../../utils/excelStyle';

import type { ReconciliationReportData } from '../../../types';

/** A single report row — keys are column headers, values are display data */
type ReportRow = Record<string, string | number | Date | null>;

interface ReportViewProps {
    reports: ReconciliationReportData;
    onReset: () => void;
}

export function ReportView({ reports, onReset }: ReportViewProps) {
    const [activeTab, setActiveTab] = useState(1);

    const downloadExcel = (data: ReportRow[], fileName: string) => {
        const formattedData = data.map(row => {
            const newRow: Record<string, unknown> = {};
            Object.entries(row).forEach(([key, val]) => {
                if (typeof val === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
                    const [d, m, y] = val.split('.').map(Number);
                    newRow[key] = new Date(Date.UTC(y, m - 1, d));
                } else {
                    newRow[key] = val;
                }
            });
            return newRow;
        });

        const ws = XLSX.utils.json_to_sheet(formattedData, { cellDates: true });

        // Find numeric columns by checking header names for financial keywords
        const headers = formattedData.length > 0 ? Object.keys(formattedData[0]) : [];
        const numericCols = headers
            .map((h, i) => (/tutar|bor[çc]|alacak|fark|matrah|kdv/i.test(h) ? i : -1))
            .filter((i) => i >= 0);
        applyStyledSheet(ws, { headerRowIndex: 0, numericColumns: numericCols });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rapor");
        const safeName = fileName.replace(/[^a-zA-Z0-9ÇĞİÖŞÜçğıöşü]/g, '_');
        const timestamp = new Date().toLocaleDateString('tr-TR').replace(/\./g, '');
        XLSX.writeFile(wb, `${safeName}_${timestamp}.xlsx`);
    };

    const tabs = [
        { id: 1, label: 'E-Fatura Eksik', data: reports.report1, color: 'text-red-400', badge: 'bg-red-500/10 text-red-400' },
        { id: 2, label: 'Muhasebe Eksik', data: reports.report2, color: 'text-orange-400', badge: 'bg-orange-500/10 text-orange-400' },
        { id: 3, label: 'Tutar Farkları', data: reports.report3, color: 'text-cyan-400', badge: 'bg-cyan-500/10 text-cyan-400' },
        { id: 4, label: 'Hatalı Kayıtlar', data: reports.report4 || [], color: 'text-rose-400', badge: 'bg-rose-500/10 text-rose-400' }
    ];

    const currentTab = tabs.find(t => t.id === activeTab);
    const currentTabData = currentTab?.data || [];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Mutabakat Sonucu</h2>
                    <p className="text-slate-400">Analiz tamamlandı. Aşağıdaki sekmelerden detayları inceleyebilirsiniz.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={onReset} size="sm">
                        Yeni Analiz
                    </Button>
                    <Button
                        onClick={() => {
                            const wb = XLSX.utils.book_new();
                            tabs.forEach(tab => {
                                if (tab.data.length > 0) {
                                    const ws = XLSX.utils.json_to_sheet(tab.data);
                                    const hdrs = Object.keys(tab.data[0] || {});
                                    const numCols = hdrs
                                        .map((h, i) => (/tutar|bor[çc]|alacak|fark|matrah|kdv/i.test(h) ? i : -1))
                                        .filter((i) => i >= 0);
                                    applyStyledSheet(ws, { headerRowIndex: 0, numericColumns: numCols });
                                    XLSX.utils.book_append_sheet(wb, ws, tab.label.substring(0, 31));
                                }
                            });
                            XLSX.writeFile(wb, `Tam_Rapor_${Date.now()}.xlsx`);
                        }}
                        size="sm"
                        leftIcon={<Download size={18} />}
                    >
                        Tümünü İndir
                    </Button>
                </div>
            </div>

            {/* Tabs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "p-6 cursor-pointer border rounded-2xl relative overflow-hidden transition-all duration-300",
                            activeTab === tab.id
                                ? "bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/10"
                                : "bg-[var(--bg-card)] border-[var(--border-color)] hover:border-slate-600"
                        )}
                    >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{tab.label}</h4>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-4xl font-black ${tab.color}`}>{tab.data.length}</span>
                            <span className="text-slate-500 text-sm font-medium">Kayıt</span>
                        </div>
                        {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>}
                    </div>
                ))}
            </div>

            {/* Data Table Panel */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden min-h-[500px] flex flex-col shadow-xl">
                <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-slate-900/20">
                    <div className="flex items-center gap-3">
                        <Filter className="text-blue-400" size={20} />
                        <h3 className="font-bold text-lg text-white">{currentTab?.label} Listesi</h3>
                    </div>
                    <button
                        onClick={() => downloadExcel(currentTabData, currentTab?.label || 'Rapor')}
                        className="text-xs font-bold text-blue-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                        <Download size={14} /> Bu Listeyi İndir
                    </button>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/80 backdrop-blur sticky top-0 z-10">
                            <tr>
                                {currentTabData.length > 0 && Object.keys(currentTabData[0]).filter(k => !['id', 'originalRow', 'validationError', 'multipleInvoicesFound'].includes(k)).map(key => (
                                    <th key={key} className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/10">{key}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                            {currentTabData.map((row: ReportRow, i: number) => (
                                <tr key={i} className="hover:bg-blue-500/5 transition-colors">
                                    {Object.keys(row).filter(k => !['id', 'originalRow', 'validationError', 'multipleInvoicesFound'].includes(k)).map(key => {
                                        let val = row[key];
                                        if (val instanceof Date) val = val.toLocaleDateString('tr-TR');
                                        if (typeof val === 'number' && (key.toLowerCase().includes('tutar') || key.toLowerCase().includes('borç') || key.toLowerCase().includes('alacak'))) {
                                            val = val.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
                                        }
                                        return <td key={key} className="p-4 font-medium whitespace-nowrap">{val}</td>
                                    })}
                                </tr>
                            ))}
                            {currentTabData.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="p-20 text-center">
                                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                                            <Check className="text-emerald-500 w-8 h-8" />
                                        </div>
                                        <p className="text-lg font-bold text-white">Harika!</p>
                                        <p className="text-slate-500">Bu kategoride herhangi bir fark bulunamadı.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
