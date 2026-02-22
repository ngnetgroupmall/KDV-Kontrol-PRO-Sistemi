import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Monitor, Plus, Check, Pencil, Trash2 } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { cn } from '../common/Button';

interface HeaderProps {
    isSidebarCollapsed: boolean;
}

export default function Header({ isSidebarCollapsed }: HeaderProps) {
    const { companies, activeCompany, selectCompany, createCompany, updateCompany, deleteCompany } = useCompany();
    const [isCompanyMenuOpen, setIsCompanyMenuOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsCompanyMenuOpen(false);
                setIsCreating(false);
                setEditingId(null);
                setDeletingId(null);
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
            console.error('Firma oluşturulamadı:', error);
            const message = error instanceof Error ? error.message : 'Firma oluşturulurken bir hata oluştu.';
            alert(message);
        }
    };

    const handleRenameCompany = async (id: string) => {
        if (!editingName.trim()) return;
        const company = companies.find(c => c.id === id);
        if (!company) return;
        try {
            await updateCompany({ ...company, name: editingName.trim(), updatedAt: new Date() });
            setEditingId(null);
            setEditingName('');
        } catch (error) {
            console.error('Firma adı güncellenemedi:', error);
        }
    };

    const handleDeleteCompany = async (id: string) => {
        try {
            await deleteCompany(id);
            setDeletingId(null);
        } catch (error) {
            console.error('Firma silinemedi:', error);
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
                    <div className="absolute top-full left-0 mt-2 w-80 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                        <div className="p-3 border-b border-slate-800">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Firmalarım</h3>
                            <div className="max-h-60 overflow-y-auto space-y-1">
                                {companies.map(company => (
                                    <div key={company.id} className="group">
                                        {editingId === company.id ? (
                                            <div className="flex items-center gap-2 px-2 py-1">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameCompany(company.id)}
                                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                                                />
                                                <button onClick={() => handleRenameCompany(company.id)} className="text-green-400 hover:text-green-300 p-1"><Check size={14} /></button>
                                                <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-white p-1 text-xs">İptal</button>
                                            </div>
                                        ) : deletingId === company.id ? (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 rounded-lg">
                                                <p className="flex-1 text-xs text-red-300">Silmek istediğinize emin misiniz?</p>
                                                <button onClick={() => handleDeleteCompany(company.id)} className="text-xs text-red-400 hover:text-red-300 font-bold">Evet</button>
                                                <button onClick={() => setDeletingId(null)} className="text-xs text-slate-400 hover:text-white font-bold">Hayır</button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center">
                                                <button
                                                    onClick={() => {
                                                        selectCompany(company.id);
                                                        setIsCompanyMenuOpen(false);
                                                    }}
                                                    className={`flex-1 text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between group transition-colors ${activeCompany?.id === company.id
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                                        }`}
                                                >
                                                    <span className="truncate">{company.name}</span>
                                                    {activeCompany?.id === company.id && <Check size={14} />}
                                                </button>
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setEditingId(company.id); setEditingName(company.name); }}
                                                        className="p-1.5 rounded hover:bg-slate-700 text-slate-500 hover:text-blue-400 transition-colors"
                                                        title="Yeniden adlandır"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setDeletingId(company.id); }}
                                                        className="p-1.5 rounded hover:bg-slate-700 text-slate-500 hover:text-red-400 transition-colors"
                                                        title="Sil"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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

            {/* Right: App name badge only — cleaned up */}
            <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-mono">NG NET SMMM AI</span>
            </div>
        </header>
    );
}
