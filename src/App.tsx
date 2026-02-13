import { useState } from 'react';
import { AlertCircle, Layers } from 'lucide-react';
import AppShell from './components/layout/AppShell';
import HeroSection from './components/dashboard/HeroSection';
import FeatureCards from './components/dashboard/FeatureCards';
import { ReconciliationWizard } from './features/reconciliation/components/ReconciliationWizard';
import { useReconciliation } from './features/reconciliation/hooks/useReconciliation';
import KebirAnalysisPage from './features/kebir-analysis/components/KebirAnalysisPage';
import CurrentAccountControlPage from './features/current-account-control/CurrentAccountControlPage';




export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const recon = useReconciliation();
  const { state, actions } = recon;

  // Handle Tab Change Wrapper
  const handleTabChange = (tab: string) => {
    // If switching to a reconciliation tab, reset state to ensure clean start
    if (tab === 'sales' || tab === 'purchase') {
      if (activeTab !== tab) actions.resetAll();
    }
    setActiveTab(tab);
  };

  const handleStart = (mode: 'SALES' | 'PURCHASE') => {
    const targetTab = mode === 'SALES' ? 'sales' : 'purchase';
    setActiveTab(targetTab);
    actions.resetAll();
    actions.setStep(1);
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={handleTabChange} version="1.6.3">

      {/* Global Loading Overlay */}
      {state.loading && (
        <div className="fixed inset-0 bg-[var(--bg-dark)]/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center gap-6 animate-fade-in">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/30 rounded-full animate-spin"></div>
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="text-xl font-bold text-white tracking-wide animate-pulse">İşleminiz Yapılıyor...</p>
        </div>
      )}

      {/* Global Error Toast */}
      {state.error && (
        <div className="fixed top-24 right-8 z-[100] bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right duration-300">
          <AlertCircle size={24} />
          <div>
            <p className="font-bold">Bir Hata Oluştu</p>
            <p className="text-sm opacity-90">{state.error}</p>
          </div>
          <button onClick={() => actions.setError(null)} className="ml-4 hover:bg-white/20 p-1 rounded transition-colors">✕</button>
        </div>
      )}

      {/* Global Update Toast - NEW */}
      {state.updateInfo && (
        <div className="fixed bottom-8 right-8 z-[100] bg-slate-800 border border-blue-500/50 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right duration-300 max-w-md">
          <div className="bg-blue-500/20 p-2 rounded-full">
            <Layers className="text-blue-400 animate-pulse" size={24} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <p className="font-bold text-blue-400">Güncelleme Yazılımı</p>
              <button
                onClick={actions.dismissUpdate}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-300">{state.updateInfo.message}</p>
            {state.updateInfo.progress !== undefined && !state.updateInfo.downloaded && (
              <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${state.updateInfo.progress}%` }}
                />
              </div>
            )}
            {state.updateInfo.downloaded && (
              <button
                onClick={() => {
                  const { ipcRenderer } = (window as any).require('electron');
                  ipcRenderer.send('restart-app');
                }}
                className="mt-2 text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white font-bold transition-colors"
              >
                Şimdi Yeniden Başlat
              </button>
            )}
          </div>
        </div>
      )}

      {/* Views */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-fade-in">
          <HeroSection onStart={handleStart} />
          <FeatureCards onAction={(id) => {
            if (id === 'upload') handleStart('SALES'); // Legacy support
            else if (id === 'purchase') handleStart('PURCHASE');
            else handleTabChange(id);
          }} />
        </div>
      )}

      {(activeTab === 'sales' || activeTab === 'purchase') && (
        <ReconciliationWizard recon={recon} mode={activeTab === 'sales' ? 'SALES' : 'PURCHASE'} />
      )}

      {/* Kebir Analizi Modülü */}
      {activeTab === 'kebir' && (
        <KebirAnalysisPage />
      )}

      {/* Cari Hesap Kontrol Modülü */}
      {activeTab === 'current-account' && (
        <CurrentAccountControlPage />
      )}

      {/* Reports (Legacy or History placeholder) */}
      {activeTab === 'reports' && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
          <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Layers className="text-slate-600 w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Rapor Geçmişi</h2>
          <p className="text-slate-400 max-w-md">Geçmiş mutabakat raporlarınız burada listelenecek.</p>
        </div>
      )}

    </AppShell>

  );
}

