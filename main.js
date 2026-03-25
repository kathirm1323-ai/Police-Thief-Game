const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'public/game_icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
        backgroundColor: '#0a0a1a'
    });

    // Start the server
    serverProcess = fork(path.join(__dirname, 'server.js'));

    // Wait for server to start, then load
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
    }, 2000);

    mainWindow.on('closed', function () {
        mainWindow = null;
        if (serverProcess) serverProcess.kill();
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});
