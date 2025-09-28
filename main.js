const path = require('path');
const { app, BrowserWindow, shell, session } = require('electron');

const defaultStartUrl = 'https://app.breakoutprop.com/';
const startUrl = process.env.ELECTRON_START_URL || defaultStartUrl;

let allowedOrigin = 'https://app.breakoutprop.com';
try {
  allowedOrigin = new URL(startUrl).origin;
} catch (error) {
  allowedOrigin = new URL(defaultStartUrl).origin;
}

if (process.env.ELECTRON_HEADLESS === '1') {
  app.commandLine.appendSwitch('headless');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('no-sandbox');
}


function openExternalIfSafe(targetUrl, openExternal = shell.openExternal) {
  let parsed;

  if (targetUrl instanceof URL) {
    parsed = targetUrl;
  } else if (typeof targetUrl === 'string') {
    try {
      parsed = new URL(targetUrl);
    } catch {
      return false;
    }
  } else {
    return false;
  }

  if (!allowedProtocols.has(parsed.protocol)) {
    return false;
  }

  openExternal(parsed.toString());
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: false,
    },
  });

  win.loadURL(startUrl);

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).origin === allowedOrigin) {
        return { action: 'allow' };
      }
    } catch {
      // fall through to deny below
    }

    openExternalIfSafe(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin !== allowedOrigin) {
        event.preventDefault();
        openExternalIfSafe(url);
      }
    } catch {
      event.preventDefault();
      openExternalIfSafe(url);
    }
  });
}

app.whenReady().then(() => {
  if (session.defaultSession) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = details.responseHeaders || {};
      const hasContentSecurityPolicy = Object.keys(responseHeaders).some(
        (header) => header.toLowerCase() === 'content-security-policy',
      );

      if (!hasContentSecurityPolicy) {
        responseHeaders['Content-Security-Policy'] = [
          "default-src 'self' https://app.breakoutprop.com https://*.breakoutprop.com data: blob:; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.breakoutprop.com https://*.breakoutprop.com; " +
            "connect-src 'self' https://app.breakoutprop.com https://*.breakoutprop.com wss://*.breakoutprop.com; " +
            "img-src 'self' data: https://app.breakoutprop.com https://*.breakoutprop.com; " +
            "style-src 'self' 'unsafe-inline' https://app.breakoutprop.com https://*.breakoutprop.com; " +
            "frame-ancestors 'self';",
        ];
      }

      callback({ responseHeaders });
    });

  }

  app.whenReady().then(() => {
    if (session.defaultSession) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders || {};
        const hasContentSecurityPolicy = Object.keys(responseHeaders).some(
          (header) => header.toLowerCase() === 'content-security-policy'
        );

        if (!hasContentSecurityPolicy) {
          responseHeaders['Content-Security-Policy'] = [
            "default-src 'self' https://app.breakoutprop.com https://*.breakoutprop.com data: blob:; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.breakoutprop.com https://*.breakoutprop.com; " +
              "connect-src 'self' https://app.breakoutprop.com https://*.breakoutprop.com wss://*.breakoutprop.com; " +
              "img-src 'self' data: https://app.breakoutprop.com https://*.breakoutprop.com; " +
              "style-src 'self' 'unsafe-inline' https://app.breakoutprop.com https://*.breakoutprop.com; " +
              "frame-ancestors 'self';",
          ];
        }

        callback({ responseHeaders });
      });
    }

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

if (process.env.SKIP_MAIN_BOOTSTRAP !== 'true') {
  bootstrap();
}

module.exports = { openExternalIfSafe, bootstrap };
