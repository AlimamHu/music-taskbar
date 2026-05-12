# 🎵 Win11 Music Taskbar Controller

A premium, glassmorphism-inspired music controller for the Windows 11 taskbar. Seamlessly integrate your browser-based music (YouTube, YouTube Music, Spotify) directly into your workspace with a beautiful, real-time interface.

![Main UI Showcase](asset/image.png)

## ✨ Features

### 💎 Premium Glassmorphism UI
Designed with Windows 11 aesthetics in mind, the controller features a sleek dark-acrylic background with real-time backdrop blur. It sits perfectly on your taskbar without obstructing your work.

### 🎨 Dynamic Theming
The app automatically extracts the dominant color from the current track's album art. The **Progress Bar**, **Source Icons**, and **Glow Effects** shift dynamically to match the mood of your music.

### 📊 Audio Wave Visualizer
Experience your music visually with a neon-green pulsating audio visualizer. The bars react instantly to playback, providing high-fidelity visual feedback.

### 📜 Seamless Marquee Title
Long song titles are handled with a professional, infinite-loop marquee. The text scrolls smoothly from right to left with a premium fade-out effect, ensuring you can always read the full track name.

### 📑 Multi-Session Management
![Tabs Panel View](file:///C:/Users/Alimam/.gemini/antigravity/brain/4be222d3-c02a-4e0f-82af-9e43e46a5d25/tabs_panel_view_1778529719404.png)
*   **Peek Mode**: Use your mouse wheel to "peek" through all open music tabs without switching playback.
*   **Session Switcher**: A dedicated sliding panel shows all active browser tabs with thumbnails, artists, and playback status.
*   **Double-Click Focus**: Instantly focus and bring the music-playing browser tab to the front with a double-click on the track info.

### ⚙️ Customizable Settings
![Extension Settings](file:///C:/Users/Alimam/.gemini/antigravity/brain/4be222d3-c02a-4e0f-82af-9e43e46a5d25/extension_settings_popup_1778529738561.png)
Control the experience via the Chrome Extension popup. Toggle features on/off instantly:
- **Dynamic Theming**
- **Audio Visualizer**
- **Scrolling Title**

## 🚀 Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/AlimamHu/music-taskbar.git
    cd music-taskbar
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Install Chrome Extension**:
    -   Open Chrome and go to `chrome://extensions/`.
    -   Enable **Developer mode**.
    -   Click **Load unpacked** and select the `extension` folder in the project directory.
4.  **Run the App**:
    ```bash
    npm start
    ```

## 🛠️ Tech Stack
- **Electron**: Frameless, always-on-top window management.
- **Chrome Extension (MV3)**: Metadata extraction and IPC communication.
- **Vanilla JS & CSS**: High-performance UI rendering and animations.

## 🚀 How to Launch

### 1. Developer Mode (Recommended for testing)
Open your terminal and run:
```bash
npm start
```

### 2. Quick Launch (One-Click)
I've created a **`launch.bat`** file in the project folder. You can simply **double-click** it to start the controller without opening a terminal.

### 3. Build a Standalone App (.exe)
If you want to use it as a permanent app on your computer, you can package it into a single `.exe` file:
1. Run `npm install --save-dev electron-builder`
2. Run `npx electron-builder`
3. Your installer will be in the `dist` folder.

---
*Created with ❤️ by Antigravity*
