'use strict';

const allowedProtocols = new Set(['http:', 'https:']);

function isAllowedUrl(targetUrl) {
  if (typeof targetUrl !== 'string') {
    return false;
  }

  let parsed;

  try {
    parsed = new URL(targetUrl);
  } catch {
    return false;
  }

  return allowedProtocols.has(parsed.protocol);
}

function getDefaultOpenExternal() {
  const { shell } = require('electron');
  return shell.openExternal;
}

function openExternalIfSafe(targetUrl, openExternal) {
  if (!isAllowedUrl(targetUrl)) {
    return false;
  }

  const external = openExternal ?? getDefaultOpenExternal();

  if (typeof external !== 'function') {
    return false;
  }

  external(targetUrl);
  return true;
}

module.exports = {
  isAllowedUrl,
  openExternalIfSafe,
};
