#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_REPO = 'kdkiss/breakoutpropterminal';
const DEFAULT_OUTPUT_DIR = process.cwd();

const ARCH_ALIASES = {
  x64: ['x64', 'x86_64', 'amd64'],
  arm64: ['arm64', 'aarch64'],
  ia32: ['ia32', 'x86', 'x32'],
};

const PLATFORM_PATTERNS = {
  win32: [/\.exe$/i, /\.msi$/i, /\.zip$/i],
  darwin: [/\.dmg$/i, /\.pkg$/i, /\.zip$/i],
  linux: [/\.AppImage$/i, /\.deb$/i, /\.rpm$/i, /\.tar\.gz$/i, /\.zip$/i],
  default: [/\.zip$/i, /\.tar\.gz$/i],
};

function buildHeaders(token) {
  const headers = {
    'User-Agent': 'breakoutprop-downloader',
    Accept: 'application/vnd.github+json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function getArchAliases(arch) {
  const aliases = ARCH_ALIASES[arch];
  if (!aliases) {
    return [];
  }

  return aliases.map((alias) => alias.toLowerCase());
}

function getOtherArchAliases(arch) {
  const others = [];
  for (const [key, aliases] of Object.entries(ARCH_ALIASES)) {
    if (key === arch) {
      continue;
    }

    for (const alias of aliases) {
      others.push(alias.toLowerCase());
    }
  }

  return others;
}

function splitByArchPreference(assets, arch) {
  const archAliases = getArchAliases(arch);

  if (archAliases.length === 0) {
    return { preferred: assets.slice(), fallback: [] };
  }

  const otherAliases = getOtherArchAliases(arch);
  const preferred = [];
  const fallback = [];

  for (const asset of assets) {
    const haystack =
      `${asset.name || ''} ${(asset.browser_download_url || '').toLowerCase()}`.toLowerCase();
    if (archAliases.some((alias) => haystack.includes(alias))) {
      preferred.push(asset);
      continue;
    }

    if (otherAliases.some((alias) => haystack.includes(alias))) {
      continue;
    }

    fallback.push(asset);
  }

  return { preferred, fallback };
}

function selectAssetFromRelease(release, options = {}) {
  if (!release || !Array.isArray(release.assets)) {
    throw new Error('Release data did not include assets.');
  }

  const assets = release.assets;

  if (assets.length === 0) {
    throw new Error('Latest release does not contain any downloadable assets.');
  }

  const { platform = process.platform, arch = process.arch, assetPattern } = options;

  const patterns = [];

  if (assetPattern) {
    const customPattern =
      assetPattern instanceof RegExp ? assetPattern : new RegExp(assetPattern, 'i');
    patterns.push(customPattern);
  }

  const platformPatterns = PLATFORM_PATTERNS[platform] || [];
  patterns.push(...platformPatterns, ...PLATFORM_PATTERNS.default);

  let fallbackMatch = null;

  for (const pattern of patterns) {
    const matchingAssets = assets.filter((asset) => {
      const name = asset.name || '';
      const url = asset.browser_download_url || '';
      return pattern.test(name) || pattern.test(url);
    });

    if (matchingAssets.length === 0) {
      continue;
    }

    const { preferred, fallback } = splitByArchPreference(matchingAssets, arch);

    if (preferred.length > 0) {
      return preferred[0];
    }

    if (!fallbackMatch && fallback.length > 0) {
      fallbackMatch = fallback[0];
    }
  }

  return fallbackMatch || assets[0];
}

async function fetchLatestRelease(repo, fetchImpl = globalThis.fetch, token) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('A fetch implementation must be provided.');
  }

  const response = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: buildHeaders(token),
  });

  if (!response || !response.ok) {
    const status = response ? `${response.status}` : 'unknown';
    throw new Error(`Failed to fetch latest release metadata (status: ${status}).`);
  }

  return response.json();
}

function resolveFileName(asset, url) {
  if (asset.name) {
    return asset.name;
  }

  try {
    const parsed = new URL(url);
    return path.basename(parsed.pathname);
  } catch {
    return 'download';
  }
}

async function downloadAsset(asset, outputDir, fetchImpl = globalThis.fetch, token) {
  if (!asset || !asset.browser_download_url) {
    throw new Error('Asset is missing a browser_download_url.');
  }

  const response = await fetchImpl(asset.browser_download_url, {
    headers: buildHeaders(token),
  });

  if (!response || !response.ok) {
    const status = response ? `${response.status}` : 'unknown';
    throw new Error(`Failed to download asset (status: ${status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = resolveFileName(asset, asset.browser_download_url);
  await fs.mkdir(outputDir, { recursive: true });
  const destination = path.join(outputDir, fileName);
  await fs.writeFile(destination, buffer);
  return destination;
}

async function downloadLatestInstaller(options = {}) {
  const {
    repo = DEFAULT_REPO,
    platform = process.platform,
    arch = process.arch,
    outputDir = DEFAULT_OUTPUT_DIR,
    assetPattern,
    fetchImpl = globalThis.fetch,
    token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
  } = options;

  const release = await fetchLatestRelease(repo, fetchImpl, token);
  const asset = selectAssetFromRelease(release, { platform, arch, assetPattern });
  const filePath = await downloadAsset(asset, outputDir, fetchImpl, token);

  return {
    filePath,
    release,
    asset,
  };
}

function formatSuccessMessage(result) {
  const { filePath, release, asset } = result;
  const lines = [`Downloaded ${asset.name || 'installer'} to ${filePath}.`];

  if (release && release.tag_name) {
    lines.push(`Release: ${release.tag_name}`);
  }

  return lines.join('\n');
}

function printUsage() {
  const usage =
    `Usage: node scripts/download-latest-installer.js [options]\n\n` +
    `Options:\n` +
    `  --platform <platform>       Platform to download for (default: current platform)\n` +
    `  --arch <arch>               Architecture to download for (default: current arch)\n` +
    `  --repo <owner/repo>         Repository to query (default: ${DEFAULT_REPO})\n` +
    `  --output <dir>              Directory to save the installer (default: current directory)\n` +
    `  --asset-pattern <pattern>   Regular expression to match asset names\n` +
    `  --token <token>             GitHub token (falls back to GITHUB_TOKEN/GH_TOKEN env vars)\n` +
    `  -h, --help                  Show this help message\n`;

  console.log(usage);
}

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      return { help: true };
    }

    if (!arg.startsWith('--')) {
      options.outputDir = path.resolve(process.cwd(), arg);
      continue;
    }

    const [flag, valueFromEquals] = arg.split('=');
    let value = valueFromEquals;

    if (value == null) {
      value = argv[i + 1];
      i += 1;
    }

    if (value == null || value.startsWith('--')) {
      throw new Error(`Option ${flag} requires a value.`);
    }

    switch (flag) {
      case '--platform':
        options.platform = value;
        break;
      case '--arch':
        options.arch = value;
        break;
      case '--repo':
        options.repo = value;
        break;
      case '--output':
        options.outputDir = path.resolve(process.cwd(), value);
        break;
      case '--asset-pattern':
        options.assetPattern = value;
        break;
      case '--token':
        options.token = value;
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }

  return options;
}

async function runCli() {
  let options;

  try {
    options = parseArgs(process.argv);
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    printUsage();
    return;
  }

  try {
    const result = await downloadLatestInstaller(options);
    console.log(formatSuccessMessage(result));
  } catch (error) {
    console.error(`Failed to download installer: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  ARCH_ALIASES,
  PLATFORM_PATTERNS,
  buildHeaders,
  selectAssetFromRelease,
  downloadLatestInstaller,
  fetchLatestRelease,
  downloadAsset,
  parseArgs,
  formatSuccessMessage,
  splitByArchPreference,
};
