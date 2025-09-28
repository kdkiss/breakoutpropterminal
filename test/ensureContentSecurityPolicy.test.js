process.env.SKIP_MAIN_BOOTSTRAP = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');

const { ensureContentSecurityPolicy } = require('../main.js');

function captureResult(fn) {
  return new Promise((resolve) => {
    fn((result) => resolve(result));
  });
}

test('ensureContentSecurityPolicy injects a nonce-based header when missing', async () => {
  const details = { responseHeaders: {} };

  const result = await captureResult((callback) => ensureContentSecurityPolicy(details, callback));

  assert.ok(result.responseHeaders['Content-Security-Policy']);
  const [policy] = result.responseHeaders['Content-Security-Policy'];

  assert.match(policy, /script-src 'self' 'nonce-[^']+' https:\/\/app\.breakoutprop\.com/);
  assert.match(policy, /style-src 'self' 'nonce-[^']+' https:\/\/app\.breakoutprop\.com/);
});

test('ensureContentSecurityPolicy preserves existing headers', async () => {
  const originalHeaders = {
    'content-security-policy': ["default-src 'self'"],
    'x-custom-header': ['value'],
  };

  const details = { responseHeaders: originalHeaders };

  const result = await captureResult((callback) => ensureContentSecurityPolicy(details, callback));

  assert.strictEqual(result.responseHeaders, originalHeaders);
  assert.deepEqual(result.responseHeaders['content-security-policy'], ["default-src 'self'"]);
  assert.deepEqual(result.responseHeaders['x-custom-header'], ['value']);
});
