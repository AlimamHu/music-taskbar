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

    // Method 1: Try MediaSession API (Modern)
    if (navigator.mediaSession && navigator.mediaSession.metadata) {
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
            
            // Send to background script instead of fetching directly
            chrome.runtime.sendMessage({
                type: 'MEDIA_UPDATE',
                data: payload
            });
        }
    }
}

// Check every 1 second for progress updates
setInterval(sendUpdate, 1000);
sendUpdate();
