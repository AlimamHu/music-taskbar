const { ipcRenderer } = require('electron');

const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const playSvg = document.getElementById('play-svg');
const title = document.getElementById('title');
const artist = document.getElementById('artist');
const sourceIcon = document.getElementById('source-icon');
const thumbnail = document.getElementById('thumbnail');
const container = document.getElementById('app-container');
const toggleMini = document.getElementById('toggle-mini');
const closeApp = document.getElementById('close-app');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const vizContainer = document.getElementById('visualizer-container');

let lastSeekTime = 0;
const SEEK_LOCK_DURATION = 3000; // 3 seconds

function isSeeking() {
    return (Date.now() - lastSeekTime) < SEEK_LOCK_DURATION;
}

// Progress Bar Seeking
progressContainer.addEventListener('click', (e) => {
    if (!lastRealData || !lastRealData.Duration) return;
    
    const rect = progressContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, x / width));
    
    const seekTime = percentage * lastRealData.Duration;
    
    // Lock updates to prevent jumping back
    lastSeekTime = Date.now();

    // Visual feedback: Change color to show it's seeking
    progressBar.classList.add('seeking');
    setTimeout(() => {
        progressBar.classList.remove('seeking');
    }, SEEK_LOCK_DURATION);

    ipcRenderer.send('media-command', { 
        command: 'seek', 
        time: seekTime, 
        tabId: lastRealData.tabId 
    });
    
    // Optimistic UI update
    progressBar.style.width = (percentage * 100) + '%';
    lastRealData.Progress = seekTime;
});

let isPlaying = false;
let allSessions = [];
let lastRealData = null;
let peekIndex = -1;
let peekTimer = null;

// Initialize Visualizer Bars
for (let i = 0; i < 4; i++) {
    const bar = document.createElement('div');
    bar.className = 'visualizer-bar';
    vizContainer.appendChild(bar);
}

// Mini Mode Toggle
toggleMini.addEventListener('click', () => {
    container.classList.toggle('mini');
});

// Close App
closeApp.addEventListener('click', () => {
    ipcRenderer.send('window-command', 'close');
});

// Double click on track info to open source
document.getElementById('track-section').addEventListener('dblclick', () => {
    const tabId = lastRealData ? lastRealData.tabId : null;
    ipcRenderer.send('focus-source', tabId);
});

// Controls
playBtn.addEventListener('click', () => {
    ipcRenderer.send('media-command', 'play-pause');
});

prevBtn.addEventListener('click', () => {
    ipcRenderer.send('media-command', 'prev');
});

nextBtn.addEventListener('click', () => {
    ipcRenderer.send('media-command', 'next');
});

document.getElementById('shuffle').addEventListener('click', () => {
    const tabId = lastRealData ? lastRealData.tabId : null;
    ipcRenderer.send('media-command', { command: 'shuffle', tabId: tabId });
});

// Tabs Panel Toggle
const tabsBtn = document.getElementById('show-tabs');
const tabsPanel = document.getElementById('tabs-panel');
const closeTabs = document.getElementById('close-tabs');
const tabsList = document.getElementById('tabs-list');
const tabCount = document.getElementById('tab-count');

tabsBtn.addEventListener('click', () => {
    tabsPanel.classList.toggle('open');
});

closeTabs.addEventListener('click', () => {
    tabsPanel.classList.remove('open');
});

// Shared canvas for memory efficiency
const themeCanvas = document.createElement('canvas');
const themeCtx = themeCanvas.getContext('2d', { willReadFrequently: true });
themeCanvas.width = 10;
themeCanvas.height = 10;

async function getDominantColor(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => {
            themeCtx.clearRect(0, 0, 10, 10);
            themeCtx.drawImage(img, 0, 0, 10, 10);
            const data = themeCtx.getImageData(0, 0, 10, 10).data;
            
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < data.length; i += 4) {
                r += data[i]; g += data[i+1]; b += data[i+2];
            }
            const count = data.length / 4;
            
            // Cleanup
            img.onload = null;
            img.onerror = null;
            img.src = ""; 
            
            resolve(`rgb(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)})`);
        };
        img.onerror = () => {
            img.onload = null;
            img.onerror = null;
            resolve('#00ff00');
        };
    });
}

let lastRenderedSourceId = "";

async function renderMedia(data) {
    if (!data || !data.Title) return;

    const currentSourceId = (data.Title || '') + (data.Artist || '') + (data.Status || '') + (data.Thumbnail || '');
    const isNewTrack = (data.Title || '') + (data.Artist || '') !== (lastRealData?.Title || '') + (lastRealData?.Artist || '');

    // 1. Update Progress IMMEDIATELY (Before color extraction delay)
    if (data.Duration > 0 && !isSeeking()) {
        const percent = (data.Progress / data.Duration) * 100;
        progressBar.style.width = percent + '%';
    } else if (data.Duration <= 0) {
        progressBar.style.width = '0%';
    }

    // 2. Optimization: If this exact state was already rendered, stop here
    if (currentSourceId === lastRenderedSourceId) return;

    // Apply Settings
    const settings = data.settings || { 
        dynamicTheming: true, 
        visualizer: true, 
        scrollingTitle: true,
        progressStyle: 'classic'
    };

    // Apply Progress Style
    const progressStyle = settings.progressStyle || 'classic';
    progressContainer.className = 'style-' + progressStyle;
    
    // Handle Drag Locking
    if (settings.lockPosition) {
        document.querySelector('.container').style.webkitAppRegion = 'no-drag';
    } else {
        document.querySelector('.container').style.webkitAppRegion = 'drag';
    }

    // Toggle Visualizer
    vizContainer.style.display = settings.visualizer ? 'flex' : 'none';
    if (data.Status === 'Playing') {
        vizContainer.classList.add('playing');
        playSvg.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'; // Pause
    } else {
        vizContainer.classList.remove('playing');
        playSvg.innerHTML = '<path d="M8 5v14l11-7z"/>'; // Play
    }

    // Toggle Dynamic Theming
    if (settings.dynamicTheming && data.Thumbnail) {
        const color = await getDominantColor(data.Thumbnail);
        document.documentElement.style.setProperty('--accent-youtube', color);
        document.documentElement.style.setProperty('--accent-spotify', color);
        progressBar.style.boxShadow = `0 0 15px ${color}, 0 0 5px ${color}`;
    } else {
        document.documentElement.style.setProperty('--accent-youtube', '#00ff00');
        document.documentElement.style.setProperty('--accent-spotify', '#00ff00');
        progressBar.style.boxShadow = `0 0 15px #00ff00, 0 0 5px #00ff00`;
    }

    // Update Text
    let displayTitle = data.Title.replace(/ - YouTube Music$/i, '').replace(/ - YouTube$/i, '').trim();
    if (displayTitle.toLowerCase() === 'youtube music' || displayTitle.toLowerCase() === 'youtube') displayTitle = "Music";
    
    title.innerText = displayTitle;
    artist.innerText = data.Artist || "Unknown Artist";

    // Seamless Scrolling Title Logic
    const wrapper = title.parentElement;
    const isGeneric = displayTitle.toLowerCase() === 'music' || 
                     displayTitle.toLowerCase() === 'youtube' || 
                     displayTitle.toLowerCase() === 'youtube music';

    if (settings.scrollingTitle && !isGeneric) {
        setTimeout(() => {
            const containerWidth = wrapper.offsetWidth;
            const textWidth = title.scrollWidth - 50; 
            
            if (textWidth > containerWidth) {
                const existing = wrapper.querySelectorAll('.title-dup');
                existing.forEach(e => e.remove());
                
                const dup = title.cloneNode(true);
                dup.id = "";
                dup.className = "title-dup";
                wrapper.appendChild(dup);
                
                title.classList.add('scrolling');
                dup.classList.add('scrolling');
                
                const duration = Math.max(8, textWidth / 25); 
                title.style.animationDuration = `${duration}s`;
                dup.style.animationDuration = `${duration}s`;
            } else {
                title.classList.remove('scrolling');
                const existing = wrapper.querySelectorAll('.title-dup');
                existing.forEach(e => e.remove());
            }
        }, 50);
    } else {
        title.classList.remove('scrolling');
        const existing = wrapper.querySelectorAll('.title-dup');
        existing.forEach(e => e.remove());
    }
    
    // Update Thumbnail
    if (data.Thumbnail) {
        thumbnail.src = data.Thumbnail;
        thumbnail.style.display = 'block';
        container.style.backgroundImage = `linear-gradient(rgba(15, 15, 15, 0.8), rgba(15, 15, 15, 0.8)), url(${data.Thumbnail})`;
    } else {
        thumbnail.style.display = 'none';
        container.style.backgroundImage = 'none';
    }
    
    // Progress bar updated at top of function

    // Update Source Icon
    const isYTMusic = data.Method === 'YouTube Music';
    const isYouTube = data.Method === 'YouTube';
                      
    if (isYTMusic) {
        sourceIcon.innerText = "♬";
        sourceIcon.className = "source-ytmusic";
    } else if (isYouTube) {
        sourceIcon.innerText = "▶";
        sourceIcon.className = "source-youtube";
    } else {
        sourceIcon.innerText = "●";
        sourceIcon.className = "source-spotify";
    }

    lastRenderedSourceId = currentSourceId;
}

// Scroll to Peek
container.addEventListener('wheel', (e) => {
    if (allSessions.length <= 1) return;
    e.preventDefault();
    if (peekTimer) clearTimeout(peekTimer);
    
    if (peekIndex === -1) {
        peekIndex = allSessions.findIndex(s => s.Status === 'Playing');
        if (peekIndex === -1) peekIndex = 0;
    }
    
    if (e.deltaY > 0) peekIndex++;
    else peekIndex--;
    
    if (peekIndex >= allSessions.length) peekIndex = 0;
    if (peekIndex < 0) peekIndex = allSessions.length - 1;
    
    renderMedia(allSessions[peekIndex]);
    
    peekTimer = setTimeout(() => {
        peekIndex = -1;
        if (lastRealData) renderMedia(lastRealData);
    }, 5000);
});

// Click to Confirm Peek
document.getElementById('track-section').addEventListener('click', () => {
    if (peekIndex !== -1) {
        const session = allSessions[peekIndex];
        ipcRenderer.send('switch-tab', session.tabId);
        if (peekTimer) clearTimeout(peekTimer);
        peekIndex = -1;
    }
});

// Listen for updates
ipcRenderer.on('sessions-update', (event, sessions) => {
    allSessions = sessions;
    tabCount.innerText = sessions.length;
    tabsList.innerHTML = '';
    
    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = `tab-item ${session.Status === 'Playing' ? 'active' : ''}`;
        const cleanTitle = session.Title.replace(/ - YouTube Music$/i, '').replace(/ - YouTube$/i, '').trim();
        const thumb = session.Thumbnail || 'https://www.gstatic.com/images/branding/product/1x/youtube_music_64dp.png';
        
        item.innerHTML = `
            <img class="tab-thumb" src="${thumb}">
            <div class="tab-info">
                <div class="tab-title">${cleanTitle}</div>
                <div class="tab-artist">${session.Artist || "Unknown"}</div>
            </div>
            <div class="tab-status">${session.Status === 'Playing' ? '▶' : ''}</div>
        `;
        
        item.addEventListener('click', () => {
            ipcRenderer.send('switch-tab', session.tabId);
            tabsPanel.classList.remove('open');
        });

        item.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            ipcRenderer.send('focus-source', session.tabId);
        });
        
        tabsList.appendChild(item);
    });
});

ipcRenderer.on('media-update', (event, data) => {
    if (isSeeking() && lastRealData) {
        // Keep our optimistic progress while seeking
        data.Progress = lastRealData.Progress;
    }
    lastRealData = data;
    if (peekIndex === -1) renderMedia(data);
});
