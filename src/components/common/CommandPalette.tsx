import { useEffect, useState, useRef, useMemo } from 'react';
import {
    LayoutDashboard, Database, FileArchive, ClipboardCheck, PieChart,
    Scale, Calculator, FileClock, FileText, FileSpreadsheet, Search,
    Command,
} from 'lucide-react';

interface CommandPaletteProps {
    onNavigate: (tab: string) => void;
}

const COMMANDS = [
    { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard, keywords: 'anasayfa home dashboard genel' },
    { id: 'data-upload', label: 'Veri Yükleme', icon: Database, keywords: 'upload dosya yükle veri' },
    { id: 'fatura-xml', label: 'Fatura XML', icon: FileArchive, keywords: 'fatura xml zip efatura' },
    { id: 'sales', label: 'Satış KDV Kontrol', icon: ClipboardCheck, keywords: 'satış kdv kontrol satis' },
    { id: 'purchase', label: 'Alış KDV Kontrol', icon: ClipboardCheck, keywords: 'alış kdv kontrol alis' },
    { id: 'kebir', label: 'Kebir Analizi', icon: PieChart, keywords: 'kebir defter analiz ücret' },
    { id: 'mizan', label: 'Mizan', icon: Scale, keywords: 'mizan hesap bakiye' },
    { id: 'temporary-tax', label: 'Geçici Vergi', icon: Calculator, keywords: 'gecici vergi dönem çeyrek' },
    { id: 'voucher-edit-report', label: 'Fiş Düzenleme Raporu', icon: FileClock, keywords: 'fiş düzenleme rapor edit' },
    { id: 'voucher-list', label: 'Fiş Listesi', icon: FileText, keywords: 'fiş liste voucher' },
    { id: 'current-account', label: 'Cari Hesap Kontrol', icon: FileSpreadsheet, keywords: 'cari hesap ekstre kontrol' },
];

export default function CommandPalette({ onNavigate }: CommandPaletteProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
                setQuery('');
                setSelectedIndex(0);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const normalizeText = (text: string) =>
        text
            .toLocaleLowerCase('tr-TR')
            .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
            .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g');

    const filtered = useMemo(() => {
        if (!query.trim()) return COMMANDS;
        const q = normalizeText(query);
        return COMMANDS.filter(cmd =>
            normalizeText(cmd.label).includes(q) || normalizeText(cmd.keywords).includes(q)
        );
    }, [query]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [filtered.length]);

    const handleSelect = (id: string) => {
        onNavigate(id);
        setIsOpen(false);
        setQuery('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        }
        if (e.key === 'Enter' && filtered[selectedIndex]) {
            handleSelect(filtered[selectedIndex].id);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]" onClick={() => setIsOpen(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                    <Search size={18} className="text-slate-500 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Modül veya sayfa ara..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-slate-500"
                    />
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-500 border border-slate-700">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto p-2">
                    {filtered.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-6">Sonuç bulunamadı</p>
                    )}
                    {filtered.map((cmd, i) => (
                        <button
                            key={cmd.id}
                            onClick={() => handleSelect(cmd.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${i === selectedIndex
                                ? 'bg-blue-600/20 text-blue-400'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <cmd.icon size={18} className={i === selectedIndex ? 'text-blue-400' : 'text-slate-500'} />
                            <span className="font-medium">{cmd.label}</span>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 text-[10px] text-slate-600">
                    <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">↑↓</kbd>
                        <span>gezin</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">↵</kbd>
                        <span>seç</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Command size={10} />
                        <span>Ctrl+K ile aç/kapat</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
