const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const http = require('http');

let mainWindow;
let lastGoodUpdate = 0; // Timestamp of last detailed update (Extension or SMTC)
let lastReceivedTitle = ""; // For window focusing
let currentPlaybackStatus = "Stopped";
let currentPlaybackSource = "";
let commandQueue = [];

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

        if (req.method === 'GET' && req.url === '/commands') {
            const commands = [...commandQueue];
            commandQueue.length = 0;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(commands));
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const payload = JSON.parse(body);
                    const data = payload.current || payload; 
                    
                    if (mainWindow && data.Title) {
                        const isPlaying = data.Status === 'Playing' || data.Status === 'playing';
                        const sourceId = data.Title + data.Artist;

                        if (isPlaying || currentPlaybackStatus !== 'Playing' || currentPlaybackSource === sourceId) {
                            currentPlaybackStatus = isPlaying ? 'Playing' : 'Paused';
                            currentPlaybackSource = sourceId;
                            lastGoodUpdate = Date.now();
                            lastReceivedTitle = data.Title;
                            mainWindow.webContents.send('media-update', data);
                        }

                        if (payload.allSessions) {
                            mainWindow.webContents.send('sessions-update', payload.allSessions);
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse POST body:', e);
                }
                
                const commands = [...commandQueue];
                commandQueue.length = 0; 
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(commands));
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    }).listen(3456);
}

ipcMain.on('switch-tab', (event, tabId) => {
    commandQueue.push({ command: 'play-tab', tabId: tabId });
});

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
          const isPlaying = foundData.Status === 'Playing' || foundData.Status === 'playing';
          const sourceId = foundData.Title + foundData.Artist;
          
          // Only use Method 2 (Window Title) if we haven't had a good update in 5 seconds
          const isWeakData = (foundData.Method === 'Spotify' || foundData.Method === 'YouTube');
          const timeSinceGoodUpdate = Date.now() - lastGoodUpdate;

          if (!isWeakData || timeSinceGoodUpdate > 5000) {
              // Priority check across sources
              if (isPlaying || currentPlaybackStatus !== 'Playing' || currentPlaybackSource === sourceId) {
                  currentPlaybackStatus = isPlaying ? 'Playing' : 'Paused';
                  currentPlaybackSource = sourceId;
                  
                  if (!isWeakData) lastGoodUpdate = Date.now();
                  lastReceivedTitle = foundData.Title;
                  mainWindow.webContents.send('media-update', foundData);
              }
          }
        }
      } catch (e) {
        console.error('Parse Error:', e, 'Raw output:', stdout);
      }
    });
  }, 1000); // Check every 1s
}

// Media Control Listeners
ipcMain.on('media-command', (event, arg) => {
  const command = typeof arg === 'string' ? arg : arg.command;
  
  if (command === 'seek') {
    commandQueue.push({ command: 'seek', time: arg.time, tabId: arg.tabId });
    return;
  }

  let key;
  if (command === 'play-pause') key = 179;
  if (command === 'next') key = 176;
  if (command === 'prev') key = 177;

  if (key) {
    exec(`powershell -command "$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys([char]${key})"`);
  }
});

ipcMain.on('focus-source', (event, tabId) => {
    if (tabId) {
        commandQueue.push({ command: 'focus-tab', tabId: tabId });
    }
    
    // Always try the PowerShell fallback as well, in case it's a desktop app or 
    // to bring the browser window itself to the foreground via OS
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
