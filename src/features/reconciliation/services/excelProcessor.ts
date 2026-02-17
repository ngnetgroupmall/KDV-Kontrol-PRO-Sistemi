
export interface ExcelProcessResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export const processEInvoiceFile = (
    file: File,
    mapping: Record<string, string>,
    headerRowIndex: number,
    mode: 'SALES' | 'PURCHASE'
): Promise<ExcelProcessResult<any[]>> => {
    return new Promise((resolve) => {
        const worker = new Worker(new URL('../../../workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });

        worker.postMessage({
            type: 'PARSE_EXCEL',
            payload: {
                file,
                mapping,
                fileType: 'EINVOICE',
                fileName: file.name,
                headerRowIndex,
                mode,
            },
        });

        worker.onmessage = (event) => {
            if (event.data.type === 'PARSE_SUCCESS') {
                resolve({ success: true, data: event.data.payload.rows });
            } else if (event.data.type === 'PARSE_ERROR') {
                resolve({ success: false, error: event.data.payload });
            }
            worker.terminate();
        };

        worker.onerror = (error) => {
            resolve({ success: false, error: 'Worker error: ' + String(error) });
            worker.terminate();
        }
    });
};

export const processAccountingFile = (
    file: File,
    mapping: Record<string, string>,
    headerRowIndex: number,
    mode: 'SALES' | 'PURCHASE'
): Promise<ExcelProcessResult<any[]>> => {
    return new Promise((resolve) => {
        const worker = new Worker(new URL('../../../workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });

        worker.postMessage({
            type: 'PARSE_EXCEL',
            payload: {
                file,
                mapping,
                fileType: 'ACCOUNTING',
                fileName: file.name,
                headerRowIndex,
                mode,
            },
        });

        worker.onmessage = (event) => {
            if (event.data.type === 'PARSE_SUCCESS') {
                resolve({ success: true, data: event.data.payload.rows });
            } else if (event.data.type === 'PARSE_ERROR') {
                resolve({ success: false, error: event.data.payload });
            }
            worker.terminate();
        };

        worker.onerror = (error) => {
            resolve({ success: false, error: 'Worker error: ' + String(error) });
            worker.terminate();
        }
    });
};

export const processAccountingMatrahFile = (
    file: File,
    mapping: Record<string, string>,
    headerRowIndex: number
): Promise<ExcelProcessResult<any[]>> => {
    return new Promise((resolve) => {
        const worker = new Worker(new URL('../../../workers/reconciliation.worker.ts', import.meta.url), { type: 'module' });

        worker.postMessage({
            type: 'PARSE_EXCEL',
            payload: {
                file,
                mapping,
                fileType: 'ACCOUNTING',
                fileName: file.name,
                headerRowIndex,
            },
        });

        worker.onmessage = (event) => {
            if (event.data.type === 'PARSE_SUCCESS') {
                resolve({ success: true, data: event.data.payload.rows });
            } else if (event.data.type === 'PARSE_ERROR') {
                resolve({ success: false, error: event.data.payload });
            }
            worker.terminate();
        };

        worker.onerror = (error) => {
            resolve({ success: false, error: 'Worker error: ' + String(error) });
            worker.terminate();
        }
    });
};
