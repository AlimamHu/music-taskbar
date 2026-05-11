// background.js
let activeTabId = null;
let sessions = {}; // tabId -> mediaData

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'MEDIA_UPDATE') {
        const tabId = sender.tab.id;
        const isPlaying = request.data.Status === 'Playing';

        // Update sessions list
        sessions[tabId] = { ...request.data, tabId: tabId, lastUpdate: Date.now() };

        if (isPlaying) {
            // If another tab was playing, tell it to pause
            if (activeTabId !== null && activeTabId !== tabId) {
                chrome.tabs.sendMessage(activeTabId, { command: 'pause' }).catch(() => {});
            }
            activeTabId = tabId;
        }

        // Always forward updates to the app so it can manage the full session list
        // main.js will handle which one to show as the "current" track
        request.data.tabId = tabId; // Ensure current data has tabId
        
        const payload = {
            current: request.data,
            allSessions: Object.values(sessions)
        };

        fetch('http://localhost:3456/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(cmd => {
            if (cmd && cmd.command === 'play-tab') {
                const targetTabId = parseInt(cmd.tabId);
                
                // 1. If there's an active tab that isn't the target, pause it first
                if (activeTabId !== null && activeTabId !== targetTabId) {
                    chrome.tabs.sendMessage(activeTabId, { command: 'pause' }).catch(() => {});
                }
                
                // 2. Tell the target tab to play
                chrome.tabs.sendMessage(targetTabId, { command: 'play' }).catch(() => {
                    console.error('Failed to send play to tab', targetTabId);
                });
                
                activeTabId = targetTabId;
            } else if (cmd && cmd.command === 'focus-tab') {
                const targetTabId = parseInt(cmd.tabId);
                chrome.tabs.get(targetTabId, (tab) => {
                    if (tab) {
                        chrome.tabs.update(targetTabId, { active: true });
                        chrome.windows.update(tab.windowId, { focused: true });
                    }
                });
            }
        })
        .catch(err => {});
    }
});

// Clean up sessions when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    delete sessions[tabId];
    if (activeTabId === tabId) activeTabId = null;
});
