import { LayoutDashboard, Upload, LifeBuoy, Settings, ChevronLeft, ChevronRight, ShoppingCart, PieChart, FileSpreadsheet } from 'lucide-react';
import { cn } from '../common/Button';
import logo from '../../assets/logo.png';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    version: string;
    isCollapsed: boolean;
    onCollapse: (collapsed: boolean) => void;
}

export default function Sidebar({ activeTab, onTabChange, version, isCollapsed, onCollapse }: SidebarProps) {
    const menuItems = [
        { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
        { id: 'sales', label: 'Satış Kontrol', icon: Upload },
        { id: 'purchase', label: 'Alış Kontrol', icon: ShoppingCart },
        { id: 'kebir', label: 'Kebir Analizi', icon: PieChart },
        { id: 'current-account', label: 'Cari Hesap Kontrol', icon: FileSpreadsheet },
    ];

    const bottomItems = [
        { id: 'support', label: 'Destek', icon: LifeBuoy },
        { id: 'settings', label: 'Ayarlar', icon: Settings },
    ];

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 h-full bg-[var(--bg-card)] border-r border-[var(--border-color)] flex flex-col z-50 transition-all duration-300",
                isCollapsed ? "w-[80px]" : "w-[var(--sidebar-width)]"
            )}
        >
            {/* Brand */}
            <div className="h-[var(--header-height)] flex items-center px-4 md:px-6 border-b border-[var(--border-color)] overflow-hidden">
                <div className="flex items-center gap-3 min-w-max">
                    <img src={logo} alt="Logo" className="w-10 h-10 object-contain rounded-lg shadow-lg shadow-blue-600/10" />
                    <div className={cn("transition-opacity duration-300", isCollapsed ? "opacity-0 w-0" : "opacity-100")}>
                        <span className="font-bold text-lg tracking-tight text-white block leading-none">KDV Kontrol</span>
                        <span className="text-[10px] text-blue-400 font-bold tracking-wider uppercase">Enterprise</span>
                    </div>
                </div>
            </div>

            {/* Menu */}
            <div className="flex-1 py-6 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
                {!isCollapsed && <p className="px-6 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 animate-fade-in">Ana Menü</p>}

                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={cn(
                            "nav-item group relative mx-3",
                            activeTab === item.id && "active",
                            isCollapsed && "justify-center px-2"
                        )}
                        title={isCollapsed ? item.label : undefined}
                    >
                        <item.icon size={20} className={cn("transition-colors shrink-0", activeTab === item.id ? "text-blue-400" : "text-slate-400 group-hover:text-white")} />
                        <span className={cn("transition-all duration-300 whitespace-nowrap overflow-hidden", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                            {item.label}
                        </span>
                        {!isCollapsed && activeTab === item.id && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                        )}
                    </button>
                ))}

                <div className="my-4 mx-6 border-t border-[var(--border-color)]" />

                {!isCollapsed && <p className="px-6 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 animate-fade-in">Sistem</p>}
                {bottomItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={cn(
                            "nav-item group mx-3",
                            activeTab === item.id && "active",
                            isCollapsed && "justify-center px-2"
                        )}
                        title={isCollapsed ? item.label : undefined}
                    >
                        <item.icon size={20} className={cn("transition-colors shrink-0", activeTab === item.id ? "text-blue-400" : "text-slate-400 group-hover:text-white")} />
                        <span className={cn("transition-all duration-300 whitespace-nowrap overflow-hidden", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                            {item.label}
                        </span>
                    </button>
                ))}
            </div>

            {/* Collapse Button */}
            <button
                onClick={() => onCollapse(!isCollapsed)}
                className="absolute -right-3 top-20 bg-blue-600 text-white rounded-full p-1 shadow-lg hover:bg-blue-500 transition-colors z-[60]"
            >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* Footer */}
            <div className={cn("p-4 m-4 rounded-xl bg-slate-900/50 border border-[var(--border-color)] overflow-hidden transition-all duration-300", isCollapsed ? "p-2 m-2" : "")}>
                <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center" : "")}>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <div className={cn("transition-opacity duration-300", isCollapsed ? "hidden" : "block")}>
                        <p className="text-xs font-bold text-slate-300 whitespace-nowrap">Sistem Çevrimiçi</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">v{version}</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
