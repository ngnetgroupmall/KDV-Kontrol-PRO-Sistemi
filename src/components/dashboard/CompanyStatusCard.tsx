import { CheckCircle2, XCircle, Database } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';

export default function CompanyStatusCard() {
    const { activeCompany, activeUploads } = useCompany();

    if (!activeCompany) return null;

    const checks = [
        {
            label: 'E-Fatura Dosyası',
            ok: activeUploads.reconciliation.eInvoiceFiles.length > 0,
        },
        {
            label: 'Muhasebe Dosyası',
            ok: activeUploads.reconciliation.accountingFiles.length > 0,
        },
        {
            label: 'Kebir Analizi',
            ok: !!activeCompany.kebirAnalysis,
        },
        {
            label: 'Cari Hesap (SMMM)',
            ok: !!activeUploads.currentAccount.smmmFile,
        },
        {
            label: 'Cari Hesap (Firma)',
            ok: !!activeUploads.currentAccount.firmaFile,
        },
    ];

    const readyCount = checks.filter(c => c.ok).length;

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <Database size={20} className="text-indigo-400" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm">{activeCompany.name}</h3>
                    <p className="text-[10px] text-slate-500">Veri durumu — {readyCount}/{checks.length} hazır</p>
                </div>
            </div>

            <div className="space-y-2">
                {checks.map((check) => (
                    <div key={check.label} className="flex items-center gap-2 text-xs">
                        {check.ok ? (
                            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        ) : (
                            <XCircle size={14} className="text-slate-600 shrink-0" />
                        )}
                        <span className={check.ok ? 'text-slate-300' : 'text-slate-500'}>
                            {check.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${(readyCount / checks.length) * 100}%` }}
                />
            </div>
        </div>
    );
}
