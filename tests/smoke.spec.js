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
});
