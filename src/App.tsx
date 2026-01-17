import React, { useState } from 'react';
import { Upload, Check, AlertCircle, FileSpreadsheet, ArrowRight, Download, Filter, Layers, Beaker, X } from 'lucide-react';
import ColumnMapper from './components/ColumnMapper';
import ExclusionSettings from './components/ExclusionSettings';
import type { EInvoiceRow, AccountingRow } from './types';
import * as XLSX from 'xlsx';
import { createDemoData } from './utils/demo';
import packageJson from '../package.json';

const EINVOICE_FIELDS = [
  { key: 'Fatura Tarihi', label: 'Fatura Tarihi', required: true },
  { key: 'Fatura No', label: 'Fatura No', required: true },
  { key: 'KDV Tutarı', label: 'KDV Tutarı', required: true },
  { key: 'GİB Fatura Türü', label: 'GİB Fatura Türü', required: false },
  { key: 'Ödeme Şekli', label: 'Ödeme Şekli', required: false },
  { key: 'Para Birimi', label: 'Para Birimi', required: false },
  { key: 'Döviz Kuru', label: 'Döviz Kuru', required: false },
  { key: 'Müşteri', label: 'Müşteri', required: false },
  { key: 'Statü', label: 'Statü', required: false },
  { key: 'Geçerlilik Durumu', label: 'Geçerlilik Durumu', required: false }
];

const ACCOUNTING_FIELDS = [
  { key: 'Tarih', label: 'Tarih', required: true },
  { key: 'Ref.No', label: 'Ref.No', required: false },
  { key: 'Fatura No', label: 'Fatura No', required: true },
  { key: 'Açıklama', label: 'Açıklama', required: false },
  { key: 'Alacak Tutarı', label: 'Alacak Tutarı', required: true }
];

export default function App() {
  const [step, setStep] = useState(0);
  const [eFiles, setEFiles] = useState<File[]>([]);
  const [accFiles, setAccFiles] = useState<File[]>([]);

  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [eInvoiceData, setEInvoiceData] = useState<EInvoiceRow[]>([]);
  const [_accountingData, setAccountingData] = useState<AccountingRow[]>([]);

  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_excludedStatuses, setExcludedStatuses] = useState<string[]>([]);
  const [_excludedValidities, setExcludedValidities] = useState<string[]>([]);
  const [updateInfo, setUpdateInfo] = useState<{ message: string, progress?: number, downloaded: boolean } | null>(null);

  React.useEffect(() => {
    // Listen for update messages from main process
    const { ipcRenderer } = (window as any).require ? (window as any).require('electron') : { ipcRenderer: null };
    if (!ipcRenderer) return;

    ipcRenderer.on('update-message', (_: any, message: string) => {
      setUpdateInfo(prev => ({ message, progress: prev?.progress, downloaded: false }));
    });

    ipcRenderer.on('update-download-progress', (_: any, percent: number) => {
      setUpdateInfo(prev => ({ message: prev?.message || '', progress: percent, downloaded: false }));
    });

    ipcRenderer.on('update-downloaded', (_: any, message: string) => {
      setUpdateInfo({ message, downloaded: true, progress: 100 });
    });

    return () => {
      ipcRenderer.removeAllListeners('update-message');
      ipcRenderer.removeAllListeners('update-download-progress');
      ipcRenderer.removeAllListeners('update-downloaded');
    };
  }, []);

  const processEFile = (mapping: Record<string, string>, headerRowIndex: number) => {
    const worker = new Worker(new URL('./workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });
    setLoading(true);
    worker.postMessage({
      type: 'PARSE_EXCEL',
      payload: { file: eFiles[currentFileIndex], mapping, fileType: 'EINVOICE', fileName: eFiles[currentFileIndex].name, headerRowIndex }
    });

    worker.onmessage = (e) => {
      if (e.data.type === 'PARSE_SUCCESS') {
        setEInvoiceData(prev => [...prev, ...e.data.payload.rows]);
        if (currentFileIndex + 1 < eFiles.length) {
          setCurrentFileIndex(currentFileIndex + 1);
        } else {
          setStep(2);
        }
      } else if (e.data.type === 'PARSE_ERROR') {
        setError(e.data.payload);
      }
      setLoading(false);
      worker.terminate();
    };
  };

  const processAccFile = (mapping: Record<string, string>, headerRowIndex: number) => {
    const worker = new Worker(new URL('./workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });
    setLoading(true);
    worker.postMessage({
      type: 'PARSE_EXCEL',
      payload: { file: accFiles[currentFileIndex], mapping, fileType: 'ACCOUNTING', fileName: accFiles[currentFileIndex].name, headerRowIndex }
    });

    worker.onmessage = (e) => {
      if (e.data.type === 'PARSE_SUCCESS') {
        const newBatch = e.data.payload.rows;
        setAccountingData(prev => {
          const updated = [...prev, ...newBatch];
          if (currentFileIndex + 1 < accFiles.length) {
            setCurrentFileIndex(currentFileIndex + 1);
          } else {
            runReconciliation(eInvoiceData, updated);
          }
          return updated;
        });
      } else if (e.data.type === 'PARSE_ERROR') {
        setError(e.data.payload);
      }
      setLoading(false);
      worker.terminate();
    };
  };

  const resetAll = () => {
    setEFiles([]);
    setAccFiles([]);
    setEInvoiceData([]);
    setAccountingData([]);
    setReports(null);
    setStep(0);
    setCurrentFileIndex(0);
    setError(null);
  };

  const runReconciliation = (eiData: EInvoiceRow[], accData: AccountingRow[]) => {
    setLoading(true);
    const worker = new Worker(new URL('./workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });
    worker.postMessage({
      type: 'RECONCILE',
      payload: { eInvoices: eiData, accountingRows: accData }
    });
    worker.onmessage = (e) => {
      if (e.data.type === 'RECONCILE_SUCCESS') {
        setReports(e.data.payload);
        setStep(5);
      }
      setLoading(false);
      worker.terminate();
    };
  };

  const handleDemoData = (type: 'EINVOICE' | 'ACCOUNTING') => {
    const data = createDemoData(type);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Demo");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const file = new File([wbout], `${type.toLowerCase()}_demo.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    if (type === 'EINVOICE') setEFiles([file]);
    else setAccFiles([file]);
  };

  return (
    <AppShell
      step={step}
      onLogout={resetAll}
      updateInfo={updateInfo}
      onCloseUpdate={() => setUpdateInfo(null)}
    >
      {loading && (
        <div className="fixed inset-0 bg-bg-main/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="font-bold text-lg text-white">İşleniyor...</p>
        </div>
      )}

      {error && (
        <div className="fixed top-20 right-8 z-[100] bg-danger text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-slide-up">
          <AlertCircle size={20} />
          <p className="text-sm font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="ml-4 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="animate-slide-up">
        {step === 0 && <Landing version={packageJson.version} onNext={() => setStep(1)} />}

        {step === 1 && (
          eFiles.length === 0 ? (
            <div className="max-w-4xl mx-auto py-12">
              <Stepper currentStep={1} />
              <FileLoader
                type="EINVOICE"
                onFiles={(f) => setEFiles(f)}
                onDemo={() => handleDemoData('EINVOICE')}
              />
            </div>
          ) : (
            <div className="max-w-6xl mx-auto py-12">
              <ColumnMapper
                file={eFiles[currentFileIndex]}
                canonicalFields={EINVOICE_FIELDS}
                onComplete={processEFile}
                onCancel={() => setStep(0)}
              />
            </div>
          )
        )}

        {step === 2 && (
          <div className="max-w-6xl mx-auto py-12">
            <ExclusionSettings
              data={eInvoiceData}
              onComplete={(statuses, validities) => {
                setExcludedStatuses(statuses);
                setExcludedValidities(validities);
                setEInvoiceData(prev => prev.filter((row: any) =>
                  !statuses.includes(row["Statü"]) && !validities.includes(row["Geçerlilik Durumu"])
                ));
                setStep(3);
                setCurrentFileIndex(0);
              }}
              onBack={() => setStep(1)}
            />
          </div>
        )}

        {step === 3 && (
          accFiles.length === 0 ? (
            <div className="max-w-4xl mx-auto py-12">
              <Stepper currentStep={2} />
              <FileLoader
                type="ACCOUNTING"
                onFiles={(f) => setAccFiles(f)}
                onDemo={() => handleDemoData('ACCOUNTING')}
              />
            </div>
          ) : (
            <div className="max-w-6xl mx-auto py-12">
              <ColumnMapper
                file={accFiles[currentFileIndex]}
                canonicalFields={ACCOUNTING_FIELDS}
                onComplete={processAccFile}
                onCancel={() => setStep(2)}
              />
            </div>
          )
        )}

        {step === 5 && reports && (
          <div className="max-w-full lg:max-w-7xl mx-auto py-12 px-6">
            <ReportView reports={reports} onReset={resetAll} />
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Layout Components
function AppShell({ children, step, onLogout, updateInfo, onCloseUpdate }: any) {
  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center mb-10 shadow-lg shadow-primary/20">
          <FileSpreadsheet className="text-white w-6 h-6" />
        </div>
        <div className="flex flex-col gap-4">
          <SideNavItem active={step === 0} icon={<Layers size={20} />} />
          <SideNavItem active={step >= 1 && step <= 4} icon={<Upload size={20} />} />
          <SideNavItem active={step === 5} icon={<Filter size={20} />} />
        </div>
      </nav>

      <div className="main-content">
        <header className="header">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-bold leading-none">KDV Kontrol <span className="text-primary-light">PRO</span></h1>
              <p className="text-[10px] text-text-muted font-bold tracking-widest mt-1 uppercase">NG NET GROUP SOLUTIONS</p>
            </div>
            <div className="status-badge status-success">
              <div className="w-1.5 h-1.5 bg-success rounded-full"></div>
              Uygulama Güncel
            </div>
          </div>

          <div className="flex items-center gap-6">
            <img src="./logo.png" alt="NG" className="h-8 w-auto brightness-110" />
            {step > 0 && (
              <button onClick={onLogout} className="btn-base btn-soft-danger text-xs">
                <X size={16} /> Çıkış
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>

      {updateInfo && (
        <div className="fixed bottom-6 right-6 z-50 glass-card p-4 flex items-center gap-4 animate-slide-up min-w-[320px]">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Layers size={18} className="text-primary-light" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">{updateInfo.message}</p>
            {updateInfo.progress !== undefined && updateInfo.progress < 100 && (
              <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${updateInfo.progress}%` }}></div>
              </div>
            )}
          </div>
          <button onClick={onCloseUpdate} className="text-text-muted hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
}

function SideNavItem({ active, icon }: { active: boolean, icon: React.ReactNode }) {
  return (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all cursor-pointer ${active ? 'bg-white/10 text-primary-light border border-white/10' : 'text-text-muted hover:bg-white/5'}`}>
      {icon}
    </div>
  );
}

function Stepper({ currentStep }: { currentStep: number }) {
  const steps = [
    { id: 1, label: 'E-Fatura' },
    { id: 2, label: 'Muhasebe' },
    { id: 3, label: 'Sonuç' }
  ];

  return (
    <div className="flex items-center justify-center gap-8 mb-12">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${currentStep >= s.id ? 'bg-primary text-white' : 'bg-white/5 text-text-muted border border-white/10'}`}>
              {s.id}
            </div>
            <span className={`text-sm font-semibold ${currentStep >= s.id ? 'text-white' : 'text-text-muted'}`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className={`w-12 h-[1px] ${currentStep > s.id ? 'bg-primary' : 'bg-white/10'}`}></div>}
        </React.Fragment>
      ))}
    </div>
  );
}

function Landing({ version, onNext }: { version: string, onNext: () => void }) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12 lg:py-24">
      <div className="glass-card p-10 lg:p-16 grid lg:grid-cols-2 gap-12 items-center relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 blur-[100px] rounded-full"></div>

        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex items-center gap-3 text-primary-light font-bold text-sm uppercase tracking-widest">
            <Beaker size={18} /> Mutabakat Teknolojisi v{version}
          </div>
          <h2 className="text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight text-white">
            KDV Mutabakatı <br />
            <span className="text-primary-light">Artık Çok Daha Kolay.</span>
          </h2>
          <p className="text-lg text-text-muted leading-relaxed max-w-md">
            Excel dosyalarınızı modern SaaS gücüyle analiz edin. Kuruşu kuruşuna KDV farklarını saniyeler içinde raporlayın.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <button onClick={onNext} className="btn-base btn-primary px-10 py-4 text-lg">
              Hemen Başla <ArrowRight size={20} />
            </button>
            <button className="btn-base btn-secondary px-8 py-4">
              Nasıl Çalışır?
            </button>
          </div>
        </div>

        <div className="relative flex justify-center">
          <div className="w-full max-w-[400px] aspect-square bg-primary/10 rounded-3xl flex items-center justify-center relative shadow-inner">
            <Layers size={160} className="text-primary opacity-40 animate-pulse" />
            <div className="absolute -bottom-6 -right-6 glass-card p-6 shadow-2xl scale-110">
              <Check className="text-success w-10 h-10" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-12">
        <FeatureCard
          icon={<Upload size={24} className="text-primary-light" />}
          title="Hızlı Yükleme"
          desc="GİB Portal ve Muhasebe kayıtlarını saniyeler içinde sisteme aktarın."
        />
        <FeatureCard
          icon={<Filter size={24} className="text-primary-light" />}
          title="Akıllı Ayrıştırma"
          desc="Karmaşık açıklamalardan fatura numaralarını otomatik olarak cımbızla çeker."
        />
        <FeatureCard
          icon={<Download size={24} className="text-primary-light" />}
          title="Detaylı Rapor"
          desc="Tüm farkları ve hatalı kayıtları kategorize edilmiş Excel dökümü olarak alın."
        />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: any) {
  return (
    <div className="glass-card p-8 glass-card-hover">
      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 border border-white/5">
        {icon}
      </div>
      <h3 className="font-bold text-lg mb-3">{title}</h3>
      <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
    </div>
  );
}

function FileLoader({ type, onFiles, onDemo }: { type: 'EINVOICE' | 'ACCOUNTING', onFiles: (f: File[]) => void, onDemo: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const max = type === 'EINVOICE' ? 5 : 2;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls')).slice(0, max - files.length);
    setFiles([...files, ...dropped]);
  };

  return (
    <div className="flex flex-col gap-8 animate-slide-up">
      <div className="text-center">
        <h3 className="text-3xl font-bold mb-2">{type === 'EINVOICE' ? 'E-Fatura Dosyaları' : 'Muhasebe Kayıtları'}</h3>
        <p className="text-text-muted italic">Maksimum {max} dosya yükleyebilirsiniz.</p>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="glass-card border-dashed border-2 border-white/10 p-12 flex flex-col items-center gap-6 hover:border-primary/50 transition-all cursor-pointer bg-white/[0.01] hover:bg-white/[0.03] group"
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = '.xlsx, .xls';
          input.onchange = (e: any) => {
            const selected = Array.from(e.target.files).filter((f: any) => f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls')).slice(0, max - files.length) as File[];
            setFiles([...files, ...selected]);
          };
          input.click();
        }}
      >
        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
          <Upload className="text-primary-light w-8 h-8" />
        </div>
        <div className="text-center">
          <p className="font-bold text-lg">Dosyaları sürükleyin veya tıklayın</p>
          <p className="text-sm text-text-muted mt-1">Sadece Excel (.xlsx, .xls) formatı desteklenir.</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="grid gap-3">
          {files.map((f, i) => (
            <div key={i} className="glass-card px-6 py-4 flex justify-between items-center bg-white/5 border-white/10">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={18} className="text-primary-light" />
                <span className="text-sm font-semibold">{f.name}</span>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-md text-text-muted">{(f.size / 1024).toFixed(0)} KB</span>
              </div>
              <button className="text-danger hover:text-white transition-colors p-2" onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, idx) => idx !== i)); }}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-6 mt-4">
        <button
          disabled={files.length === 0}
          onClick={() => onFiles(files)}
          className={`btn-base btn-primary px-20 py-4 text-lg ${files.length === 0 ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
        >
          Devam Et <ArrowRight size={20} />
        </button>
        <button onClick={onDemo} className="text-primary-light hover:text-white flex items-center gap-2 text-sm font-bold transition-colors">
          <Beaker size={16} /> Örnek verilerle denemek ister misiniz?
        </button>
      </div>
    </div>
  );
}

function ReportView({ reports, onReset }: { reports: any, onReset: () => void }) {
  const [activeTab, setActiveTab] = useState(1);

  const tabs = [
    { id: 1, label: 'E-Fatura var, Muhasebe yok', data: reports.report1, color: 'text-error', bgColor: 'bg-error/10' },
    { id: 2, label: 'Muhasebe var, E-Fatura yok', data: reports.report2, color: 'text-warning', bgColor: 'bg-warning/10' },
    { id: 3, label: 'KDV Farkları', data: reports.report3, color: 'text-accent', bgColor: 'bg-accent/10' },
    { id: 4, label: 'Hatalı Muhasebe Kayıtları', data: reports.report4 || [], color: 'text-rose-400', bgColor: 'bg-rose-400/10' }
  ];

  const currentTab = tabs.find(t => t.id === activeTab);
  const currentTabData = currentTab?.data || [];

  return (
    <div className="animate-slide-up">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`glass-card glass-card-hover cursor-pointer p-6 flex flex-col justify-center min-h-[100px] border-2 ${activeTab === tab.id ? 'border-primary-light bg-primary/5' : 'border-white/5'}`}
          >
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">{tab.label}</p>
            <div className={`text-3xl font-black ${tab.color} flex items-baseline gap-2`}>
              {tab.data.length}
              <span className="text-xs font-medium opacity-50">Kayıt</span>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-white/5 flex flex-wrap justify-between items-center gap-6 bg-white/[0.01]">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-3">
              <Filter size={20} className="text-primary-light" />
              {currentTab?.label}
            </h3>
            <p className="text-sm text-text-muted mt-1">Bulunan kayıtların detaylı dökümü.</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => {
                const wb = XLSX.utils.book_new();
                tabs.forEach(tab => {
                  if (tab.data.length > 0) {
                    const formatted = tab.data.map((r: any) => {
                      const { originalRow, id, multipleInvoicesFound, validationError, ...rest } = r;
                      const cleaned: any = {};
                      Object.entries(rest).forEach(([k, v]) => {
                        if (typeof v === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(v)) {
                          const [d, m, y] = v.split('.').map(Number);
                          cleaned[k] = new Date(Date.UTC(y, m - 1, d));
                        } else {
                          cleaned[k] = v;
                        }
                      });
                      return cleaned;
                    });
                    const ws = XLSX.utils.json_to_sheet(formatted, { cellDates: true });
                    XLSX.utils.book_append_sheet(wb, ws, tab.label.substring(0, 31));
                  }
                });
                XLSX.writeFile(wb, `Tum_Hatalar_${new Date().getTime()}.xlsx`);
              }}
              className="btn-base btn-secondary text-sm"
            >
              <Download size={16} /> Tümünü Excel İndir
            </button>
            <button onClick={onReset} className="btn-base btn-primary text-sm">
              <RotateCcw size={16} /> Başlat
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px]">
          <table className="saas-table whitespace-nowrap">
            <thead className="sticky top-0 z-10">
              <tr>
                {currentTabData.length > 0 && Object.keys(currentTabData[0]).filter(k => k !== 'originalRow' && k !== 'id' && k !== 'multipleInvoicesFound' && k !== 'validationError').map(key => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentTabData.map((row: any, i: number) => (
                <tr key={i}>
                  {Object.keys(row).filter(k => k !== 'originalRow' && k !== 'id' && k !== 'multipleInvoicesFound' && k !== 'validationError').map(key => {
                    const val = row[key];
                    const isAmount = key.toLowerCase().includes('tutar') || key.toLowerCase().includes('alacak');
                    const isDateField = key.toLowerCase().includes('tarih');
                    let displayVal = String(val || '-');

                    if (val instanceof Date) {
                      displayVal = val.toLocaleDateString('tr-TR');
                    } else if (typeof val === 'number') {
                      if (isDateField && val > 30000 && val < 60000) {
                        const date = new Date((val - 25569) * 86400 * 1000);
                        displayVal = date.toLocaleDateString('tr-TR');
                      } else {
                        displayVal = val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      }
                    } else {
                      displayVal = String(val || '-');
                    }

                    return (
                      <td key={key} className={isAmount ? 'text-right font-mono text-primary-light' : ''}>
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {currentTabData.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-24 text-center">
                    <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="text-success w-8 h-8" />
                    </div>
                    <p className="text-lg font-bold">Harika! Hiç fark bulunamadı.</p>
                    <p className="text-sm text-text-muted mt-1">Sistem hatasız görünüyor.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Re-add Lucide icons for completeness in local components
import { RotateCcw } from 'lucide-react';
