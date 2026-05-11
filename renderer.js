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

// Listen for real-time media updates from Windows or Browser Extension
ipcRenderer.on('media-update', (event, data) => {
    if (data && data.Title) {
        // Clean up title
        let displayTitle = data.Title.replace(/ - YouTube Music$/i, '').replace(/ - YouTube$/i, '').trim();
        let displayArtist = data.Artist || "Unknown Artist";

        // If it's a weak update and we already have a better title, don't overwrite
        if (displayTitle.toLowerCase() === 'youtube music' && title.innerText !== 'Scanning...' && title.innerText !== 'Music') {
            return; 
        }

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
        if (data.Thumbnail) {
            thumb.src = data.Thumbnail;
            thumb.style.display = 'block';
            container.style.backgroundImage = `linear-gradient(to right, rgba(32, 32, 32, 0.95), rgba(32, 32, 32, 0.8)), url('${data.Thumbnail}')`;
            container.style.backgroundSize = 'cover';
            container.style.backgroundPosition = 'center';
        } else {
            thumb.style.display = 'none';
            container.style.backgroundImage = 'none';
        }
        
        // Update Source Icon
        const isYouTube = data.Title.toLowerCase().includes('youtube') || 
                          (data.Artist && data.Artist.toLowerCase().includes('youtube')) || 
                          data.Method === 'YouTube' || data.Method === 'YouTube Music';
                          
        if (isYouTube) {
            sourceIcon.innerText = "▶";
            sourceIcon.className = "source-youtube";
        } else {
            sourceIcon.innerText = "●";
            sourceIcon.className = "source-spotify";
        }
    }
});

/* 
   NOTE FOR PRODUCTION:
   To connect to actual Windows Global Media (YouTube/Spotify):
   You would use a library like 'node-windows-media-controls' 
   which interfaces with the Windows SMTC API.
*/
