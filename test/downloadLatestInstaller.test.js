const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  selectAssetFromRelease,
  splitByArchPreference,
  downloadLatestInstaller,
} = require('../scripts/download-latest-installer.js');

function createRelease(assets) {
  return {
    tag_name: 'v1.2.3',
    assets,
  };
}

test('selectAssetFromRelease prefers platform-specific installer', () => {
  const release = createRelease([
    {
      name: 'BreakoutProp-Terminal-Setup-x64.exe',
      browser_download_url: 'https://example.com/win-x64.exe',
    },
    {
      name: 'BreakoutProp-Terminal-Setup-arm64.exe',
      browser_download_url: 'https://example.com/win-arm64.exe',
    },
    {
      name: 'BreakoutProp-Terminal.dmg',
      browser_download_url: 'https://example.com/mac.dmg',
    },
  ]);

  const asset = selectAssetFromRelease(release, { platform: 'win32', arch: 'x64' });
  assert.equal(asset.browser_download_url, 'https://example.com/win-x64.exe');
});

test('selectAssetFromRelease falls back to neutral asset when arch not tagged', () => {
  const release = createRelease([
    {
      name: 'BreakoutProp-Terminal-Setup.exe',
      browser_download_url: 'https://example.com/win.exe',
    },
    {
      name: 'BreakoutProp-Terminal-arm64.dmg',
      browser_download_url: 'https://example.com/mac-arm64.dmg',
    },
  ]);

  const asset = selectAssetFromRelease(release, { platform: 'win32', arch: 'x64' });
  assert.equal(asset.browser_download_url, 'https://example.com/win.exe');
});

test('splitByArchPreference filters out conflicting architectures', () => {
  const assets = [{ name: 'app-x64.exe' }, { name: 'app-arm64.exe' }, { name: 'app.exe' }];

  const { preferred, fallback } = splitByArchPreference(assets, 'x64');
  assert.deepEqual(
    preferred.map((asset) => asset.name),
    ['app-x64.exe'],
  );
  assert.deepEqual(
    fallback.map((asset) => asset.name),
    ['app.exe'],
  );
});

test('downloadLatestInstaller writes installer to disk', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'installer-test-'));
  const release = createRelease([
    {
      name: 'BreakoutProp-Terminal-Setup.exe',
      browser_download_url: 'https://example.com/win.exe',
    },
  ]);

  const downloaded = [];

  const fakeFetch = async (url) => {
    if (url.includes('/releases/latest')) {
      return {
        ok: true,
        status: 200,
        json: async () => release,
      };
    }

    if (url === 'https://example.com/win.exe') {
      downloaded.push(url);
      const payload = Buffer.from('installer');
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength),
      };
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await downloadLatestInstaller({
    repo: 'example/repo',
    platform: 'win32',
    arch: 'x64',
    outputDir: tmpDir,
    fetchImpl: fakeFetch,
  });

  assert.equal(downloaded.length, 1);
  const outputFile = path.join(tmpDir, 'BreakoutProp-Terminal-Setup.exe');
  const contents = await fs.readFile(outputFile, 'utf8');
  assert.equal(contents, 'installer');
  assert.equal(result.filePath, outputFile);
});
