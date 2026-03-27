const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

/** Chemin ICO fiable sous Windows une fois packagé (hors app.asar). */
function ghostIconPath() {
    const rel = path.join('assets', 'ghost_logo.ico');
    if (app.isPackaged) {
        const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', rel);
        if (fs.existsSync(unpacked)) return unpacked;
    }
    return path.join(__dirname, rel);
}

const APP_ID = 'com.ghostprotocol.v2';
app.setAppUserModelId(APP_ID);

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });
}

let mainWindow = null;
let tray       = null;
let isQuitting = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width:           520,
        height:          960,
        minWidth:        480,
        minHeight:       700,
        resizable:       true,
        frame:           true,
        title:           'Ghost Protocol V2',
        backgroundColor: '#1a1a2e',
        alwaysOnTop:     false,
        skipTaskbar:     false,
        show:            true,
        icon:            ghostIconPath(),
        webPreferences: {
            nodeIntegration:  true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setTitle('Ghost Protocol V2');

    mainWindow.on('close', () => {
        if (!isQuitting) {
            isQuitting = true;
            app.quit();
        }
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

function createTray() {
    try {
        const icon = nativeImage.createFromPath(ghostIconPath());
        tray = new Tray(icon);

        tray.setToolTip('Ghost Protocol V2');
        tray.setContextMenu(Menu.buildFromTemplate([
            {
                label: 'Ouvrir Ghost Protocol V2',
                click: () => {
                    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
                }
            },
            { type: 'separator' },
            {
                label: 'Quitter',
                click: () => { isQuitting = true; app.quit(); }
            }
        ]));

        tray.on('double-click', () => {
            if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
        });
    } catch (err) {
        console.error('Tray error:', err.message);
    }
}

app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => { isQuitting = true; });

ipcMain.on('quit-app', () => { isQuitting = true; app.quit(); });
