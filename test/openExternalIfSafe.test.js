process.env.SKIP_MAIN_BOOTSTRAP = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');

const { openExternalIfSafe } = require('../main.js');

test('allows https URLs to open externally', () => {
  let openedUrl = null;
  const openExternalStub = (url) => {
    openedUrl = url;
  };

  const httpsResult = openExternalIfSafe(
    'https://example.com/path',
    openExternalStub,
  );

  assert.equal(httpsResult, true);
  assert.equal(openedUrl, 'https://example.com/path');

  openedUrl = null;
  const urlObject = new URL('https://example.com/other');
  const objectResult = openExternalIfSafe(urlObject, openExternalStub);

  assert.equal(objectResult, true);
  assert.equal(openedUrl, 'https://example.com/other');

  openedUrl = null;
  const httpResult = openExternalIfSafe('http://example.com/basic', openExternalStub);

  assert.equal(httpResult, false);
  assert.equal(openedUrl, null);

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
    'data:text/plain;base64,Zm9v',
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
