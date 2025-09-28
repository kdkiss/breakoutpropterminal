const http = require('http');
const path = require('path');
const { pathToFileURL } = require('node:url');
const { test, expect, _electron: electron } = require('@playwright/test');

test.describe('Breakout Prop Electron app', () => {
  test('launches the main window', async () => {
    const startFile = path.resolve(__dirname, 'fixtures', 'test-page.html');
    const startUrl = pathToFileURL(startFile).toString();

    const electronApp = await electron.launch({
      args: ['.'],
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        ELECTRON_HEADLESS: '1',
        ELECTRON_START_URL: startUrl,
      },
    });

    try {
      const windowState = await electronApp.evaluate(({ BrowserWindow }) => {
        const [mainWindow] = BrowserWindow.getAllWindows();
        return {
          windowCount: BrowserWindow.getAllWindows().length,
          hasWindow: Boolean(mainWindow && !mainWindow.isDestroyed()),
        };
      });

      expect(windowState.windowCount).toBeGreaterThan(0);
      expect(windowState.hasWindow).toBeTruthy();

      const mainWindow = await electronApp.firstWindow();
      const url = await mainWindow.url();
      expect(url).toBe(startUrl);
    } finally {
      await electronApp.close();
    }
  });

  test('follows custom start URL origin for navigation guard', async () => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html');

      if (req.url === '/child') {
        res.end('<!doctype html><title>Child</title><p>Child window</p>');
        return;
      }

      if (req.url === '/next') {
        res.end('<!doctype html><title>Next</title><p>Next page</p>');
        return;
      }

      res.end('<!doctype html><title>Root</title><p>Root page</p>');
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    const { port } = server.address();
    const startUrl = `http://127.0.0.1:${port}/`;

    let electronApp;

    try {
      electronApp = await electron.launch({
        args: ['.'],
        cwd: path.resolve(__dirname, '..'),
        env: {
          ...process.env,
          ELECTRON_HEADLESS: '1',
          ELECTRON_START_URL: startUrl,
        },
      });

      const mainWindow = await electronApp.firstWindow();
      await mainWindow.waitForLoadState('load');
      expect(await mainWindow.url()).toBe(startUrl);

      const nextUrl = `${startUrl}next`;
      await mainWindow.goto(nextUrl);
      expect(await mainWindow.url()).toBe(nextUrl);

      const popupPromise = electronApp.waitForEvent('window');
      await mainWindow.evaluate(() => {
        window.open('/child', '_blank');
      });

      const popup = await popupPromise;
      await popup.waitForLoadState('load');
      expect(await popup.url()).toBe(`${startUrl}child`);

      const breakoutPopupPromise = electronApp.waitForEvent('window');
      await mainWindow.evaluate(() => {
        window.open('https://app.breakoutprop.com/dashboard', '_blank');
      });

      const breakoutPopup = await breakoutPopupPromise;
      await breakoutPopup.waitForLoadState('domcontentloaded').catch(() => {});
      expect(await breakoutPopup.url()).toBe(
        'https://app.breakoutprop.com/dashboard',
      );
      await breakoutPopup.close();
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
