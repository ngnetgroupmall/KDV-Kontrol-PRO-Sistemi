import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { autoUpdater } from 'electron-updater'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')


let win: BrowserWindow | null

// Configure Auto Updater
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC!, 'logo.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        minWidth: 1200,
        width: 1280,
        height: 800,
        title: 'KDV Kontrol PRO',
    })

    // Auto updater events
    autoUpdater.on('checking-for-update', () => {
        win?.webContents.send('update-message', 'Güncellemeler denetleniyor...')
    })

    autoUpdater.on('update-available', (info) => {
        win?.webContents.send('update-message', `Yeni sürüm bulundu: v${info.version}. İndiriliyor...`)
    })

    autoUpdater.on('update-not-available', () => {
        win?.webContents.send('update-message', 'Uygulama güncel.')
    })

    autoUpdater.on('error', (err) => {
        win?.webContents.send('update-message', `Güncelleme hatası: ${err.message}`)
    })

    autoUpdater.on('download-progress', (progressObj) => {
        win?.webContents.send('update-download-progress', progressObj.percent)
    })

    autoUpdater.on('update-downloaded', () => {
        win?.webContents.send('update-downloaded', 'Güncelleme indirildi. Yeniden başlatıldığında kurulacak.')
    })

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date()).toLocaleString())
        // Start checking for updates after load
        if (app.isPackaged) {
            autoUpdater.checkForUpdatesAndNotify()
        }
    })

    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(process.env.DIST!, 'index.html'))
    }
}

// IPC for Manual Install
ipcMain.on('restart-app', () => {
    autoUpdater.quitAndInstall()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(createWindow)
