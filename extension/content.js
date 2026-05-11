// content.js - Runs inside YouTube/Spotify tabs
let lastData = { Title: '', Artist: '', Thumbnail: '' };

function sendUpdate() {
    let title = '';
    let artist = '';
    let thumbnail = '';
    let progress = 0;
    let duration = 0;

    // Get Progress from video elements
    const video = document.querySelector('video');
    if (video) {
        progress = video.currentTime;
        duration = video.duration;
    }

    // Thumbnail Selection
    thumbnail = "";
    
    if (window.location.host.includes('music.youtube.com')) {
        // YouTube Music
        thumbnail = document.querySelector('.image.ytmusic-player-bar img')?.src || 
                    document.querySelector('#thumbnail img')?.src ||
                    document.querySelector('ytmusic-player img#img')?.src;
    } else if (window.location.host.includes('youtube.com')) {
        // YouTube Video
        const videoId = new URLSearchParams(window.location.search).get('v');
        if (videoId) {
            thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
    } else if (window.location.host.includes('spotify.com')) {
        // Spotify
        thumbnail = document.querySelector('[data-testid="now-playing-widget"] img')?.src ||
                    document.querySelector('.now-playing-widget img')?.src;
    }

    if (window.location.host.includes('music.youtube.com')) {
        title = document.querySelector('.ytmusic-player-bar .title')?.innerText;
        artist = document.querySelector('.ytmusic-player-bar .byline')?.innerText;
        const progressEl = document.querySelector('#progress-bar');
        if (progressEl) {
            progress = progressEl.value;
            duration = progressEl.max;
        }
    }

    // Method 1: Try MediaSession API (Modern)
    if (!title && navigator.mediaSession && navigator.mediaSession.metadata) {
        title = navigator.mediaSession.metadata.title;
        artist = navigator.mediaSession.metadata.artist;
        const artworks = navigator.mediaSession.metadata.artwork;
        if (artworks && artworks.length > 0) {
            thumbnail = artworks[artworks.length - 1].src;
        }
    }

    // Method 2: DOM Scrapping (Fallback for YouTube)
    if (!title && window.location.host.includes('youtube.com')) {
        title = document.querySelector('h1.ytd-video-primary-info-renderer')?.innerText || document.title;
        artist = document.querySelector('#upload-info .ytd-channel-name a')?.innerText || 'YouTube';
    }

    // Clean up title
    if (title) {
        title = title.replace(/ - YouTube Music$/i, '')
                     .replace(/ - YouTube$/i, '')
                     .replace(/ \| YouTube Music$/i, '')
                     .trim();
    }

    // Only send if it's a real song and something changed significantly
    const isGeneric = ['youtube', 'spotify', 'music', 'youtube music'].includes(title.toLowerCase().trim());
    
    // We send every 1s if progress changed, but keep threshold for title change
    if (title && !isGeneric) {
        const payload = { 
            Title: title, 
            Artist: artist, 
            Thumbnail: thumbnail, 
            Status: (video && !video.paused) ? 'Playing' : 'Paused',
            Progress: progress,
            Duration: duration,
            Method: window.location.host.includes('youtube') ? 'YouTube' : 'Spotify' 
        };

        // Throttle: Send if title changed OR every 1s if playing
        if (title !== lastData.Title || Math.abs(progress - lastData.Progress) > 1) {
            lastData = payload;
            
            // Send to background script safely
            try {
                if (chrome.runtime && chrome.runtime.id) {
                    chrome.runtime.sendMessage({
                        type: 'MEDIA_UPDATE',
                        data: payload
                    });
                } else {
                    clearInterval(updateInterval); // Stop if extension was reloaded/removed
                }
            } catch (e) {
                clearInterval(updateInterval);
            }
        }
    }
}

// Check every 1 second for progress updates
const updateInterval = setInterval(sendUpdate, 1000);
sendUpdate();
