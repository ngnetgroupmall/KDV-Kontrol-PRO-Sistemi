import { useState, useEffect, useCallback } from 'react';
import type { EInvoiceRow, AccountingRow } from '../../../types';
import { createDemoData } from '../../../utils/demo';
import * as XLSX from 'xlsx';

// Worker imports need to be handled carefully in Vite
// We'll instantiate them inside the functions

export interface UpdateInfo {
    message: string;
    progress?: number;
    downloaded: boolean;
}

export function useReconciliation() {
    const [step, setStep] = useState(0); // 0: Idle, 1: E-Invoice, 2: Exclusion, 3: Accounting, 4: Analysis, 5: Report
    const [eFiles, setEFiles] = useState<File[]>([]);
    const [accFiles, setAccFiles] = useState<File[]>([]);

    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [eInvoiceData, setEInvoiceData] = useState<EInvoiceRow[]>([]);
    const [accountingData, setAccountingData] = useState<AccountingRow[]>([]);

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



    const processEFile = useCallback((mapping: Record<string, string>, headerRowIndex: number) => {
        const worker = new Worker(new URL('../../../workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });
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
                    setStep(2); // Go to Exclusion
                    setCurrentFileIndex(0); // Reset for next batch if needed, though strictly not needed here
                }
            } else if (e.data.type === 'PARSE_ERROR') {
                setError(e.data.payload);
            }
            setLoading(false);
            worker.terminate();
        };
    }, [eFiles, currentFileIndex]);

    const processAccFile = useCallback((mapping: Record<string, string>, headerRowIndex: number) => {
        const worker = new Worker(new URL('../../../workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });
        setLoading(true);
        worker.postMessage({
            type: 'PARSE_EXCEL',
            payload: { file: accFiles[currentFileIndex], mapping, fileType: 'ACCOUNTING', fileName: accFiles[currentFileIndex].name, headerRowIndex }
        });

        worker.onmessage = (e) => {
            if (e.data.type === 'PARSE_SUCCESS') {
                const newBatch = e.data.payload.rows;
                // functional update to access latest state if needed, though here we use local var
                // But for running reconciliation immediately after last file, we need the full updated list.
                // The state update is async, so we can't depend on 'accountingData' immediately after setAccountingData.
                // We'll use a functional update and trigger reconciliation inside it or use a separate effect?
                // The original code did it inside the set state callback or derived it.
                // Let's mirror the original logic:

                setAccountingData(prev => {
                    const updated = [...prev, ...newBatch];
                    return updated;
                });

                // Wait for react state cycle? No, we used the local var 'updated' in original code.
                // Actually original used setAccountingData(prev => { ... check index ... return updated })

                if (currentFileIndex + 1 < accFiles.length) {
                    setCurrentFileIndex(currentFileIndex + 1);
                } else {
                    // CAUTION: eInvoiceData might be stale in this closure if not in dependencies?
                    // processAccFile is dependent on eInvoiceData if we use it here.
                    // Better to just set step to "Analysis" or trigger it specifically?
                    // original: runReconciliation(eInvoiceData, updated);
                    // We need eInvoiceData here.

                    // To avoid closure staleness, we can wrap this launch in an effect or ensure eInvoiceData is fresh.
                    // create helper
                    setStep(4); // Trigger analysis step in UI which will perform the actual run
                }
            } else if (e.data.type === 'PARSE_ERROR') {
                setError(e.data.payload);
            }
            setLoading(false);
            worker.terminate();
        };
    }, [accFiles, currentFileIndex]); // removed eInvoiceData dependency to avoid re-creating function mid-process if it changes (it shouldn't)

    const runReconciliation = useCallback(() => {
        if (eInvoiceData.length === 0 || accountingData.length === 0) {
            setError("Veri setleri eksik.");
            return;
        }

        setLoading(true);
        const worker = new Worker(new URL('../../../workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });
        worker.postMessage({
            type: 'RECONCILE',
            payload: { eInvoices: eInvoiceData, accountingRows: accountingData }
        });
        worker.onmessage = (e) => {
            if (e.data.type === 'RECONCILE_SUCCESS') {
                setReports(e.data.payload);
                setStep(5);
            }
            setLoading(false);
            worker.terminate();
        };
    }, [eInvoiceData, accountingData]);

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

    const resetAll = () => {
        setEFiles([]);
        setAccFiles([]);
        setEInvoiceData([]);
        setAccountingData([]);
        setReports(null);
        setStep(1);
        setCurrentFileIndex(0);
        setError(null);
    };

    const handleExclusionComplete = (statuses: string[], validities: string[]) => {
        setEInvoiceData(prev => prev.filter((row: any) =>
            !statuses.includes(row["Statü"]) && !validities.includes(row["Geçerlilik Durumu"])
        ));
        setStep(3);
        setCurrentFileIndex(0);
    }

    // Auto-run reconciliation when step reaches 4
    useEffect(() => {
        if (step === 4) {
            runReconciliation();
        }
    }, [step, runReconciliation]);

    return {
        state: {
            step,
            eFiles,
            accFiles,
            currentFileIndex,
            eInvoiceData,
            accountingData,
            reports,
            loading,
            error,
            updateInfo
        },
        actions: {
            setStep,
            setEFiles,
            setAccFiles,
            setCurrentFileIndex,
            setError,
            processEFile,
            processAccFile,
            runReconciliation,
            handleDemoData,
            resetAll,
            handleExclusionComplete,
            setLoading
        }
    };
}
