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
        chrome.storage.local.get(['dynamicTheming', 'visualizer', 'scrollingTitle'], (settings) => {
            request.data.tabId = tabId;
            request.data.settings = {
                dynamicTheming: settings.dynamicTheming !== false,
                visualizer: settings.visualizer !== false,
                scrollingTitle: settings.scrollingTitle !== false
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
            .then(commands => {
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
                    }
                });
            })
            .catch(err => {});
        });
    }
});

// Clean up sessions when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    delete sessions[tabId];
    if (activeTabId === tabId) activeTabId = null;
});
