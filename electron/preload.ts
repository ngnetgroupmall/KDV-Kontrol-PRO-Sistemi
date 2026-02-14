import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    restartApp: () => {
        ipcRenderer.send('restart-app');
    },
    onUpdateMessage: (callback: (message: string) => void) => {
        const listener = (_event: IpcRendererEvent, message: string) => callback(message);
        ipcRenderer.on('update-message', listener);
        return () => ipcRenderer.removeListener('update-message', listener);
    },
    onUpdateDownloadProgress: (callback: (percent: number) => void) => {
        const listener = (_event: IpcRendererEvent, percent: number) => callback(percent);
        ipcRenderer.on('update-download-progress', listener);
        return () => ipcRenderer.removeListener('update-download-progress', listener);
    },
    onUpdateDownloaded: (callback: (message: string) => void) => {
        const listener = (_event: IpcRendererEvent, message: string) => callback(message);
        ipcRenderer.on('update-downloaded', listener);
        return () => ipcRenderer.removeListener('update-downloaded', listener);
    },
});
