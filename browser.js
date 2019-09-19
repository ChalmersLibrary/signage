const REFRESH_INTERVAL = 15 * 60 * 1000;

const { app, BrowserWindow } = require("electron");

if (process.argv.length > 2) {
  const url = process.argv[2];
  const width = process.argv[3];
  const height = process.argv[4];
  function createWindow() {
    let win = new BrowserWindow({
      width: parseInt(width) || 800,
      height: parseInt(height) || 600,
      webPreferences: {
        nodeIntegration: true
      },
      fullscreen: true
    });

    win.loadURL(url);

    setInterval(() => win.reload(), REFRESH_INTERVAL);
  }

  app.on("ready", createWindow);
} else {
  console.error("No url passed.");
}