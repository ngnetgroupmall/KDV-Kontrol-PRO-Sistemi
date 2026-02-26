import { useState, useEffect, useCallback } from 'react';
import type { EInvoiceRow, AccountingRow, AccountingMatrahRow, ReconciliationReportData } from '../../../types';
import { createDemoData } from '../../../utils/demo';
import { useCompany } from '../../../context/CompanyContext';

export interface UpdateInfo {
    message: string;
    progress?: number;
    downloaded: boolean;
}

type ReconciliationReports = ReconciliationReportData;

export function useReconciliation() {
    const { activeCompany, patchActiveCompany, activeUploads, setActiveUploads } = useCompany();

    const [step, setStep] = useState(0);
    const [eFiles, setEFiles] = useState<File[]>([]);
    const [accFiles, setAccFiles] = useState<File[]>([]);
    const [accMatrahFiles, setAccMatrahFiles] = useState<File[]>([]);

    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [eInvoiceData, setEInvoiceData] = useState<EInvoiceRow[]>([]);
    const [accountingData, setAccountingData] = useState<AccountingRow[]>([]);
    const [accountingMatrahData, setAccountingMatrahData] = useState<AccountingMatrahRow[]>([]);
    const [tolerance, setTolerance] = useState<number>(0.25);

    const [reports, setReports] = useState<ReconciliationReports | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

    const setSharedEFiles = useCallback((files: File[]) => {
        setEFiles(files);
        setActiveUploads((current) => ({
            ...current,
            reconciliation: {
                ...current.reconciliation,
                eInvoiceFiles: files,
            },
        }));
    }, [setActiveUploads]);

    const setSharedAccFiles = useCallback((files: File[]) => {
        setAccFiles(files);
        setActiveUploads((current) => ({
            ...current,
            reconciliation: {
                ...current.reconciliation,
                accountingFiles: files,
            },
        }));
    }, [setActiveUploads]);

    const setSharedAccMatrahFiles = useCallback((files: File[]) => {
        setAccMatrahFiles(files);
        setActiveUploads((current) => ({
            ...current,
            reconciliation: {
                ...current.reconciliation,
                accountingMatrahFiles: files,
            },
        }));
    }, [setActiveUploads]);

    useEffect(() => {
        setEFiles(activeUploads.reconciliation.eInvoiceFiles);
        setAccFiles(activeUploads.reconciliation.accountingFiles);
        setAccMatrahFiles(activeUploads.reconciliation.accountingMatrahFiles);
        setCurrentFileIndex(0);
        setError(null);

        if (!activeCompany) {
            setEInvoiceData([]);
            setAccountingData([]);
            setAccountingMatrahData([]);
            setReports(null);
            setTolerance(0.25);
            setStep(0);
            return;
        }

        if (activeCompany.reconciliation) {
            const savedState = activeCompany.reconciliation;
            setEInvoiceData(savedState.eInvoiceData || []);
            setAccountingData(savedState.accountingData || []);
            setAccountingMatrahData(savedState.accountingMatrahData || []);
            setReports(savedState.reports || null);
            setTolerance(typeof savedState.tolerance === 'number' ? savedState.tolerance : 0.25);

            if (savedState.reports) {
                setStep(6);
            } else if ((savedState.eInvoiceData || []).length > 0) {
                setStep(2);
            } else {
                setStep(1);
            }
            return;
        }

        setEInvoiceData([]);
        setAccountingData([]);
        setAccountingMatrahData([]);
        setReports(null);
        setTolerance(0.25);
        setStep(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        activeCompany?.id,
        activeUploads.reconciliation.eInvoiceFiles,
        activeUploads.reconciliation.accountingFiles,
        activeUploads.reconciliation.accountingMatrahFiles,
    ]);

    const saveDataToCompany = useCallback(async (newData: Record<string, unknown>) => {
        await patchActiveCompany((company) => ({
            reconciliation: {
                ...(company.reconciliation || {}),
                ...newData,
            },
        }));
    }, [patchActiveCompany]);

    useEffect(() => {
        const api = window.electronAPI;
        if (!api) return;

        const unsubscribeMessage = api.onUpdateMessage((message: string) => {
            setUpdateInfo((prev) => ({ message, progress: prev?.progress, downloaded: false }));
        });

        const unsubscribeProgress = api.onUpdateDownloadProgress((percent: number) => {
            setUpdateInfo((prev) => ({ message: prev?.message || '', progress: percent, downloaded: false }));
        });

        const unsubscribeDownloaded = api.onUpdateDownloaded((message: string) => {
            setUpdateInfo({ message, downloaded: true, progress: 100 });
        });

        return () => {
            unsubscribeMessage();
            unsubscribeProgress();
            unsubscribeDownloaded();
        };
    }, []);

    const processEFile = useCallback(async (mapping: Record<string, string>, headerRowIndex: number, mode: 'SALES' | 'PURCHASE') => {
        const currentFile = eFiles[currentFileIndex];
        if (!currentFile) {
            setError('Secili e-fatura dosyasi bulunamadi.');
            return;
        }

        setLoading(true);
        try {
            const { processEInvoiceFile } = await import('../services/excelProcessor');
            const result = await processEInvoiceFile(currentFile, mapping, headerRowIndex, mode);

            if (result.success && result.data) {
                setEInvoiceData((prev) => {
                    const base = currentFileIndex === 0 ? [] : prev;
                    const updated = [...base, ...result.data!];
                    void saveDataToCompany({ eInvoiceData: updated });
                    return updated;
                });

                if (currentFileIndex + 1 < eFiles.length) {
                    setCurrentFileIndex(currentFileIndex + 1);
                } else {
                    setStep(2);
                    setCurrentFileIndex(0);
                }
            } else {
                setError(result.error || 'Dosya islenirken hata olustu.');
            }
        } catch (err) {
            setError('Beklenmeyen bir hata olustu: ' + String(err));
        } finally {
            setLoading(false);
        }
    }, [eFiles, currentFileIndex, saveDataToCompany]);

    const processAccFile = useCallback(async (mapping: Record<string, string>, headerRowIndex: number, mode: 'SALES' | 'PURCHASE') => {
        const currentFile = accFiles[currentFileIndex];
        if (!currentFile) {
            setError('Secili muhasebe dosyasi bulunamadi.');
            return;
        }

        setLoading(true);
        try {
            const { processAccountingFile } = await import('../services/excelProcessor');
            const result = await processAccountingFile(currentFile, mapping, headerRowIndex, mode);

            if (result.success && result.data) {
                setAccountingData((prev) => {
                    const base = currentFileIndex === 0 ? [] : prev;
                    const updated = [...base, ...result.data!];
                    void saveDataToCompany({ accountingData: updated });
                    return updated;
                });

                if (currentFileIndex + 1 < accFiles.length) {
                    setCurrentFileIndex(currentFileIndex + 1);
                } else {
                    if (mode === 'PURCHASE') {
                        setStep(5);
                    } else {
                        setStep(4);
                    }
                    setCurrentFileIndex(0);
                }
            } else {
                setError(result.error || 'Dosya islenirken hata olustu.');
            }
        } catch (err) {
            setError('Beklenmeyen bir hata olustu: ' + String(err));
        } finally {
            setLoading(false);
        }
    }, [accFiles, currentFileIndex, saveDataToCompany]);

    const processAccMatrahFile = useCallback(async (mapping: Record<string, string>, headerRowIndex: number) => {
        const currentFile = accMatrahFiles[currentFileIndex];
        if (!currentFile) {
            setError('Secili matrah dosyasi bulunamadi.');
            return;
        }

        setLoading(true);
        try {
            const { processAccountingMatrahFile } = await import('../services/excelProcessor');
            const result = await processAccountingMatrahFile(currentFile, mapping, headerRowIndex);

            if (result.success && result.data) {
                setAccountingMatrahData((prev) => {
                    const base = currentFileIndex === 0 ? [] : prev;
                    const updated = [...base, ...result.data!];
                    void saveDataToCompany({ accountingMatrahData: updated });
                    return updated;
                });

                if (currentFileIndex + 1 < accMatrahFiles.length) {
                    setCurrentFileIndex(currentFileIndex + 1);
                } else {
                    setStep(5);
                }
            } else {
                setError(result.error || 'Dosya islenirken hata olustu.');
            }
        } catch (err) {
            setError('Beklenmeyen bir hata olustu: ' + String(err));
        } finally {
            setLoading(false);
        }
    }, [accMatrahFiles, currentFileIndex, saveDataToCompany]);

    const runReconciliation = useCallback((mode: 'SALES' | 'PURCHASE') => {
        if (eInvoiceData.length === 0 || (accountingData.length === 0 && accountingMatrahData.length === 0)) {
            setError('Veri setleri eksik.');
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
                mode,
            },
        });
        worker.onmessage = (event) => {
            if (event.data.type === 'RECONCILE_SUCCESS') {
                setReports(event.data.payload);
                void saveDataToCompany({ reports: event.data.payload });
                setStep(6);
            }
            setLoading(false);
            worker.terminate();
        };
    }, [eInvoiceData, accountingData, accountingMatrahData, tolerance, saveDataToCompany]);

    const handleDemoData = async (type: 'EINVOICE' | 'ACCOUNTING' | 'ACCOUNTING_MATRAH') => {
        try {
            const XLSX = await import('xlsx');
            const data = createDemoData(type === 'ACCOUNTING_MATRAH' ? 'ACCOUNTING' : type);
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Demo');
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const file = new File([wbout], `${type.toLowerCase()}_demo.xlsx`, {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

            if (type === 'EINVOICE') setSharedEFiles([file]);
            else if (type === 'ACCOUNTING') setSharedAccFiles([file]);
            else setSharedAccMatrahFiles([file]);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setError(`Demo dosyasi olusturulamadi: ${message}`);
        }
    };

    const resetAll = async () => {
        setSharedEFiles([]);
        setSharedAccFiles([]);
        setSharedAccMatrahFiles([]);
        setEInvoiceData([]);
        setAccountingData([]);
        setAccountingMatrahData([]);
        setReports(null);
        setStep(1);
        setCurrentFileIndex(0);
        setError(null);
        setTolerance(0.25);

        if (activeCompany) {
            await patchActiveCompany(() => ({ reconciliation: undefined }));
        }
    };

    const pickFieldValue = (row: Record<string, unknown>, keys: string[]): string => {
        for (const key of keys) {
            const value = row[key];
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return '';
    };

    const handleExclusionComplete = (statuses: string[], validities: string[], toleranceVal: number = 0.25) => {
        const filtered = eInvoiceData.filter((row) => {
            const rowRecord = row as unknown as Record<string, unknown>;
            const status = pickFieldValue(rowRecord, ['Statü', 'Statu', 'StatÃ¼']);
            const validity = pickFieldValue(rowRecord, ['Geçerlilik Durumu', 'Gecerlilik Durumu', 'GeÃ§erlilik Durumu']);
            return !statuses.includes(status) && !validities.includes(validity);
        });

        setEInvoiceData(filtered);
        void saveDataToCompany({ eInvoiceData: filtered });

        setTolerance(toleranceVal);
        setStep(3);
        setCurrentFileIndex(0);
    };

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
            tolerance,
        },
        actions: {
            setStep,
            setEFiles: setSharedEFiles,
            setAccFiles: setSharedAccFiles,
            setAccMatrahFiles: setSharedAccMatrahFiles,
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
            dismissUpdate: () => setUpdateInfo(null),
        },
    };
}
