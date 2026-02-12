import { useState, useEffect, useCallback } from 'react';
import type { EInvoiceRow, AccountingRow } from '../../../types';
import { createDemoData } from '../../../utils/demo';
import * as XLSX from 'xlsx';

export interface UpdateInfo {
    message: string;
    progress?: number;
    downloaded: boolean;
}

export function useReconciliation() {
    const [step, setStep] = useState(0); // 0: Idle, 1: E-Invoice, 2: Exclusion, 3: Accounting(KDV), 4: Acc(Matrah), 5: Analysis, 6: Report
    const [eFiles, setEFiles] = useState<File[]>([]);
    const [accFiles, setAccFiles] = useState<File[]>([]); // KDV Files
    const [accMatrahFiles, setAccMatrahFiles] = useState<File[]>([]); // Matrah Files

    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [eInvoiceData, setEInvoiceData] = useState<EInvoiceRow[]>([]);
    const [accountingData, setAccountingData] = useState<AccountingRow[]>([]); // KDV Data
    const [accountingMatrahData, setAccountingMatrahData] = useState<AccountingRow[]>([]); // Matrah Data
    const [tolerance, setTolerance] = useState<number>(0.25);

    const [reports, setReports] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

    // Auto-update listeners
    useEffect(() => {
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

    const processEFile = useCallback((mapping: Record<string, string>, headerRowIndex: number, mode: 'SALES' | 'PURCHASE') => {
        const worker = new Worker(new URL('../../../workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });
        setLoading(true);
        worker.postMessage({
            type: 'PARSE_EXCEL',
            payload: { file: eFiles[currentFileIndex], mapping, fileType: 'EINVOICE', fileName: eFiles[currentFileIndex].name, headerRowIndex, mode }
        });

        worker.onmessage = (e) => {
            if (e.data.type === 'PARSE_SUCCESS') {
                setEInvoiceData(prev => [...prev, ...e.data.payload.rows]);
                if (currentFileIndex + 1 < eFiles.length) {
                    setCurrentFileIndex(currentFileIndex + 1);
                } else {
                    setStep(2); // Go to Exclusion
                    setCurrentFileIndex(0);
                }
            } else if (e.data.type === 'PARSE_ERROR') {
                setError(e.data.payload);
            }
            setLoading(false);
            worker.terminate();
        };
    }, [eFiles, currentFileIndex]);

    const processAccFile = useCallback((mapping: Record<string, string>, headerRowIndex: number, mode: 'SALES' | 'PURCHASE') => {
        const worker = new Worker(new URL('../../../workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });
        setLoading(true);
        worker.postMessage({
            type: 'PARSE_EXCEL',
            payload: { file: accFiles[currentFileIndex], mapping, fileType: 'ACCOUNTING', fileName: accFiles[currentFileIndex].name, headerRowIndex, mode }
        });

        worker.onmessage = (e) => {
            if (e.data.type === 'PARSE_SUCCESS') {
                const newBatch = e.data.payload.rows;
                setAccountingData(prev => [...prev, ...newBatch]);

                if (currentFileIndex + 1 < accFiles.length) {
                    setCurrentFileIndex(currentFileIndex + 1);
                } else {
                    // Move to Step 4 (Matrah Upload) or Step 5 (Analysis) for Purchase
                    if (mode === 'PURCHASE') {
                        setStep(5);
                    } else {
                        setStep(4);
                    }
                    setCurrentFileIndex(0);
                }
            } else if (e.data.type === 'PARSE_ERROR') {
                setError(e.data.payload);
            }
            setLoading(false);
            worker.terminate();
        };
    }, [accFiles, currentFileIndex]);

    const processAccMatrahFile = useCallback((mapping: Record<string, string>, headerRowIndex: number) => {
        const worker = new Worker(new URL('../../../workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });
        setLoading(true);
        worker.postMessage({
            type: 'PARSE_EXCEL',
            payload: { file: accMatrahFiles[currentFileIndex], mapping, fileType: 'ACCOUNTING', fileName: accMatrahFiles[currentFileIndex].name, headerRowIndex } // Matrah doesn't strictly need mode if field mapping handles it, but consistency is good.
        });

        worker.onmessage = (e) => {
            if (e.data.type === 'PARSE_SUCCESS') {
                const newBatch = e.data.payload.rows;
                setAccountingMatrahData(prev => [...prev, ...newBatch]);

                if (currentFileIndex + 1 < accMatrahFiles.length) {
                    setCurrentFileIndex(currentFileIndex + 1);
                } else {
                    // Start Analysis (Step 5)
                    setStep(5);
                }
            } else if (e.data.type === 'PARSE_ERROR') {
                setError(e.data.payload);
            }
            setLoading(false);
            worker.terminate();
        };
    }, [accMatrahFiles, currentFileIndex]);

    const runReconciliation = useCallback((mode: 'SALES' | 'PURCHASE') => {
        if (eInvoiceData.length === 0 || (accountingData.length === 0 && accountingMatrahData.length === 0)) {
            setError("Veri setleri eksik.");
            return;
        }

        setLoading(true);
        const worker = new Worker(new URL('../../../workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });
        worker.postMessage({
            type: 'RECONCILE',
            payload: {
                eInvoices: eInvoiceData,
                accountingVATRows: accountingData,
                accountingMatrahRows: accountingMatrahData,
                tolerance,
                mode
            }
        });
        worker.onmessage = (e) => {
            if (e.data.type === 'RECONCILE_SUCCESS') {
                setReports(e.data.payload);
                setStep(6);
            }
            setLoading(false);
            worker.terminate();
        };
    }, [eInvoiceData, accountingData, accountingMatrahData, tolerance]);

    const handleDemoData = (type: 'EINVOICE' | 'ACCOUNTING' | 'ACCOUNTING_MATRAH') => {
        const data = createDemoData(type === 'ACCOUNTING_MATRAH' ? 'ACCOUNTING' : type);
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Demo");
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const file = new File([wbout], `${type.toLowerCase()}_demo.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        if (type === 'EINVOICE') setEFiles([file]);
        else if (type === 'ACCOUNTING') setAccFiles([file]);
        else setAccMatrahFiles([file]);
    };

    const resetAll = () => {
        setEFiles([]);
        setAccFiles([]);
        setAccMatrahFiles([]);
        setEInvoiceData([]);
        setAccountingData([]);
        setAccountingMatrahData([]);
        setReports(null);
        setStep(1);
        setCurrentFileIndex(0);
        setError(null);
        setTolerance(0.25);
    };

    const handleExclusionComplete = (statuses: string[], validities: string[], toleranceVal: number = 0.25) => {
        setEInvoiceData(prev => prev.filter((row: any) =>
            !statuses.includes(row["Statü"]) && !validities.includes(row["Geçerlilik Durumu"])
        ));
        setTolerance(toleranceVal);
        setStep(3);
        setCurrentFileIndex(0);
    }

    // Auto-run reconciliation when step reaches 5
    // Auto-run reconciliation when step reaches 5
    // Note: We need to know the mode here to run it automatically. 
    // Since we don't store mode in hook state, we might need to expose runReconciliation to be called from UI manually or pass mode to hook.
    // However, the cleanest way without refactoring everything is to remove auto-run effect here and let the Wizard trigger it, 
    // OR add mode to state. For now, let's remove this effect and trigger it from the UI component which knows the mode.
    // useEffect(() => {
    //     if (step === 5) {
    //         runReconciliation();
    //     }
    // }, [step, runReconciliation]);

    return {
        state: {
            step,
            eFiles,
            accFiles,
            accMatrahFiles,
            currentFileIndex,
            eInvoiceData,
            accountingData,
            accountingMatrahData,
            reports,
            loading,
            error,
            updateInfo,
            tolerance
        },
        actions: {
            setStep,
            setEFiles,
            setAccFiles,
            setAccMatrahFiles,
            setCurrentFileIndex,
            setError,
            processEFile,
            processAccFile,
            processAccMatrahFile,
            runReconciliation,
            handleDemoData,
            resetAll,
            handleExclusionComplete,
            setLoading,
            dismissUpdate: () => setUpdateInfo(null)
        }
    };
}
