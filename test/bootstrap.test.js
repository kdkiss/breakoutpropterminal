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
  'bootstrap honors ELECTRON_START_URL while keeping breakout origin allowed',
  { concurrency: false },
  async () => {
    const double = createElectronDouble();
    __setElectronForTesting(double.bindings);

    process.env.ELECTRON_START_URL = 'http://localhost:3000';

    bootstrap();
    await flushPromises();

    const [createdWindow] = double.BrowserWindowStub.instances;
    assert.deepEqual(createdWindow.loadCalls, ['http://localhost:3000/']);

    assert.ok(
      createdWindow.windowOpenHandler,
      'expected window open handler to be registered',
    );

    const navHandler = createdWindow.webContentsHandlers['will-navigate'];
    assert.ok(navHandler, 'expected will-navigate handler to be registered');

    const allowResult = createdWindow.windowOpenHandler({
      url: 'https://app.breakoutprop.com/path',
    });
    assert.deepEqual(allowResult, { action: 'allow' });

    const allowStartResult = createdWindow.windowOpenHandler({
      url: 'http://localhost:3000/other',
    });
    assert.deepEqual(allowStartResult, { action: 'allow' });

    const denyResult = createdWindow.windowOpenHandler({
      url: 'https://example.com/out',
    });
    assert.deepEqual(denyResult, { action: 'deny' });
    assert.deepEqual(double.openExternalCalls, ['https://example.com/out']);

    const createEvent = () => {
      const event = { prevented: false };
      event.preventDefault = () => {
        event.prevented = true;
      };
      return event;
    };

    let event = createEvent();
    navHandler(event, 'https://app.breakoutprop.com/dashboard');
    assert.equal(event.prevented, false);

    event = createEvent();
    navHandler(event, 'http://localhost:3000/settings');
    assert.equal(event.prevented, false);

    event = createEvent();
    navHandler(event, 'https://example.com/elsewhere');
    assert.equal(event.prevented, true);
    assert.deepEqual(double.openExternalCalls, [
      'https://example.com/out',
      'https://example.com/elsewhere',
    ]);


    delete process.env.ELECTRON_START_URL;
    __resetForTesting();
  },
);

test(
  'bootstrap falls back to default when ELECTRON_START_URL has unsupported protocol',
  { concurrency: false },
  async () => {
    const invalidCases = [
      { label: 'missing protocol', value: 'localhost:3000' },
      { label: 'javascript scheme', value: 'javascript:alert(1)' },
      { label: 'whitespace', value: '   ' },
      { label: 'malformed string', value: '::://broken' },
    ];

    for (const { label, value } of invalidCases) {
      const double = createElectronDouble();
      __setElectronForTesting(double.bindings);

      const warnings = [];
      const originalWarn = console.warn;
      console.warn = (...args) => {
        warnings.push(args.join(' '));
      };

      process.env.ELECTRON_START_URL = value;

      try {
        bootstrap();
        await flushPromises();

        const [createdWindow] = double.BrowserWindowStub.instances;
        assert.deepEqual(
          createdWindow.loadCalls,
          ['https://app.breakoutprop.com'],
          `expected fallback for ${label}`,
        );
        assert.ok(
          warnings.some((message) => message.includes(`"${value}"`)),
          `expected warning for ${label}`,
        );
      } finally {
        console.warn = originalWarn;
        delete process.env.ELECTRON_START_URL;
        __resetForTesting();
      }
    }
  },
);

test(
  'bootstrap accepts file:// overrides and keeps navigation in-app',
  { concurrency: false },
  async () => {
    const double = createElectronDouble();
    __setElectronForTesting(double.bindings);

    process.env.ELECTRON_START_URL = '  file:///tmp/index.html  ';

    bootstrap();
    await flushPromises();

    const [createdWindow] = double.BrowserWindowStub.instances;
    assert.deepEqual(createdWindow.loadCalls, ['file:///tmp/index.html']);

    assert.ok(createdWindow.windowOpenHandler, 'expected window open handler to be registered');
    const allowResult = createdWindow.windowOpenHandler({
      url: 'file:///tmp/next.html',
    });
    assert.deepEqual(allowResult, { action: 'allow' });

    const navHandler = createdWindow.webContentsHandlers['will-navigate'];
    const event = { prevented: false };
    event.preventDefault = () => {
      event.prevented = true;
    };

    navHandler(event, 'file:///tmp/next.html');
    assert.equal(event.prevented, false);

    delete process.env.ELECTRON_START_URL;
    __resetForTesting();
  },
);
