import React, { useState } from 'react';
import { Upload, Check, AlertCircle, FileSpreadsheet, ArrowRight, Download, Filter, Layers, Beaker, X } from 'lucide-react';
import ColumnMapper from './components/ColumnMapper';
import ExclusionSettings from './components/ExclusionSettings';
import type { EInvoiceRow, AccountingRow } from './types';
import * as XLSX from 'xlsx';
import { createDemoData } from './utils/demo';
import packageJson from '../package.json';

const EINVOICE_FIELDS = [
  'Fatura Tarihi', 'Fatura No', 'KDV Tutarı', 'GİB Fatura Türü',
  'Ödeme Şekli', 'Para Birimi', 'Döviz Kuru', 'Müşteri', 'Statü', 'Geçerlilik Durumu'
];

const ACCOUNTING_FIELDS = [
  'Tarih', 'Ref.No', 'Fatura No', 'Açıklama', 'Alacak Tutarı'
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
    <div className="min-h-screen p-4 flex flex-col items-center min-w-[1200px] overflow-x-auto">
      <header id="main-header" className="v-grid-header py-6 px-12 border-b border-white/10 bg-bg-card/40 backdrop-blur-2xl sticky top-0 z-[100] shadow-2xl">
        {/* Left: Brand Title */}
        <div className="v-flex-row v-justify-self-start gap-5">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/40 ring-2 ring-primary/20">
            <FileSpreadsheet className="text-white w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter leading-none text-white uppercase italic text-nowrap">KDV Kontrol <span className="text-primary not-italic">PRO</span></h1>
            <p className="text-text-muted text-[10px] font-black uppercase tracking-[0.4em] mt-2 opacity-80 text-nowrap">NG NET GROUP SOLUTIONS</p>
          </div>
        </div>

        {/* Right: Logo & Exit */}
        <div className="v-flex-row gap-10 v-justify-self-end">
          <img src="./logo.png" alt="NG NET GROUP" className="h-12 w-auto object-contain brightness-150 drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]" />
          {step > 0 && (
            <button
              onClick={resetAll}
              className="btn-secondary v-flex-row gap-4 px-10 py-3.5 text-xs font-black uppercase tracking-widest hover:brightness-125 hover:scale-105 active:scale-95 shadow-2xl shadow-error/40"
              title="Çıkış - İlk Ekrana Dön"
            >
              <X size={22} strokeWidth={4} /> Çıkış
            </button>
          )}
        </div>
      </header>

      {updateInfo && (
        <div className={`fixed bottom-8 left-8 z-[110] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-left duration-500 border-2 ${updateInfo.downloaded ? 'bg-success text-white border-success/20' : 'bg-bg-card/90 backdrop-blur-md text-white border-white/10'}`}>
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            {updateInfo.downloaded ? <Check size={20} className="text-white" /> : <Layers size={20} className="text-primary" />}
          </div>
          <div className="min-w-[200px]">
            <p className="font-bold text-sm leading-tight">{updateInfo.message}</p>
            {updateInfo.progress !== undefined && updateInfo.progress < 100 && (
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${updateInfo.progress}%` }}></div>
              </div>
            )}
          </div>
          {updateInfo.downloaded && (
            <button
              onClick={() => {
                const { ipcRenderer } = (window as any).require('electron');
                ipcRenderer.send('restart-app');
              }}
              className="btn-primary !py-2 !px-4 !text-xs !bg-white !text-success !border-white hover:!bg-white/90"
            >
              Şimdi Güncelle
            </button>
          )}
          <button onClick={() => setUpdateInfo(null)} className="opacity-40 hover:opacity-100 transition-opacity">✕</button>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-bg-main/90 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Veriler Analiz Ediliyor...</p>
        </div>
      )}

      {error && (
        <div className="fixed top-8 right-8 z-[100] bg-error text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce">
          <AlertCircle size={24} />
          <div>
            <p className="font-bold">Bir Hata Oluştu</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-4 hover:scale-110 transition-transform">✕</button>
        </div>
      )}

      <main className="w-full max-w-7xl fade-in pb-20 px-4">
        {step === 0 && <Landing version={packageJson.version} onNext={() => setStep(1)} />}

        {step === 1 && (
          eFiles.length === 0 ? (
            <div className="flex flex-col gap-6">
              <FileLoader type="EINVOICE" onFiles={(f) => setEFiles(f)} />
              <button
                onClick={() => handleDemoData('EINVOICE')}
                className="flex items-center gap-2 text-text-muted hover:text-accent self-center transition-colors text-sm font-medium"
              >
                <Beaker size={16} /> Örnek E-Fatura verisi ile dene
              </button>
            </div>
          ) : (
            <ColumnMapper
              file={eFiles[currentFileIndex]}
              canonicalFields={EINVOICE_FIELDS}
              onComplete={processEFile}
              onCancel={() => setStep(0)}
            />
          )
        )}

        {step === 2 && (
          <ExclusionSettings
            data={eInvoiceData}
            onComplete={(statuses, validities) => {
              setExcludedStatuses(statuses);
              setExcludedValidities(validities);
              // Filter out excluded invoices
              setEInvoiceData(prev => prev.filter((row: any) =>
                !statuses.includes(row["Statü"]) && !validities.includes(row["Geçerlilik Durumu"])
              ));
              setStep(3);
              setCurrentFileIndex(0);
            }}
            onBack={() => {
              setStep(1);
            }}
          />
        )}

        {step === 3 && (
          accFiles.length === 0 ? (
            <div className="flex flex-col gap-6">
              <FileLoader type="ACCOUNTING" onFiles={(f) => setAccFiles(f)} />
              <button
                onClick={() => handleDemoData('ACCOUNTING')}
                className="flex items-center gap-2 text-text-muted hover:text-accent self-center transition-colors text-sm font-medium"
              >
                <Beaker size={16} /> Örnek Muhasebe verisi ile dene
              </button>
            </div>
          ) : (
            <ColumnMapper
              file={accFiles[currentFileIndex]}
              canonicalFields={ACCOUNTING_FIELDS}
              onComplete={processAccFile}
              onCancel={() => setStep(2)}
            />
          )
        )}

        {step === 5 && reports && <ReportView reports={reports} onReset={resetAll} />}
      </main>
    </div>
  );
}

function Landing({ version, onNext }: { version: string, onNext: () => void }) {
  return (
    <div className="flex flex-col gap-12 w-full max-w-5xl py-12">
      <div className="card glass text-center py-20 flex flex-col items-center gap-8 shadow-[0_0_50px_-12px_rgba(37,99,235,0.2)] border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Layers size={200} />
        </div>
        <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center mb-4 border border-primary/20 shadow-inner relative z-10">
          <FileSpreadsheet className="w-12 h-12 text-primary" />
        </div>
        <div className="relative z-10">
          <h2 className="text-6xl font-black mb-6 tracking-tight">KDV Mutabakatı <br /><span className="text-primary">Artık Çok Daha Kolay.</span></h2>
          <p className="max-w-2xl text-text-muted text-xl leading-relaxed mx-auto">
            Excel dosyalarınızı tarayıcı içinde güvenle işleyin. <br />
            Regex tabanlı fatura no ayrıştırma ve toleranslı KDV kontrolü ile hata payını sıfıra indirin.
          </p>
        </div>
        <button onClick={onNext} className="btn-primary flex items-center gap-3 text-xl px-12 py-5 shadow-2xl shadow-primary/30 relative z-10">
          Hemen Başla <ArrowRight size={24} />
        </button>
        <div className="absolute bottom-4 right-6 text-text-muted/40 text-[10px] font-black tracking-widest uppercase">
          Versiyon v{version}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="card glass p-8 border-white/5">
          <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-6">
            <Upload className="text-primary" size={24} />
          </div>
          <h3 className="text-xl font-bold mb-3 text-white">1. Dosyaları Yükle</h3>
          <p className="text-text-muted text-sm leading-relaxed">
            E-Fatura listelerini (GİB/Portal) ve Muhasebe (Muavin Defter vb.) Excel dosyalarını sürükleyip bırakın.
          </p>
        </div>

        <div className="card glass p-8 border-white/5">
          <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center mb-6">
            <Filter className="text-accent" size={24} />
          </div>
          <h3 className="text-xl font-bold mb-3 text-white">2. Akıllı Eşleştirme</h3>
          <p className="text-text-muted text-sm leading-relaxed">
            Sütunları belirtin. Sistem, karmaşık açıklama metinleri içinden fatura numaralarını otomatik olarak cımbızla çeker.
          </p>
        </div>

        <div className="card glass p-8 border-white/5">
          <div className="w-12 h-12 bg-success/20 rounded-xl flex items-center justify-center mb-6">
            <Check className="text-success" size={24} />
          </div>
          <h3 className="text-xl font-bold mb-3 text-white">3. Farkları İndir</h3>
          <p className="text-text-muted text-sm leading-relaxed">
            Kuruşu kuruşuna KDV farklarını ve eksik kayıtları anlık rapor olarak Excel formatında indirin.
          </p>
        </div>
      </div>
    </div>
  );
}

function FileLoader({ type, onFiles }: { type: 'EINVOICE' | 'ACCOUNTING', onFiles: (f: File[]) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const max = type === 'EINVOICE' ? 5 : 2;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls')).slice(0, max - files.length);
    setFiles([...files, ...dropped]);
  };

  return (
    <div className="wizard-step">
      <div className="text-center mb-10">
        <span className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 inline-block">Adım {type === 'EINVOICE' ? '01' : '02'}</span>
        <h3 className="text-4xl font-extrabold mb-3">{type === 'EINVOICE' ? 'E-Fatura Dosyaları' : 'Muhasebe Kayıtları'}</h3>
        <p className="text-text-muted text-lg max-w-lg mx-auto">Sistem otomatik olarak kolonları tanımaya çalışacaktır.</p>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="card border-dashed border-2 border-white/10 py-16 flex flex-col items-center gap-6 hover:border-primary/50 transition-all cursor-pointer bg-white/[0.02] hover:bg-primary/[0.04] group rounded-3xl"
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
        <div className="w-16 h-16 bg-bg-main border border-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
          <Upload className="text-primary w-8 h-8" />
        </div>
        <div className="text-center">
          <p className="font-bold text-xl mb-1">Dosyaları buraya bırakın</p>
          <p className="text-text-muted font-medium">veya seçmek için tıklayın</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-3 mt-6">
          {files.map((f, i) => (
            <div key={i} className="card py-4 px-6 flex justify-between items-center glass border-white/5 hover:bg-white/[0.03] transition-colors">
              <span className="flex items-center gap-3 font-semibold"><FileSpreadsheet size={20} className="text-primary" /> {f.name}</span>
              <button className="text-error font-bold text-xs uppercase tracking-wider hover:opacity-70" onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, idx) => idx !== i)); }}>Kaldır</button>
            </div>
          ))}
        </div>
      )}

      <button
        disabled={files.length === 0}
        onClick={() => {
          console.log('Files selected:', files);
          onFiles(files);
        }}
        className={`btn-primary self-center mt-10 px-16 py-4 rounded-2xl shadow-2xl transition-all duration-300 ${files.length > 0 ? 'scale-110 shadow-primary/40' : 'opacity-20'} text-lg`}
      >
        Eşleştirmeye Başla
      </button>
    </div>
  );
}

function ReportView({ reports, onReset }: { reports: any, onReset: () => void }) {
  const [activeTab, setActiveTab] = useState(1);

  const downloadExcel = (data: any[], fileName: string) => {
    // Convert DD.MM.YYYY strings back to Date objects for Excel
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

    // Better filename and explicit write
    const safeName = fileName.replace(/[^a-zA-Z0-9ÇĞİÖŞÜçğıöşü]/g, '_');
    const timestamp = new Date().toLocaleDateString('tr-TR').replace(/\./g, '');
    XLSX.writeFile(wb, `${safeName}_${timestamp}.xlsx`);
  };

  const tabs = [
    { id: 1, label: 'E-Fatura var, Muhasebe yok', data: reports.report1, color: 'text-error', bgColor: 'bg-error/10' },
    { id: 2, label: 'Muhasebe var, E-Fatura yok', data: reports.report2, color: 'text-warning', bgColor: 'bg-warning/10' },
    { id: 3, label: 'KDV Farkları', data: reports.report3, color: 'text-accent', bgColor: 'bg-accent/10' }
  ];

  const currentTab = tabs.find(t => t.id === activeTab);
  const currentTabData = currentTab?.data || [];

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`card cursor-pointer transition-all border-2 flex flex-col justify-center min-h-[160px] p-8 ${activeTab === tab.id ? 'border-primary shadow-2xl shadow-primary/20 scale-[1.02] bg-primary/[0.03]' : 'border-white/5 hover:border-white/10'}`}
          >
            <p className="text-text-muted font-bold text-xs uppercase tracking-widest mb-3">{tab.label}</p>
            <div className={`text-5xl font-black ${tab.color} flex items-baseline gap-2`}>
              {tab.data.length}
              <span className="text-sm font-medium opacity-50">Kayıt</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card glass p-0 border-white/5 shadow-2xl">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
          <div>
            <h3 className="text-2xl font-black flex items-center gap-3">
              <Filter size={24} className="text-primary" />
              {currentTab?.label}
            </h3>
            <p className="text-text-muted font-medium mt-1">Hatalı bulunan kayıtların detaylı dökümü.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={onReset}
              className="v-btn-back"
            >
              ← Başa Dön
            </button>
            <button
              onClick={() => {
                const wb = XLSX.utils.book_new();
                tabs.forEach(tab => {
                  if (tab.data.length > 0) {
                    const formatted = tab.data.map((r: any) => {
                      const { originalRow, id, multipleInvoicesFound, ...rest } = r;
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
              className="v-btn-save"
            >
              <Download size={18} /> Tüm Hataları İndir
            </button>
            <button
              onClick={() => downloadExcel(currentTabData.map((r: any) => {
                const { originalRow, id, multipleInvoicesFound, ...rest } = r;
                return rest;
              }), currentTab?.label || 'Rapor')}
              className="v-btn-next !py-3 !px-8 !text-sm"
            >
              <Download size={18} /> Bu Sekmeyi İndir
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-bg-card/95 backdrop-blur-md z-10">
              <tr>
                {currentTabData.length > 0 && Object.keys(currentTabData[0]).filter(k => k !== 'originalRow' && k !== 'id' && k !== 'multipleInvoicesFound').map(key => (
                  <th key={key} className="p-4 font-black border-2 border-white/10 text-text-muted uppercase tracking-tighter text-xs bg-bg-card/50">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {currentTabData.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-primary/[0.03] transition-colors group">
                  {Object.keys(row).filter(k => k !== 'originalRow' && k !== 'id' && k !== 'multipleInvoicesFound').map(key => {
                    const val = row[key];
                    const isAmount = key.toLowerCase().includes('tutar') || key.toLowerCase().includes('alacak');
                    const isDateField = key.toLowerCase().includes('tarih');

                    let displayVal = String(val || '-');

                    if (val instanceof Date) {
                      displayVal = val.toLocaleDateString('tr-TR');
                    } else if (typeof val === 'number') {
                      // Fallback for Excel dates that might have reached the UI as numbers
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
                      <td
                        key={key}
                        className={`p-4 font-medium border-2 border-white/10 group-hover:border-primary/20 transition-colors whitespace-nowrap ${isAmount ? 'text-right' : ''}`}
                      >
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {currentTabData.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-32 text-center">
                    <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="text-success w-10 h-10" />
                    </div>
                    <p className="text-xl font-bold">Harika! Hiç fark bulunamadı.</p>
                    <p className="text-text-muted mt-2">Mutabakat dosyalarınız birbiriyle uyumlu görünüyor.</p>
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
