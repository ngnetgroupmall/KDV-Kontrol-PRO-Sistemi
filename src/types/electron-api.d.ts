export {};

declare global {
    interface Window {
        electronAPI?: {
            restartApp: () => void;
            onUpdateMessage: (callback: (message: string) => void) => () => void;
            onUpdateDownloadProgress: (callback: (percent: number) => void) => () => void;
            onUpdateDownloaded: (callback: (message: string) => void) => () => void;
        };
    }
}
