// background.js
let activeTabId = null;
let sessions = {}; // tabId -> mediaData

function handleCommands(commands) {
    if (!Array.isArray(commands)) return;
    
    commands.forEach(cmd => {
        if (cmd.command === 'play-tab') {
            const targetTabId = parseInt(cmd.tabId);
            if (activeTabId !== null && activeTabId !== targetTabId) {
                chrome.tabs.sendMessage(activeTabId, { command: 'pause' }).catch(() => {});
            }
            chrome.tabs.sendMessage(targetTabId, { command: 'play' }).catch(() => {});
            activeTabId = targetTabId;
        } else if (cmd.command === 'focus-tab') {
            const targetTabId = parseInt(cmd.tabId);
            chrome.tabs.get(targetTabId, (tab) => {
                if (tab) {
                    chrome.tabs.update(targetTabId, { active: true });
                    chrome.windows.update(tab.windowId, { 
                        focused: true,
                        drawAttention: true
                    });
                }
            });
        } else if (cmd.command === 'seek') {
            const targetTabId = parseInt(cmd.tabId);
            if (!isNaN(targetTabId)) {
                chrome.tabs.sendMessage(targetTabId, { command: 'seek', time: cmd.time }).catch(() => {});
            }
        } else if (cmd.command === 'shuffle') {
            const targetTabId = parseInt(cmd.tabId);
            if (!isNaN(targetTabId)) {
                chrome.tabs.sendMessage(targetTabId, { command: 'shuffle' }).catch(() => {});
            }
        }
    });
}

// Poll for commands every 500ms for high responsiveness
setInterval(() => {
    fetch('http://localhost:3456/commands')
        .then(res => res.json())
        .then(handleCommands)
        .catch(() => {});
}, 500);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'MEDIA_UPDATE') {
        const tabId = sender.tab.id;
        const isPlaying = request.data.Status === 'Playing';

        sessions[tabId] = { ...request.data, tabId: tabId, lastUpdate: Date.now() };

        if (isPlaying) {
            if (activeTabId !== null && activeTabId !== tabId) {
                chrome.tabs.sendMessage(activeTabId, { command: 'pause' }).catch(() => {});
            }
            activeTabId = tabId;
        }

        chrome.storage.local.get(['dynamicTheming', 'visualizer', 'scrollingTitle', 'progressStyle', 'posX', 'posY', 'lockPosition'], (settings) => {
            request.data.tabId = tabId;
            request.data.settings = {
                dynamicTheming: settings.dynamicTheming !== false,
                visualizer: settings.visualizer !== false,
                scrollingTitle: settings.scrollingTitle !== false,
                progressStyle: settings.progressStyle || 'classic',
                posX: settings.posX,
                posY: settings.posY,
                lockPosition: settings.lockPosition || false
            };
            
            const payload = {
                current: request.data,
                allSessions: Object.values(sessions).sort((a, b) => a.tabId - b.tabId)
            };

            fetch('http://localhost:3456/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(handleCommands)
            .catch(err => {});
        });
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    delete sessions[tabId];
    if (activeTabId === tabId) activeTabId = null;
});
