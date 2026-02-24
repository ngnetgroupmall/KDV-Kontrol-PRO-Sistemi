import electron from 'electron'
import type { BrowserWindow as BrowserWindowType } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { autoUpdater } from 'electron-updater'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { app, BrowserWindow, ipcMain, Menu } = electron

const mainLogPath = path.join(process.env.TEMP || process.cwd(), 'ng-net-main.log')
const writeMainLog = (message: string) => {
    try {
        fs.appendFileSync(mainLogPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8')
    } catch {
        // ignore log errors
    }
}

process.on('uncaughtException', (error) => {
    writeMainLog(`uncaughtException: ${error?.stack || error?.message || String(error)}`)
})

process.on('unhandledRejection', (reason) => {
    const text = reason instanceof Error ? `${reason.message}\n${reason.stack || ''}` : String(reason)
    writeMainLog(`unhandledRejection: ${text}`)
})

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindowType | null

// Configure Auto Updater
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

function createWindow() {
    writeMainLog(
        `createWindow start. isPackaged=${String(app.isPackaged)} DIST=${process.env.DIST} VITE_PUBLIC=${process.env.VITE_PUBLIC}`,
    )
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC!, 'logo.png'),
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        minWidth: 1200,
        width: 1280,
        height: 800,
        title: 'NG NET SMMM AI',
    })
    win.removeMenu()
    win.setMenuBarVisibility(false)

    win.webContents.on('did-finish-load', () => {
        writeMainLog('renderer did-finish-load')
    })
    win.webContents.on('did-fail-load', (_event, code, desc, url) => {
        writeMainLog(`renderer did-fail-load code=${code} desc=${desc} url=${url}`)
    })
    win.webContents.on('render-process-gone', (_event, details) => {
        writeMainLog(`renderer gone reason=${details.reason} exitCode=${details.exitCode}`)
    })
    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        if (level >= 2) {
            writeMainLog(`renderer console level=${level} ${sourceId}:${line} ${message}`)
        }
    })

    // Auto updater events
    autoUpdater.on('checking-for-update', () => {
        writeMainLog('autoUpdater checking-for-update')
        win?.webContents.send('update-message', 'Guncellemeler denetleniyor...')
    })

    autoUpdater.on('update-available', (info) => {
        writeMainLog(`autoUpdater update-available version=${info.version}`)
        win?.webContents.send('update-message', `Yeni surum bulundu: v${info.version}. Indiriliyor...`)
    })

    autoUpdater.on('update-not-available', () => {
        writeMainLog('autoUpdater update-not-available')
        win?.webContents.send('update-message', 'Uygulama guncel.')
    })

    autoUpdater.on('error', (err) => {
        writeMainLog(`autoUpdater error: ${err.message}`)
        win?.webContents.send('update-message', `Guncelleme hatasi: ${err.message}`)
    })

    autoUpdater.on('download-progress', (progressObj) => {
        writeMainLog(`autoUpdater download-progress ${progressObj.percent.toFixed(2)}%`)
        win?.webContents.send('update-download-progress', progressObj.percent)
    })

    autoUpdater.on('update-downloaded', () => {
        writeMainLog('autoUpdater update-downloaded')
        win?.webContents.send('update-downloaded', 'Guncelleme indirildi. Yeniden baslatildiginda kurulacak.')
    })

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString())
        // Start checking for updates after load
        if (app.isPackaged) {
            writeMainLog('autoUpdater checkForUpdatesAndNotify start')
            void autoUpdater.checkForUpdatesAndNotify().catch((error) => {
                const message = error instanceof Error ? error.message : String(error)
                writeMainLog(`autoUpdater checkForUpdatesAndNotify failed: ${message}`)
                win?.webContents.send('update-message', `Guncelleme kontrolu basarisiz: ${message}`)
            })
        } else {
            writeMainLog('autoUpdater skipped (app.isPackaged=false)')
        }
    })

    if (process.env.VITE_DEV_SERVER_URL) {
        writeMainLog(`loadURL ${process.env.VITE_DEV_SERVER_URL}`)
        win.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
        const indexPath = path.join(process.env.DIST!, 'index.html')
        writeMainLog(`loadFile ${indexPath}`)
        win.loadFile(indexPath)
    }
}

// IPC for Manual Install
ipcMain.on('restart-app', () => {
    writeMainLog('ipc restart-app -> autoUpdater.quitAndInstall')
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

app.whenReady().then(() => {
    writeMainLog('app.whenReady resolved')
    Menu.setApplicationMenu(null)
    createWindow()
})
