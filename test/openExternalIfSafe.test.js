process.env.SKIP_MAIN_BOOTSTRAP = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');

const { openExternalIfSafe } = require('../main.js');

test('allows vetted protocols to open externally', () => {
  let openedUrl = null;
  const openExternalStub = (url) => {
    openedUrl = url;
  };

  const result = openExternalIfSafe('https://example.com/path', openExternalStub);

  assert.equal(result, true);
  assert.equal(openedUrl, 'https://example.com/path');
});

test('rejects URLs with disallowed protocols', () => {
  let opened = false;
  const openExternalStub = () => {
    opened = true;
  };

  const disallowed = [
    'file:///etc/passwd',
    'javascript:alert(1)',
    'custom-scheme://data',
  ];

  for (const url of disallowed) {
    opened = false;
    const result = openExternalIfSafe(url, openExternalStub);
    assert.equal(result, false, `expected ${url} to be rejected`);
    assert.equal(opened, false, `expected ${url} not to be opened`);
  }
});

test('rejects malformed URLs and non-string values', () => {
  let opened = false;
  const openExternalStub = () => {
    opened = true;
  };

  const inputs = ['not a url', '/relative/path', null, undefined, 42];

  for (const input of inputs) {
    opened = false;
    const result = openExternalIfSafe(input, openExternalStub);
    assert.equal(result, false, `expected ${String(input)} to be rejected`);
    assert.equal(opened, false, `expected ${String(input)} not to be opened`);
  }
});
