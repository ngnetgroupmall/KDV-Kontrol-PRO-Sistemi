import { useMemo } from 'react';
import { Clock, FileEdit, Upload } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';

interface ActivityItem {
    id: string;
    icon: typeof Clock;
    iconColor: string;
    label: string;
    time: string;
}

export default function RecentActivity() {
    const { activeCompany, activeUploads } = useCompany();

    const activities = useMemo<ActivityItem[]>(() => {
        if (!activeCompany) return [];
        const items: ActivityItem[] = [];
        let idCounter = 0;

        // Voucher edit logs (most recent first)
        const editLogs = activeCompany.currentAccount?.voucherEditLogs || [];
        const recentEdits = editLogs.slice(-5).reverse();
        recentEdits.forEach((log) => {
            items.push({
                id: `edit-${idCounter++}`,
                icon: FileEdit,
                iconColor: 'text-amber-400',
                label: `${log.source} — ${log.fieldLabel || 'Düzenleme'}: ${log.voucherNo || '?'}`,
                time: log.createdAt ? new Date(log.createdAt).toLocaleString('tr-TR') : '-',
            });
        });

        // Upload indicators
        if (activeUploads.reconciliation.eInvoiceFiles.length > 0) {
            items.push({
                id: `upload-einvoice-${idCounter++}`,
                icon: Upload,
                iconColor: 'text-blue-400',
                label: `${activeUploads.reconciliation.eInvoiceFiles.length} e-fatura dosyası yüklendi`,
                time: 'Bu oturum',
            });
        }

        if (activeUploads.currentAccount.smmmFile) {
            items.push({
                id: `upload-smmm-${idCounter++}`,
                icon: Upload,
                iconColor: 'text-indigo-400',
                label: `SMMM Kebir dosyası yüklendi`,
                time: 'Bu oturum',
            });
        }

        if (activeUploads.currentAccount.firmaFile) {
            items.push({
                id: `upload-firma-${idCounter++}`,
                icon: Upload,
                iconColor: 'text-indigo-400',
                label: `Firma Kebir dosyası yüklendi`,
                time: 'Bu oturum',
            });
        }

        if (activeCompany.kebirAnalysis) {
            items.push({
                id: `kebir-${idCounter++}`,
                icon: Upload,
                iconColor: 'text-emerald-400',
                label: 'Kebir analizi tamamlandı',
                time: 'Bu oturum',
            });
        }

        return items.slice(0, 8);
    }, [activeCompany, activeUploads]);

    if (activities.length === 0) return null;

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Clock size={20} className="text-amber-400" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm">Son İşlemler</h3>
                    <p className="text-[10px] text-slate-500">{activities.length} kayıt</p>
                </div>
            </div>

            <div className="space-y-2">
                {activities.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 text-xs">
                        <item.icon size={14} className={`${item.iconColor} shrink-0 mt-0.5`} />
                        <div className="min-w-0 flex-1">
                            <p className="text-slate-300 truncate">{item.label}</p>
                            <p className="text-slate-600 text-[10px]">{item.time}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
