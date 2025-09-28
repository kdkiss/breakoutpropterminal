'use strict';

const { isAllowedUrl, openExternalIfSafe } = require('../src/security/url-guards');

describe('isAllowedUrl', () => {
  test('allows https and http URLs', () => {
    expect(isAllowedUrl('https://example.com')).toBe(true);
    expect(isAllowedUrl('http://example.com')).toBe(true);
  });

  test('blocks non-http(s) protocols', () => {
    const blocked = [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html;base64,PGgxPkhlbGxvPC9oMT4=',
      'ftp://example.com/resource',
    ];

    for (const url of blocked) {
      expect(isAllowedUrl(url)).toBe(false);
    }
  });

  test('rejects malformed inputs', () => {
    const inputs = ['not a url', '/relative/path', '', null, undefined, 42];

    for (const input of inputs) {
      expect(isAllowedUrl(input)).toBe(false);
    }
  });
});

describe('openExternalIfSafe', () => {
  test('invokes the provided opener for allowed URLs', () => {
    const opener = jest.fn();
    const result = openExternalIfSafe('https://example.com/dashboard', opener);

    expect(result).toBe(true);
    expect(opener).toHaveBeenCalledTimes(1);
    expect(opener).toHaveBeenCalledWith('https://example.com/dashboard');
  });

  test('does not invoke the opener for blocked URLs', () => {
    const opener = jest.fn();

    expect(openExternalIfSafe('javascript:alert(1)', opener)).toBe(false);
    expect(openExternalIfSafe('file:///etc/passwd', opener)).toBe(false);
    expect(openExternalIfSafe('notaurl', opener)).toBe(false);
    expect(opener).not.toHaveBeenCalled();
  });
});
