const { ipcRenderer } = require('electron');

const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const playSvg = document.getElementById('play-svg');
const title = document.getElementById('title');
const artist = document.getElementById('artist');
const sourceIcon = document.getElementById('source-icon');

let isPlaying = false;

const container = document.getElementById('app-container');
const toggleMini = document.getElementById('toggle-mini');
const closeApp = document.getElementById('close-app');

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

// Play/Pause
playBtn.addEventListener('click', () => {
    ipcRenderer.send('media-command', 'play-pause');
    // Instant UI feedback for better feel
    isPlaying = !isPlaying;
    updatePlayUI();
});

// Previous
prevBtn.addEventListener('click', () => {
    ipcRenderer.send('media-command', 'prev');
});

// Next
nextBtn.addEventListener('click', () => {
    ipcRenderer.send('media-command', 'next');
});

function updatePlayUI() {
    if (isPlaying) {
        playSvg.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'; // Pause
    } else {
        playSvg.innerHTML = '<path d="M8 5v14l11-7z"/>'; // Play
    }
}

let currentProgress = 0;
let currentDuration = 0;
let progressInterval;

function startProgressTimer() {
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        if (isPlaying && currentProgress < currentDuration) {
            currentProgress += 0.1;
            updateProgressBar();
        }
    }, 100);
}

function updateProgressBar() {
    const progressBar = document.getElementById('progress-bar');
    if (currentDuration > 0) {
        const percent = (currentProgress / currentDuration) * 100;
        progressBar.style.width = `${percent}%`;
    } else {
        progressBar.style.width = '0%';
    }
}

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

let allSessions = [];
let lastRealData = null;
let peekIndex = -1;
let peekTimer = null;

function renderMedia(data) {
    if (!data || !data.Title) return;

    // Clean up title
    let displayTitle = data.Title.replace(/ - YouTube Music$/i, '').replace(/ - YouTube$/i, '').trim();
    let displayArtist = data.Artist || "Unknown Artist";

    if (displayTitle.toLowerCase() === 'youtube music' || displayTitle.toLowerCase() === 'youtube') {
        displayTitle = "Music";
    }

    title.innerText = displayTitle;
    artist.innerText = displayArtist;

    // Sync Progress
    currentProgress = data.Progress || 0;
    currentDuration = data.Duration || 0;
    updateProgressBar();
    
    isPlaying = (data.Status === 'Playing' || data.Status === 'playing');
    updatePlayUI();
    
    if (isPlaying) {
        startProgressTimer();
    } else {
        if (progressInterval) clearInterval(progressInterval);
    }

    const thumb = document.getElementById('thumbnail');
    if (data.Thumbnail && data.Thumbnail.startsWith('http')) {
        thumb.src = data.Thumbnail;
        thumb.style.display = 'block';
        container.style.backgroundImage = `linear-gradient(to right, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.6)), url('${data.Thumbnail}')`;
    } else {
        thumb.src = 'https://www.gstatic.com/images/branding/product/1x/youtube_music_64dp.png';
        thumb.style.display = 'block';
        container.style.backgroundImage = 'none';
    }
    
    // Update Source Icon
    const isYTMusic = data.Method === 'YouTube Music';
    const isYouTube = data.Title.toLowerCase().includes('youtube') || 
                      (data.Artist && data.Artist.toLowerCase().includes('youtube')) || 
                      data.Method === 'YouTube';
                      
    if (isYTMusic) {
        sourceIcon.innerText = "♬"; // Music note for YT Music
        sourceIcon.className = "source-ytmusic";
    } else if (isYouTube) {
        sourceIcon.innerText = "▶";
        sourceIcon.className = "source-youtube";
    } else {
        sourceIcon.innerText = "●";
        sourceIcon.className = "source-spotify";
    }
}

// Scroll to Peek
container.addEventListener('wheel', (e) => {
    if (allSessions.length <= 1) return;
    
    e.preventDefault();
    if (peekTimer) clearTimeout(peekTimer);
    
    if (peekIndex === -1) {
        // Start from active or first
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

// Update Tabs List
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
            e.stopPropagation(); // Prevent trigger click
            ipcRenderer.send('focus-source', session.tabId);
        });
        
        tabsList.appendChild(item);
    });
});

// Listen for real-time media updates
ipcRenderer.on('media-update', (event, data) => {
    lastRealData = data;
    // Only update UI if we are not currently peeking
    if (peekIndex === -1) {
        renderMedia(data);
    }
});

/* 
   NOTE FOR PRODUCTION:
   To connect to actual Windows Global Media (YouTube/Spotify):
   You would use a library like 'node-windows-media-controls' 
   which interfaces with the Windows SMTC API.
*/
