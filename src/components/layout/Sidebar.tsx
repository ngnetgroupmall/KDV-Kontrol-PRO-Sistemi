import { LayoutDashboard, Upload, LifeBuoy, Settings } from 'lucide-react';
import { cn } from '../common/Button';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    version: string;
}

export default function Sidebar({ activeTab, onTabChange, version }: SidebarProps) {
    const menuItems = [
        { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
        { id: 'upload', label: 'Hızlı Yükleme', icon: Upload }, // This is the Wizard flow
    ];

    const bottomItems = [
        { id: 'support', label: 'Destek', icon: LifeBuoy },
        { id: 'settings', label: 'Ayarlar', icon: Settings },
    ];

    return (
        <aside className="fixed left-0 top-0 h-full w-[var(--sidebar-width)] bg-[var(--bg-card)] border-r border-[var(--border-color)] flex flex-col z-50 transition-all duration-300">
            {/* Brand */}
            <div className="h-[var(--header-height)] flex items-center px-6 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain rounded-lg shadow-lg shadow-blue-600/10" />
                    <div>
                        <span className="font-bold text-lg tracking-tight text-white block leading-none">KDV Kontrol</span>
                        <span className="text-[10px] text-blue-400 font-bold tracking-wider uppercase">Enterprise</span>
                    </div>
                </div>
            </div>

            {/* Menu */}
            <div className="flex-1 py-6 flex flex-col gap-1 overflow-y-auto">
                <p className="px-6 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Ana Menü</p>

                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={cn(
                            "nav-item group",
                            activeTab === item.id && "active"
                        )}
                    >
                        <item.icon size={18} className={cn("transition-colors", activeTab === item.id ? "text-blue-400" : "text-slate-400 group-hover:text-white")} />
                        <span>{item.label}</span>
                        {activeTab === item.id && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                        )}
                    </button>
                ))}

                <div className="my-4 mx-6 border-t border-[var(--border-color)]" />

                <p className="px-6 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Sistem</p>
                {bottomItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={cn(
                            "nav-item group",
                            activeTab === item.id && "active"
                        )}
                    >
                        <item.icon size={18} className={cn("transition-colors", activeTab === item.id ? "text-blue-400" : "text-slate-400 group-hover:text-white")} />
                        <span>{item.label}</span>
                    </button>
                ))}
            </div>

            {/* Footer */}
            <div className="p-4 m-4 rounded-xl bg-slate-900/50 border border-[var(--border-color)]">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                        <p className="text-xs font-bold text-slate-300">Sistem Çevrimiçi</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">v{version}</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
