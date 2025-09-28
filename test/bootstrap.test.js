process.env.SKIP_MAIN_BOOTSTRAP = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  bootstrap,
  ensureContentSecurityPolicy,
  __setElectronForTesting,
  __resetForTesting,
} = require('../main.js');

function createElectronDouble() {
  const onHeadersReceivedHandlers = [];
  const openExternalCalls = [];

  class BrowserWindowStub {
    constructor() {
      this.loadCalls = [];
      this.webContentsHandlers = {};
      BrowserWindowStub.instances.push(this);
      this.webContents = {
        setWindowOpenHandler: (handler) => {
          this.windowOpenHandler = handler;
        },
        on: (event, handler) => {
          this.webContentsHandlers[event] = handler;
        },
      };
    }

    loadURL(url) {
      this.loadCalls.push(url);
    }

    static getAllWindows() {
      return BrowserWindowStub.instances;
    }
  }

  BrowserWindowStub.instances = [];

  const sessionStub = {
    defaultSession: {
      webRequest: {
        onHeadersReceived: (handler) => {
          onHeadersReceivedHandlers.push(handler);
        },
      },
    },
  };

  const appStub = {
    handlers: {},
    whenReady: () => Promise.resolve(),
    on(event, handler) {
      this.handlers[event] = handler;
    },
    quitCalled: false,
    quit() {
      this.quitCalled = true;
    },
  };

  const shellStub = {
    openExternal: (url) => {
      openExternalCalls.push(url);
    },
  };

  return {
    bindings: {
      app: appStub,
      BrowserWindow: BrowserWindowStub,
      shell: shellStub,
      session: sessionStub,
    },
    BrowserWindowStub,
    onHeadersReceivedHandlers,
    openExternalCalls,
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

test(
  'bootstrap registers the CSP listener and loads the default start URL',
  { concurrency: false },
  async () => {
    const double = createElectronDouble();
    __setElectronForTesting(double.bindings);

    bootstrap();
    await flushPromises();

    assert.equal(double.onHeadersReceivedHandlers.length, 1);
    assert.strictEqual(
      double.onHeadersReceivedHandlers[0],
      ensureContentSecurityPolicy,
    );

    assert.equal(double.BrowserWindowStub.instances.length, 1);
    const [createdWindow] = double.BrowserWindowStub.instances;
    assert.deepEqual(createdWindow.loadCalls, ['https://app.breakoutprop.com']);

    __resetForTesting();
  },
);

test(
  'bootstrap honors ELECTRON_START_URL while preserving allowedOrigin behavior',
  { concurrency: false },
  async () => {
    const double = createElectronDouble();
    __setElectronForTesting(double.bindings);

    process.env.ELECTRON_START_URL = 'http://localhost:3000';

    bootstrap();
    await flushPromises();

    const [createdWindow] = double.BrowserWindowStub.instances;
    assert.deepEqual(createdWindow.loadCalls, ['http://localhost:3000']);

    assert.ok(
      createdWindow.windowOpenHandler,
      'expected window open handler to be registered',
    );

    const allowResult = createdWindow.windowOpenHandler({
      url: 'https://app.breakoutprop.com/path',
    });
    assert.deepEqual(allowResult, { action: 'allow' });

    const denyResult = createdWindow.windowOpenHandler({
      url: 'http://localhost:3000/other',
    });
    assert.deepEqual(denyResult, { action: 'deny' });
    assert.deepEqual(double.openExternalCalls, ['http://localhost:3000/other']);
    delete process.env.ELECTRON_START_URL;
    __resetForTesting();
  },
);
