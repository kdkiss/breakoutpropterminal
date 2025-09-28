const { app, BrowserWindow, shell, session } = require('electron');

const ALLOWED_HOSTS = ['app.breakoutprop.com'];

function isAllowedUrl(targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    const { protocol, host } = parsedUrl;
    if (protocol !== 'https:') {
      return false;
    }

    return ALLOWED_HOSTS.some(
      (allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`)
    );
  } catch (error) {
    return false;
  }
}

if (require('electron-squirrel-startup')) {
  app.quit();
  return;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      enableRemoteModule: false,
    },
  });

  win.loadURL('https://app.breakoutprop.com/');

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) {
      return { action: 'allow' };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
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
