import { lazy, Suspense, useState } from 'react';
import { AlertCircle, Layers } from 'lucide-react';
import AppShell from './components/layout/AppShell';
import HeroSection from './components/dashboard/HeroSection';
import FeatureCards from './components/dashboard/FeatureCards';
import { useReconciliation } from './features/reconciliation/hooks/useReconciliation';

const ReconciliationWizard = lazy(async () => {
  const module = await import('./features/reconciliation/components/ReconciliationWizard');
  return { default: module.ReconciliationWizard };
});
const DataUploadPage = lazy(() => import('./features/data-upload/DataUploadPage'));
const KebirAnalysisPage = lazy(() => import('./features/kebir-analysis/components/KebirAnalysisPage'));
const MizanPage = lazy(() => import('./features/mizan/MizanPage'));
const TemporaryTaxPage = lazy(() => import('./features/temporary-tax/TemporaryTaxPage'));
const CurrentAccountControlPage = lazy(() => import('./features/current-account-control/CurrentAccountControlPage'));

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const recon = useReconciliation();
  const { state, actions } = recon;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const handleStart = (mode: 'SALES' | 'PURCHASE') => {
    const targetTab = mode === 'SALES' ? 'sales' : 'purchase';
    setActiveTab(targetTab);
    void actions.resetAll();
    actions.setStep(1);
  };

  const lazyFallback = (
    <div className="flex items-center justify-center h-[40vh] text-slate-400 text-sm">
      Modul yukleniyor...
    </div>
  );

  return (
    <AppShell activeTab={activeTab} onTabChange={handleTabChange} version="1.6.8">
      {state.loading && (
        <div className="fixed inset-0 bg-[var(--bg-dark)]/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center gap-6 animate-fade-in">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/30 rounded-full animate-spin" />
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
          </div>
          <p className="text-xl font-bold text-white tracking-wide animate-pulse">Isleminiz yapiliyor...</p>
        </div>
      )}

      {state.error && (
        <div className="fixed top-24 right-8 z-[100] bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right duration-300">
          <AlertCircle size={24} />
          <div>
            <p className="font-bold">Bir hata olustu</p>
            <p className="text-sm opacity-90">{state.error}</p>
          </div>
          <button onClick={() => actions.setError(null)} className="ml-4 hover:bg-white/20 p-1 rounded transition-colors">X</button>
        </div>
      )}

      {state.updateInfo && (
        <div className="fixed bottom-8 right-8 z-[100] bg-slate-800 border border-blue-500/50 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right duration-300 max-w-md">
          <div className="bg-blue-500/20 p-2 rounded-full">
            <Layers className="text-blue-400 animate-pulse" size={24} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <p className="font-bold text-blue-400">Guncelleme</p>
              <button
                onClick={actions.dismissUpdate}
                className="text-slate-400 hover:text-white transition-colors"
              >
                X
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
                onClick={() => window.electronAPI?.restartApp()}
                className="mt-2 text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white font-bold transition-colors"
              >
                Simdi yeniden baslat
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-fade-in">
          <HeroSection onStart={handleStart} />
          <FeatureCards onAction={(id) => {
            if (id === 'upload') handleTabChange('data-upload');
            else if (id === 'purchase') handleStart('PURCHASE');
            else handleTabChange(id);
          }} />
        </div>
      )}

      {activeTab === 'data-upload' && (
        <Suspense fallback={lazyFallback}>
          <DataUploadPage />
        </Suspense>
      )}

      {(activeTab === 'sales' || activeTab === 'purchase') && (
        <Suspense fallback={lazyFallback}>
          <ReconciliationWizard recon={recon} mode={activeTab === 'sales' ? 'SALES' : 'PURCHASE'} />
        </Suspense>
      )}

      {activeTab === 'kebir' && (
        <Suspense fallback={lazyFallback}>
          <KebirAnalysisPage />
        </Suspense>
      )}

      {activeTab === 'mizan' && (
        <Suspense fallback={lazyFallback}>
          <MizanPage />
        </Suspense>
      )}

      {activeTab === 'temporary-tax' && (
        <Suspense fallback={lazyFallback}>
          <TemporaryTaxPage />
        </Suspense>
      )}

      {activeTab === 'current-account' && (
        <Suspense fallback={lazyFallback}>
          <CurrentAccountControlPage />
        </Suspense>
      )}

      {activeTab === 'reports' && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
          <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Layers className="text-slate-600 w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Rapor gecmisi</h2>
          <p className="text-slate-400 max-w-md">Gecmis mutabakat raporlari burada listelenecek.</p>
        </div>
      )}

      {(activeTab === 'support' || activeTab === 'settings') && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
          <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Layers className="text-slate-600 w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {activeTab === 'support' ? 'Destek Merkezi' : 'Ayarlar'}
          </h2>
          <p className="text-slate-400 max-w-md">
            Bu ekran yakinda aktif olacak. Istersen once en cok kullandigin ayarlari buraya tasiyalim.
          </p>
        </div>
      )}
    </AppShell>
  );
}
