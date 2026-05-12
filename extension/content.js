// content.js - Runs inside YouTube/Spotify tabs
let lastData = { Title: '', Artist: '', Thumbnail: '', Progress: 0, timestamp: 0 };

function sendUpdate() {
    let title = '';
    let artist = '';
    let thumbnail = '';
    let progress = 0;
    let duration = 0;
    let isPlaying = false;

    const video = document.querySelector('video');
    if (video) {
        progress = video.currentTime;
        duration = video.duration;
        isPlaying = !video.paused;
    }

    // --- 1. YouTube Music Specific ---
    if (window.location.host.includes('music.youtube.com')) {
        title = document.querySelector('yt-formatted-string.title.ytmusic-player-bar')?.innerText ||
                document.querySelector('.ytmusic-player-bar .title')?.innerText;
        
        artist = document.querySelector('yt-formatted-string.byline.ytmusic-player-bar')?.title ||
                 document.querySelector('yt-formatted-string.byline.ytmusic-player-bar')?.innerText ||
                 document.querySelector('.ytmusic-player-bar .byline')?.innerText;
        
        // Thumbnail - YouTube Music uses a specific image element in the player bar
        const thumbEl = document.querySelector('ytmusic-player-bar img.image') || 
                        document.querySelector('.image.ytmusic-player-bar img') ||
                        document.querySelector('#song-image img') ||
                        document.querySelector('ytmusic-player img#img');
        if (thumbEl) thumbnail = thumbEl.src;

        // Progress
        const video = document.querySelector('video');
        if (video) {
            progress = video.currentTime;
            duration = video.duration;
        }
    } 
    // --- 2. Standard YouTube ---
    else if (window.location.host.includes('youtube.com')) {
        title = document.querySelector('h1.ytd-video-primary-info-renderer')?.innerText || 
                document.querySelector('.ytp-title-link')?.innerText;
        artist = document.querySelector('#upload-info .ytd-channel-name a')?.innerText || 'YouTube';
        
        const videoId = new URLSearchParams(window.location.search).get('v');
        if (videoId) {
            thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
    }
    // --- 3. Spotify ---
    else if (window.location.host.includes('spotify.com')) {
        title = document.querySelector('[data-testid="now-playing-widget-track-link"]')?.innerText;
        artist = document.querySelector('[data-testid="now-playing-widget-artist-link"]')?.innerText;
        thumbnail = document.querySelector('[data-testid="now-playing-widget"] img')?.src;
        
        const progEl = document.querySelector('[data-testid="playback-position"]');
        const durEl = document.querySelector('[data-testid="playback-duration"]');
        if (progEl && durEl) {
            const parseTime = (str) => str.split(':').reduce((acc, time) => (60 * acc) + +time, 0);
            progress = parseTime(progEl.innerText);
            duration = parseTime(durEl.innerText);
        }
    }

    // Fallback: MediaSession API
    if (!title && navigator.mediaSession?.metadata) {
        title = navigator.mediaSession.metadata.title;
        artist = navigator.mediaSession.metadata.artist;
        if (!thumbnail) thumbnail = navigator.mediaSession.metadata.artwork?.[0]?.src;
    }

    // Fallback: Document Title
    if (!title) title = document.title;

    // Clean up
    if (title) {
        title = title.replace(/ - YouTube Music$/i, '').replace(/ - YouTube$/i, '').trim();
    }

    const isGeneric = !title || ['youtube', 'spotify', 'music', 'youtube music', 'home'].includes(title.toLowerCase().trim());
    
    if (!isGeneric) {
        const payload = { 
            Title: title, 
            Artist: artist || "Unknown Artist", 
            Thumbnail: thumbnail, 
            Status: isPlaying ? 'Playing' : 'Paused',
            Progress: progress,
            Duration: duration,
            Method: window.location.host.includes('music.youtube.com') ? 'YouTube Music' : 
                    window.location.host.includes('youtube.com') ? 'YouTube' : 'Spotify' 
        };

        const now = Date.now();
        const timeSinceLast = now - lastData.timestamp;

        // CRITICAL UPDATE LOGIC:
        // 1. Title changed (New song)
        // 2. Progress moved > 1s (Playing)
        // 3. Thumbnail was missing but is now found (Better data!)
        // 4. Heartbeat (Ensure app is synced)
        
        const isNewTitle = title !== lastData.Title;
        const isNewThumb = thumbnail && !lastData.Thumbnail;
        const isProgMove = Math.abs(progress - lastData.Progress) > 1;
        const isHeartbeat = timeSinceLast > 1000; // Increased frequency to 1s

        if (isNewTitle || isNewThumb || isProgMove || isHeartbeat) {
            lastData = { ...payload, timestamp: now };
            
            try {
                if (chrome.runtime?.id) {
                    chrome.runtime.sendMessage({ type: 'MEDIA_UPDATE', data: payload });
                } else {
                    clearInterval(updateInterval);
                }
            } catch (e) {
                clearInterval(updateInterval);
            }
        }
    }
}

const updateInterval = setInterval(sendUpdate, 1000);
sendUpdate();

// Listen for commands from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'pause') {
        const video = document.querySelector('video');
        if (video && !video.paused) {
            video.pause();
            // Send immediate update so the UI reflects pause
            sendUpdate();
        }
    } else if (request.command === 'play') {
        const video = document.querySelector('video');
        if (video) {
            video.play().catch(() => {
                // Autoplay block or error - try clicking UI buttons
                const playBtns = [
                    '.ytp-play-button', // YouTube
                    '[data-testid="play-button"]', // Spotify
                    '.play-pause-button', // YouTube Music
                    '[data-testid="control-button-playpause"]' // Generic Spotify
                ];
                for (let selector of playBtns) {
                    const btn = document.querySelector(selector);
                    if (btn) {
                        btn.click();
                        break;
                    }
                }
            });
            setTimeout(sendUpdate, 500); // Send sync update after play attempt
        }
    } else if (request.command === 'seek') {
        const video = document.querySelector('video');
        if (video) {
            video.currentTime = request.time;
            // Delay update to let browser sync the new currentTime
            setTimeout(sendUpdate, 200);
        }
    } else if (request.command === 'shuffle') {
        const shuffleBtns = [
            '[data-testid="control-button-shuffle"]', // Spotify
            '.shuffle.ytmusic-player-bar', // YouTube Music
            '[aria-label="Shuffle"]', // Generic
            '.ytp-shuffle-button' // YouTube Playlist
        ];
        for (let selector of shuffleBtns) {
            const btn = document.querySelector(selector);
            if (btn) {
                btn.click();
                break;
            }
        }
    }
});
