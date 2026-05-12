// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const dynamicToggle = document.getElementById('dynamicTheming');
    const visualizerToggle = document.getElementById('visualizer');
    const scrollingToggle = document.getElementById('scrollingTitle');
    const progressSelect = document.getElementById('progressStyle');
    const posXInput = document.getElementById('posX');
    const posYInput = document.getElementById('posY');
    const lockToggle = document.getElementById('lockPosition');

    // Load saved settings
    chrome.storage.local.get(['dynamicTheming', 'visualizer', 'scrollingTitle', 'progressStyle', 'posX', 'posY', 'lockPosition'], (result) => {
        dynamicToggle.checked = result.dynamicTheming !== false;
        visualizerToggle.checked = result.visualizer !== false;
        scrollingToggle.checked = result.scrollingTitle !== false;
        progressSelect.value = result.progressStyle || 'classic';
        posXInput.value = result.posX || '';
        posYInput.value = result.posY || '';
        lockToggle.checked = result.lockPosition || false;
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

    progressSelect.addEventListener('change', () => {
        chrome.storage.local.set({ progressStyle: progressSelect.value });
    });

    posXInput.addEventListener('change', () => {
        chrome.storage.local.set({ posX: parseInt(posXInput.value) });
    });

    posYInput.addEventListener('change', () => {
        chrome.storage.local.set({ posY: parseInt(posYInput.value) });
    });

    lockToggle.addEventListener('change', () => {
        chrome.storage.local.set({ lockPosition: lockToggle.checked });
    });
});
