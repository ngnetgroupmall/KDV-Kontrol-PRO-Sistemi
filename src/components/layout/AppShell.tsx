import { useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { cn } from '../common/Button';

interface AppShellProps {
    children: ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
    version: string;
}

export default function AppShell({ children, activeTab, onTabChange, version }: AppShellProps) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-main)] font-sans">
            <Sidebar
                activeTab={activeTab}
                onTabChange={onTabChange}
                version={version}
                isCollapsed={isSidebarCollapsed}
                onCollapse={setIsSidebarCollapsed}
            />
            <Header />

            <main
                className={cn(
                    "pt-[var(--header-height)] min-h-screen relative z-10 transition-all duration-300",
                    isSidebarCollapsed ? "pl-[80px]" : "pl-[var(--sidebar-width)]"
                )}
            >
                <div className="relative z-10 p-8 max-w-[1600px] mx-auto animate-fade-in">
                    {children}
                </div>
            </main>
        </div>
    );
}
