// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const dynamicToggle = document.getElementById('dynamicTheming');
    const visualizerToggle = document.getElementById('visualizer');
    const scrollingToggle = document.getElementById('scrollingTitle');

    // Load saved settings
    chrome.storage.local.get(['dynamicTheming', 'visualizer', 'scrollingTitle'], (result) => {
        dynamicToggle.checked = result.dynamicTheming !== false;
        visualizerToggle.checked = result.visualizer !== false;
        scrollingToggle.checked = result.scrollingTitle !== false;
    });

    // Save on change
    dynamicToggle.addEventListener('change', () => {
        chrome.storage.local.set({ dynamicTheming: dynamicToggle.checked });
    });

    visualizerToggle.addEventListener('change', () => {
        chrome.storage.local.set({ visualizer: visualizerToggle.checked });
    });

    scrollingToggle.addEventListener('change', () => {
        chrome.storage.local.set({ scrollingTitle: scrollingToggle.checked });
    });
});
