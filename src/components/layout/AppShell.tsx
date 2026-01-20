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
        <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-main)] font-sans">
            <Sidebar activeTab={activeTab} onTabChange={onTabChange} version={version} />
            <Header />

            <main className="pl-[var(--sidebar-width)] pt-[var(--header-height)] min-h-screen relative z-10 transition-all duration-300">
                <div className="relative z-10 p-8 max-w-[1600px] mx-auto animate-fade-in">
                    {children}
                </div>
            </main>
        </div>
    );
}
