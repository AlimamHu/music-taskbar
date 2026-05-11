// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'MEDIA_UPDATE') {
        fetch('http://localhost:3456/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request.data)
        }).catch(err => console.error('Local server not found'));
    }
});
