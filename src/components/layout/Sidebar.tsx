import { LayoutDashboard, Upload, Zap, FileText, LifeBuoy, Settings, ShieldCheck } from 'lucide-react';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    version: string;
}

export default function Sidebar({ activeTab, onTabChange, version }: SidebarProps) {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'upload', label: 'Hızlı Yükleme', icon: Upload },
        { id: 'reconciliation', label: 'Akıllı Ayrıştırma', icon: Zap },
        { id: 'reports', label: 'Detaylı Rapor', icon: FileText },
    ];

    const bottomItems = [
        { id: 'support', label: 'Destek', icon: LifeBuoy },
        { id: 'settings', label: 'Ayarlar', icon: Settings },
    ];

    return (
        <aside className="fixed left-0 top-0 h-full w-[280px] bg-slate-900 border-r border-white/5 flex flex-col z-50">
            {/* Brand */}
            <div className="h-[80px] flex items-center px-8 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <ShieldCheck className="text-white w-5 h-5" />
                    </div>
                    <span className="font-bold text-xl tracking-tight text-white">KDV Kontrol</span>
                </div>
            </div>

            {/* Menu */}
            <div className="flex-1 py-8 px-4 flex flex-col gap-2 overflow-y-auto">
                <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Menü</p>

                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                        {activeTab === item.id && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                        )}
                    </button>
                ))}

                <div className="my-6 border-t border-white/5" />

                <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Diğer</p>
                {bottomItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </button>
                ))}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <div>
                        <p className="text-xs font-bold text-slate-400">Uygulama Güncel</p>
                        <p className="text-[10px] text-slate-600 font-mono mt-0.5">Teknoloji v{version}</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
