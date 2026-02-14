import { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, User, Monitor, Plus, Check } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { cn } from '../common/Button';

interface HeaderProps {
    isSidebarCollapsed: boolean;
}

export default function Header({ isSidebarCollapsed }: HeaderProps) {
    const { companies, activeCompany, selectCompany, createCompany } = useCompany();
    const [isCompanyMenuOpen, setIsCompanyMenuOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsCompanyMenuOpen(false);
                setIsCreating(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleCreateCompany = async () => {
        if (!newCompanyName.trim()) return;
        try {
            await createCompany(newCompanyName);
            setNewCompanyName('');
            setIsCreating(false);
            setIsCompanyMenuOpen(false);
        } catch (error) {
            console.error('Firma olusturulamadi:', error);
            const message = error instanceof Error ? error.message : 'Firma olusturulurken bir hata olustu.';
            alert(message);
        }
    };

    return (
        <header
            className={cn(
                "fixed top-0 right-0 h-[var(--header-height)] bg-[var(--bg-dark)]/90 backdrop-blur-md border-b border-[var(--border-color)] flex items-center justify-between px-8 z-40 transition-all duration-300",
                isSidebarCollapsed ? "left-[80px]" : "left-[var(--sidebar-width)]"
            )}
        >

            {/* Left: Company Selector */}
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setIsCompanyMenuOpen(!isCompanyMenuOpen)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800 hover:border-blue-500/50 transition-all group"
                >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors">
                        <Monitor size={18} />
                    </div>
                    <div className="text-left hidden md:block">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-tight">Aktif Firma</p>
                        <p className="text-sm font-bold text-white leading-tight truncate max-w-[150px]">
                            {activeCompany ? activeCompany.name : 'Firma Seçilmedi'}
                        </p>
                    </div>
                    <ChevronDown size={16} className={`text-slate-500 transition-transform duration-300 ${isCompanyMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isCompanyMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                        <div className="p-3 border-b border-slate-800">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Firmalarım</h3>
                            <div className="max-h-60 overflow-y-auto space-y-1">
                                {companies.map(company => (
                                    <button
                                        key={company.id}
                                        onClick={() => {
                                            selectCompany(company.id);
                                            setIsCompanyMenuOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between group transition-colors ${activeCompany?.id === company.id
                                                ? 'bg-blue-600 text-white'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                            }`}
                                    >
                                        <span className="truncate">{company.name}</span>
                                        {activeCompany?.id === company.id && <Check size={14} />}
                                    </button>
                                ))}
                                {companies.length === 0 && (
                                    <p className="text-slate-500 text-sm px-2 py-1">Kayıtlı firma bulunmuyor.</p>
                                )}
                            </div>
                        </div>

                        <div className="p-3 bg-slate-950/30">
                            {isCreating ? (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Firma Adı..."
                                        autoFocus
                                        value={newCompanyName}
                                        onChange={(e) => setNewCompanyName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateCompany()}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCreateCompany}
                                            disabled={!newCompanyName.trim()}
                                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold py-1.5 rounded-lg transition-colors"
                                        >
                                            Kaydet
                                        </button>
                                        <button
                                            onClick={() => setIsCreating(false)}
                                            className="px-3 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-1.5 rounded-lg transition-colors"
                                        >
                                            İptal
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600/10 hover:bg-blue-600 border border-blue-600/20 hover:border-blue-600 text-blue-400 hover:text-white transition-all text-sm font-medium"
                                >
                                    <Plus size={16} />
                                    Yeni Firma Ekle
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative hidden md:block group mr-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-blue-400 transition-colors" />
                    <input
                        type="text"
                        placeholder="İşlem veya fatura ara..."
                        className="bg-slate-900/50 border border-slate-700 text-slate-200 text-sm rounded-lg pl-10 pr-4 py-2 w-64 focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-600"
                    />
                </div>

                {/* Notifications */}
                <button className="relative p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[var(--bg-dark)]" />
                </button>

                <div className="h-6 w-px bg-slate-800 mx-2"></div>

                {/* Profile */}
                <div className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-blue-600/10 flex items-center justify-center border border-blue-600/20 text-blue-500">
                        <User size={18} />
                    </div>
                    <div className="text-right hidden lg:block">
                        <p className="text-sm font-bold text-white leading-none mb-1">Admin User</p>
                        <p className="text-[10px] text-slate-500 font-mono">Standart Lisans</p>
                    </div>
                    <ChevronDown size={14} className="text-slate-500" />
                </div>
            </div>
        </header>
    );
}
