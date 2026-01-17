import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface AppShellProps {
    children: ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
    version: string;
}

export default function AppShell({ children, activeTab, onTabChange, version }: AppShellProps) {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
            <Sidebar activeTab={activeTab} onTabChange={onTabChange} version={version} />
            <Header />

            <main className="pl-[280px] pt-[80px] min-h-screen relative z-10">
                {/* Background Gradients */}
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-20%] right-[10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px] animate-pulse delay-1000" />
                </div>

                <div className="relative z-10 p-8 max-w-[1600px] mx-auto animate-slide-up">
                    {children}
                </div>
            </main>
        </div>
    );
}
