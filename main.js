const crypto = require('crypto');
const path = require('path');
const { fileURLToPath } = require('node:url');
const electron = require('electron');

let { app, BrowserWindow, shell, session } = electron;

const lockedDownWebPreferences = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  enableRemoteModule: false,
  preload: path.join(__dirname, 'preload.js'),
};

// Network captures of https://app.breakoutprop.com/ (via Playwright) show the
// UI pulling first-party assets plus Cloudflare's analytics beacon. Keep these
// allow-lists in sync with that remote footprint so the nonce-based CSP stays
// permissive only where the app genuinely needs it.
const breakoutOrigins = ['https://app.breakoutprop.com', 'https://*.breakoutprop.com'];
const cspScriptOrigins = [
  ...breakoutOrigins,
  // Cloudflare Radar beacon script used by the hosted experience.
  'https://performance.radar.cloudflare.com',
];
const cspStyleOrigins = breakoutOrigins;
const cspConnectOrigins = [...breakoutOrigins, 'wss://*.breakoutprop.com'];

function buildContentSecurityPolicy() {
  const nonce = crypto.randomBytes(16).toString('base64');
  const directives = [
    "default-src 'self';",
    "base-uri 'self';",
    // The BreakoutProp bundle does not need eval and should only execute scripts
    // with a matching nonce from the allow-listed origins recorded above.
    `script-src 'self' 'nonce-${nonce}' ${cspScriptOrigins.join(' ')};`,
    `style-src 'self' 'nonce-${nonce}' ${cspStyleOrigins.join(' ')};`,
    `img-src 'self' data: blob: ${breakoutOrigins.join(' ')};`,
    `connect-src 'self' ${cspConnectOrigins.join(' ')};`,
    `font-src 'self' data: ${breakoutOrigins.join(' ')};`,
    `frame-src 'self' ${breakoutOrigins.join(' ')};`,
    "frame-ancestors 'self';",
    `form-action 'self' ${breakoutOrigins.join(' ')};`,
    "object-src 'none';",
  ];

  return directives.join(' ');
}

function ensureContentSecurityPolicy(details, callback) {
  const responseHeaders = details.responseHeaders || {};
  const hasContentSecurityPolicy = Object.keys(responseHeaders).some(
    (header) => header.toLowerCase() === 'content-security-policy',
  );

  if (!hasContentSecurityPolicy) {
    responseHeaders['Content-Security-Policy'] = [buildContentSecurityPolicy()];
  }

  callback({ responseHeaders });
}

const defaultAllowedOrigin = 'https://app.breakoutprop.com';
let allowedOrigins = new Set([defaultAllowedOrigin]);

let startUrl = defaultAllowedOrigin;
let startFileRoot = null;

function resetAllowedOrigins() {
  allowedOrigins = new Set([defaultAllowedOrigin]);
}

function isOriginAllowed(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') {
      if (!startFileRoot) {
        return false;
      }

      try {
        const targetPath = path.resolve(fileURLToPath(parsed));
        const relative = path.relative(startFileRoot, targetPath);
        const isWithinRoot =
          relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));

        return isWithinRoot;
      } catch {
        return false;
      }
    }

    return allowedOrigins.has(parsed.origin);
  } catch {
    return false;
  }
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

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const normalized = parsed.toString();

  if (parsed.protocol === 'http:' && !allowedOrigins.has(parsed.origin)) {
    return false;
  }

  openExternal(normalized);
  return true;
}

function applyNavigationGuards(contents) {
  if (!contents) {
    return;
  }

  contents.setWindowOpenHandler(({ url }) => {
    if (isOriginAllowed(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: { ...lockedDownWebPreferences },
        },
      };
    }

    openExternalIfSafe(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (isOriginAllowed(url)) {
      return;
    }

    event.preventDefault();
    openExternalIfSafe(url);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { ...lockedDownWebPreferences },
  });

  win.loadURL(startUrl);

  applyNavigationGuards(win.webContents);

  win.webContents.on('did-create-window', (childWindow) => {
    applyNavigationGuards(childWindow.webContents);
  });
}

function computeStartFileRoot(url) {
  if (typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'file:') {
      return null;
    }

    const absolutePath = path.resolve(fileURLToPath(parsed));
    if (url.endsWith('/')) {
      return absolutePath;
    }

    return path.dirname(absolutePath);
  } catch {
    return null;
  }
}

function bootstrap() {
  resetAllowedOrigins();

  const providedStartUrl = process.env.ELECTRON_START_URL;
  let normalizedStartUrl = defaultAllowedOrigin;

  if (typeof providedStartUrl === 'string') {
    const trimmed = providedStartUrl.trim();

    if (trimmed) {
      try {
        const parsedStart = new URL(trimmed);

        // Reject unknown schemes so a misconfigured environment cannot coerce
        // the shell into executing arbitrary protocols inside Electron.
        if (parsedStart.protocol === 'http:' || parsedStart.protocol === 'https:') {
          normalizedStartUrl = parsedStart.toString();
        } else if (parsedStart.protocol === 'file:') {
          normalizedStartUrl = parsedStart.toString();
        } else {
          console.warn(
            `Ignoring unsupported ELECTRON_START_URL value "${providedStartUrl}". Falling back to ${defaultAllowedOrigin}.`,
          );
        }
      } catch {
        console.warn(
          `Ignoring unsupported ELECTRON_START_URL value "${providedStartUrl}". Falling back to ${defaultAllowedOrigin}.`,
        );
      }
    } else if (providedStartUrl.length > 0) {
      console.warn(
        `Ignoring unsupported ELECTRON_START_URL value "${providedStartUrl}". Falling back to ${defaultAllowedOrigin}.`,
      );
    }
  }

  startUrl = normalizedStartUrl;
  startFileRoot = computeStartFileRoot(startUrl);

  if (typeof startUrl === 'string') {
    const isHttp = startUrl.startsWith('http://') || startUrl.startsWith('https://');

    if (isHttp) {
      try {
        const parsedStart = new URL(startUrl);
        allowedOrigins.add(parsedStart.origin);
      } catch {
        startUrl = defaultAllowedOrigin;
      }
    }
  }

  app.whenReady().then(() => {
    if (session.defaultSession) {
      session.defaultSession.webRequest.onHeadersReceived(ensureContentSecurityPolicy);
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

function __setElectronForTesting(overrides) {
  ({ app, BrowserWindow, shell, session } = overrides);
}

function __resetForTesting() {
  ({ app, BrowserWindow, shell, session } = electron);
  resetAllowedOrigins();
  startUrl = defaultAllowedOrigin;
  startFileRoot = null;
}

module.exports = {
  openExternalIfSafe,
  ensureContentSecurityPolicy,
  bootstrap,
  __setElectronForTesting,
  __resetForTesting,
};
