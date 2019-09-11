const { app, BrowserWindow } = require("electron");

if (process.argv.length > 2) {
  const url = process.argv[2];
  function createWindow() {
    let win = new BrowserWindow({
      width: 1080,
      height: 1920,
      webPreferences: {
        nodeIntegration: true
      },
      fullscreen: true
    });

    win.loadURL(url);
  }

  app.on("ready", createWindow);
} else {
  console.error("No url passed.");
}