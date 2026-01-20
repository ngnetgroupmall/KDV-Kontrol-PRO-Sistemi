import React, { useState } from 'react';
import { Upload, Check, AlertCircle, FileSpreadsheet, Download, Filter, Layers, Beaker, X, ChevronRight } from 'lucide-react';
import ColumnMapper from './components/ColumnMapper';
import ExclusionSettings from './components/ExclusionSettings';
import AppShell from './components/layout/AppShell';
import HeroSection from './components/dashboard/HeroSection';
import FeatureCards from './components/dashboard/FeatureCards';
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [step, setStep] = useState(0); // 0: Idle, 1: E-Invoice, 2: Exclusion, 3: Accounting, 5: Report
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

  const processEFile = (mapping: Record<string, string | string[]>, headerRowIndex: number) => {
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

  const processAccFile = (mapping: Record<string, string | string[]>, headerRowIndex: number) => {
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
    setStep(1); // Go back to start of wizard
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

  const handleStart = () => {
    setActiveTab('upload');
    setStep(1);
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab} version={packageJson.version}>
      {/* Global Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center gap-6 animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-500/30 rounded-full animate-spin"></div>
            <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="text-xl font-bold text-white tracking-wide animate-pulse">İşleminiz Yapılıyor...</p>
        </div>
      )}

      {/* Global Error Toast */}
      {error && (
        <div className="fixed top-24 right-8 z-[100] bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right duration-300">
          <AlertCircle size={24} />
          <div>
            <p className="font-bold">Bir Hata Oluştu</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-4 hover:bg-white/20 p-1 rounded transition-colors">✕</button>
        </div>
      )}

      {/* Dashboard View */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <HeroSection onStart={handleStart} />
          <FeatureCards onAction={(id) => {
            if (id === 'upload') handleStart();
            else setActiveTab(id);
          }} />
        </div>
      )}

      {/* Upload / Wizard View */}
      {activeTab === 'upload' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {step === 1 && (
            eFiles.length === 0 ? (
              <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">E-Fatura Yükleme</h2>
                    <p className="text-slate-400">GİB veya Entegratör portalından indirdiğiniz Excel listesini yükleyin.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">1</span>
                    <div className="w-12 h-1 bg-slate-700 rounded-full"></div>
                    <span className="w-8 h-8 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center font-bold">2</span>
                    <div className="w-12 h-1 bg-slate-700 rounded-full"></div>
                    <span className="w-8 h-8 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center font-bold">3</span>
                  </div>
                </div>

                <FileLoader type="EINVOICE" onFiles={(f) => setEFiles(f)} />

                <div className="mt-8 text-center">
                  <button
                    onClick={() => handleDemoData('EINVOICE')}
                    className="text-slate-500 hover:text-blue-400 text-sm font-medium transition-colors flex items-center justify-center gap-2 mx-auto"
                  >
                    <Beaker size={16} /> Örnek veri ile dene
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-6xl mx-auto">
                <ColumnMapper
                  file={eFiles[currentFileIndex]}
                  canonicalFields={EINVOICE_FIELDS}
                  onComplete={processEFile}
                  onCancel={() => { setEFiles([]); setStep(1); }}
                />
              </div>
            )
          )}

          {step === 2 && (
            <div className="max-w-6xl mx-auto">
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
                onBack={() => { setStep(1); setEFiles([]); }}
              />
            </div>
          )}

          {step === 3 && (
            accFiles.length === 0 ? (
              <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Muhasebe Kayıtları</h2>
                    <p className="text-slate-400">Muhasebe programınızdan aldığınız muavin dökümünü yükleyin.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold"><Check size={16} /></span>
                    <div className="w-12 h-1 bg-blue-500 rounded-full"></div>
                    <span className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">2</span>
                    <div className="w-12 h-1 bg-slate-700 rounded-full"></div>
                    <span className="w-8 h-8 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center font-bold">3</span>
                  </div>
                </div>

                <FileLoader type="ACCOUNTING" onFiles={(f) => setAccFiles(f)} />

                <div className="mt-8 text-center">
                  <button
                    onClick={() => handleDemoData('ACCOUNTING')}
                    className="text-slate-500 hover:text-blue-400 text-sm font-medium transition-colors flex items-center justify-center gap-2 mx-auto"
                  >
                    <Beaker size={16} /> Örnek veri ile dene
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-6xl mx-auto">
                <ColumnMapper
                  file={accFiles[currentFileIndex]}
                  canonicalFields={ACCOUNTING_FIELDS}
                  onComplete={processAccFile}
                  onCancel={() => { setAccFiles([]); setStep(3); }}
                />
              </div>
            )
          )}

          {step === 5 && reports && (
            <ReportView reports={reports} onReset={resetAll} />
          )}
        </div>
      )}

      {/* Placeholders for other tabs */}
      {activeTab === 'reconciliation' && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <Layers className="text-slate-600 w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Akıllı Ayrıştırma Modülü</h2>
          <p className="text-slate-400 max-w-md">Bu modül şu anda Hızlı Yükleme akışı içerisine entegre edilmiştir. Dosya yükleme aşamasında otomatik çalışır.</p>
          <button onClick={handleStart} className="btn-primary mt-8">Analizi Başlat</button>
        </div>
      )}

      {/* Update Info Toast */}
      {updateInfo && (
        <div className={`fixed bottom-8 right-8 z-[110] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom duration-500 border ${updateInfo.downloaded ? 'bg-green-500 text-white border-green-600' : 'bg-slate-800 text-white border-slate-700'}`}>
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            {updateInfo.downloaded ? <Check size={20} className="text-white" /> : <Layers size={20} className="text-blue-400" />}
          </div>
          <div>
            <p className="font-bold text-sm">{updateInfo.message}</p>
            {updateInfo.progress !== undefined && updateInfo.progress < 100 && (
              <div className="w-full h-1 bg-white/20 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${updateInfo.progress}%` }}></div>
              </div>
            )}
          </div>
          {updateInfo.downloaded && (
            <button
              onClick={() => {
                const { ipcRenderer } = (window as any).require('electron');
                ipcRenderer.send('restart-app');
              }}
              className="px-3 py-1 bg-white text-green-600 rounded-lg text-xs font-bold hover:bg-white/90"
            >
              Yeniden Başlat
            </button>
          )}
          <button onClick={() => setUpdateInfo(null)} className="opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

    </AppShell>
  );
}

// --- Sub Components ---

function FileLoader({ type, onFiles }: { type: 'EINVOICE' | 'ACCOUNTING', onFiles: (f: File[]) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const max = type === 'EINVOICE' ? 5 : 2;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls')).slice(0, max - files.length);
    setFiles([...files, ...dropped]);
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="group relative border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-3xl p-12 text-center transition-all duration-300 bg-slate-800/30 hover:bg-slate-800/50 cursor-pointer"
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
        <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-slate-700 group-hover:scale-110 group-hover:border-blue-500/30 transition-all duration-300">
          <Upload className="text-blue-500 w-10 h-10 group-hover:text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Dosyaları Buraya Sürükleyin</h3>
        <p className="text-slate-400 text-sm">veya seçmek için tıklayın</p>
      </div>

      {files.length > 0 && (
        <div className="grid gap-3 mt-6 animate-in slide-in-from-top-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="text-green-500 w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{f.name}</p>
                  <p className="text-xs text-slate-500">{(f.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, idx) => idx !== i)); }}
                className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        disabled={files.length === 0}
        onClick={() => onFiles(files)}
        className={`w-full mt-8 btn-primary text-lg py-5 ${files.length === 0 ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
      >
        İşleme Başla <ChevronRight />
      </button>
    </div>
  );
}

function ReportView({ reports, onReset }: { reports: any, onReset: () => void }) {
  const [activeTab, setActiveTab] = useState(1);
  // ... (keeping existing logic for tabs data mapping)

  const downloadExcel = (data: any[], fileName: string) => {
    const formattedData = data.map(row => {
      const newRow: any = {};
      Object.entries(row).forEach(([key, val]) => {
        if (typeof val === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
          const [d, m, y] = val.split('.').map(Number);
          newRow[key] = new Date(Date.UTC(y, m - 1, d));
        } else {
          newRow[key] = val;
        }
      });
      return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(formattedData, { cellDates: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    const safeName = fileName.replace(/[^a-zA-Z0-9ÇĞİÖŞÜçğıöşü]/g, '_');
    const timestamp = new Date().toLocaleDateString('tr-TR').replace(/\./g, '');
    XLSX.writeFile(wb, `${safeName}_${timestamp}.xlsx`);
  };

  const tabs = [
    { id: 1, label: 'E-Fatura Eksik', data: reports.report1, color: 'text-red-400', badge: 'bg-red-500/10 text-red-400' },
    { id: 2, label: 'Muhasebe Eksik', data: reports.report2, color: 'text-orange-400', badge: 'bg-orange-500/10 text-orange-400' },
    { id: 3, label: 'Tutar Farkları', data: reports.report3, color: 'text-cyan-400', badge: 'bg-cyan-500/10 text-cyan-400' },
    { id: 4, label: 'Hatalı Kayıtlar', data: reports.report4 || [], color: 'text-rose-400', badge: 'bg-rose-500/10 text-rose-400' }
  ];

  const currentTab = tabs.find(t => t.id === activeTab);
  const currentTabData = currentTab?.data || [];

  return (
    <div className="space-y-6">
      {/* New Header for Reports */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Mutabakat Sonucu</h2>
          <p className="text-slate-400">Analiz tamamlandı. Aşağıdaki sekmelerden detayları inceleyebilirsiniz.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onReset} className="btn-secondary text-sm">Yeni Analiz</button>
          <button
            onClick={() => {
              const wb = XLSX.utils.book_new();
              tabs.forEach(tab => {
                if (tab.data.length > 0) {
                  const ws = XLSX.utils.json_to_sheet(tab.data);
                  XLSX.utils.book_append_sheet(wb, ws, tab.label.substring(0, 31));
                }
              });
              XLSX.writeFile(wb, `Tam_Rapor_${Date.now()}.xlsx`);
            }}
            className="btn-primary text-sm px-6"
          >
            <Download size={18} /> Tümünü İndir
          </button>
        </div>
      </div>

      {/* Tabs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`glass-card p-6 cursor-pointer border-2 hover:border-blue-500/30 relative overflow-hidden ${activeTab === tab.id ? 'border-blue-500 bg-blue-500/10' : 'border-transparent'}`}
          >
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{tab.label}</h4>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-black ${tab.color}`}>{tab.data.length}</span>
              <span className="text-slate-500 text-sm font-medium">Kayıt</span>
            </div>
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500"></div>}
          </div>
        ))}
      </div>

      {/* Data Table Panel */}
      <div className="glass-card overflow-hidden min-h-[500px] flex flex-col">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-800/30">
          <div className="flex items-center gap-3">
            <Filter className="text-blue-400" size={20} />
            <h3 className="font-bold text-lg text-white">{currentTab?.label} Listesi</h3>
          </div>
          <button
            onClick={() => downloadExcel(currentTabData, currentTab?.label || 'Rapor')}
            className="text-xs font-bold text-blue-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <Download size={14} /> Bu Listeyi İndir
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900/80 backdrop-blur sticky top-0 z-10">
              <tr>
                {currentTabData.length > 0 && Object.keys(currentTabData[0]).filter(k => !['id', 'originalRow', 'validationError', 'multipleInvoicesFound'].includes(k)).map(key => (
                  <th key={key} className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/10">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-slate-300">
              {currentTabData.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-blue-500/5 transition-colors">
                  {Object.keys(row).filter(k => !['id', 'originalRow', 'validationError', 'multipleInvoicesFound'].includes(k)).map(key => {
                    let val = row[key];
                    if (val instanceof Date) val = val.toLocaleDateString('tr-TR');
                    if (typeof val === 'number' && (key.toLowerCase().includes('tutar') || key.toLowerCase().includes('borç') || key.toLowerCase().includes('alacak'))) {
                      val = val.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
                    }
                    return <td key={key} className="p-4 font-medium whitespace-nowrap">{val}</td>
                  })}
                </tr>
              ))}
              {currentTabData.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-20 text-center">
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="text-green-500 w-8 h-8" />
                    </div>
                    <p className="text-lg font-bold text-white">Kayıt Bulunamadı</p>
                    <p className="text-slate-500">Bu kategoride herhangi bir fark yok.</p>
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
