import { Search, Bell, ChevronDown } from 'lucide-react';

export default function Header() {
    return (
        <header className="fixed top-0 left-[280px] right-0 h-[80px] bg-slate-900/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-8 z-40">
            {/* Title / Breadcrumb */}
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-white tracking-tight">KDV Kontrol PRO</h2>
                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full border border-blue-500/20">
                    Kurumsal
                </span>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-6">
                {/* Search */}
                <div className="relative hidden md:block group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Arayın..."
                        className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl pl-11 pr-4 py-2.5 w-64 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800/80 transition-all placeholder:text-slate-600"
                    />
                </div>

                {/* Notifications */}
                <button className="relative w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-800" />
                </button>

                {/* Profile */}
                <div className="flex items-center gap-3 pl-6 border-l border-white/5 cursor-pointer group">
                    <div className="text-right hidden lg:block">
                        <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Serkan Demir</p>
                        <p className="text-xs text-slate-500">Mali Müşavir</p>
                    </div>
                    <div className="relative">
                        <img
                            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                            alt="Profile"
                            className="w-10 h-10 rounded-xl border-2 border-slate-700 group-hover:border-blue-500 transition-all object-cover"
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center">
                            <ChevronDown size={12} className="text-slate-400" />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
