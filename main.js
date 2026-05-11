const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const http = require('http');

let mainWindow;
let lastGoodUpdate = 0; // Timestamp of last detailed update (Extension or SMTC)
let lastReceivedTitle = ""; // For window focusing

// Extension Listener
function startServer() {
    http.createServer((req, res) => {
        // Handle CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (mainWindow && data.Title) {
                        lastGoodUpdate = Date.now(); // Mark as high-quality data
                        lastReceivedTitle = data.Title;
                        mainWindow.webContents.send('media-update', data);
                    }
                } catch (e) {
                    console.error('Failed to parse POST body:', e);
                }
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('ok');
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    }).listen(3456); // Listen on all local interfaces
}

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  // Controller dimensions
  const winWidth = 400;
  const winHeight = 50; 

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: screenWidth - winWidth - 20, 
    y: screenHeight - winHeight - 10, 
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  // Prevent closing
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

app.whenReady().then(() => {
  createWindow();
  startServer(); // Start listening for the extension
  startMediaPolling();

  // Register Shortcut: Ctrl + .
  globalShortcut.register('CommandOrControl+.', () => {
      if (mainWindow.isVisible()) {
          mainWindow.hide();
      } else {
          mainWindow.show();
      }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

function startMediaPolling() {
  const scriptPath = path.join(__dirname, 'get_media.ps1');
  
  setInterval(() => {
    // Use the optimized PowerShell script instead of tasklist
    exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (error, stdout) => {
      if (error) {
        console.error('PS Error:', error);
        return;
      }

      try {
        const trimmed = stdout.trim();
        if (!trimmed || trimmed === "null") return;

        const foundData = JSON.parse(trimmed);
        if (foundData && foundData.Title && mainWindow) {
          
          // Only use Method 2 (Window Title) if we haven't had a good update in 5 seconds
          const isWeakData = (foundData.Method === 'Spotify' || foundData.Method === 'YouTube');
          const timeSinceGoodUpdate = Date.now() - lastGoodUpdate;

          if (!isWeakData || timeSinceGoodUpdate > 5000) {
              if (!isWeakData) lastGoodUpdate = Date.now();
              lastReceivedTitle = foundData.Title;
              mainWindow.webContents.send('media-update', foundData);
          }
        }
      } catch (e) {
        console.error('Parse Error:', e, 'Raw output:', stdout);
      }
    });
  }, 1000); // Check every 1s
}

// Media Control Listeners
ipcMain.on('media-command', (event, command) => {
  let key;
  if (command === 'play-pause') key = 179;
  if (command === 'next') key = 176;
  if (command === 'prev') key = 177;

  if (key) {
    exec(`powershell -command "$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys([char]${key})"`);
  }
});

ipcMain.on('focus-source', () => {
    // Try to find the window by the current playing title
    const cleanTitle = lastReceivedTitle.split(' - ')[0].replace(/"/g, ''); 
    const psScript = `
      $wshell = New-Object -ComObject WScript.Shell;
      $title = "${cleanTitle}";
      $proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*$title*" -and $_.MainWindowTitle -ne "" } | Select-Object -First 1;
      if ($proc) {
        $wshell.AppActivate($proc.Id)
      } else {
        # Fallback to player processes
        $fallback = Get-Process | Where-Object { ($_.ProcessName -match "chrome|msedge|spotify") -and $_.MainWindowTitle -ne "" } | Select-Object -First 1;
        if ($fallback) { $wshell.AppActivate($fallback.Id) }
      }
    `;
    exec(`powershell -command "${psScript.replace(/\n/g, '')}"`);
});

ipcMain.on('window-command', (event, command) => {
    if (command === 'close') {
        app.quit();
    }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
