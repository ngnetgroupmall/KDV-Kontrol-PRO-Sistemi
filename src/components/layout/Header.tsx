import { Search, Bell, ChevronDown, User } from 'lucide-react';


export default function Header() {
    return (
        <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-[var(--header-height)] bg-[var(--bg-dark)]/90 backdrop-blur-md border-b border-[var(--border-color)] flex items-center justify-between px-8 z-40 transition-all duration-300">
            {/* Title / Context */}
            <div className="flex items-center gap-4">
                {/* Could add breadcrumbs here later */}
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
