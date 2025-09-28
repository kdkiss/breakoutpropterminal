#!/usr/bin/env node
const { promises: fs } = require('fs');
const path = require('path');
const iconGen = require('icon-gen');

const BASE_NAME = 'icon';
const ASSET_DIR = path.join(__dirname, '..', 'assets');
const BASE64_PATH = path.join(ASSET_DIR, `${BASE_NAME}.base64`);
const PNG_PATH = path.join(ASSET_DIR, `${BASE_NAME}.png`);

async function readBase64() {
  try {
    const raw = await fs.readFile(BASE64_PATH, 'utf8');
    return raw.replace(/\s+/g, '');
  } catch (error) {
    throw new Error(`Unable to read ${BASE64_PATH}. Ensure the base64 source exists.\n${error.message}`);
  }
}

async function writePng(base64) {
  await fs.mkdir(ASSET_DIR, { recursive: true });
  const buffer = Buffer.from(base64, 'base64');
  await fs.writeFile(PNG_PATH, buffer);
  return PNG_PATH;
}

async function generateAdditionalFormats(pngPath) {
  await iconGen(pngPath, ASSET_DIR, {
    report: false,
    ico: {
      name: BASE_NAME,
    },
    icns: {
      name: BASE_NAME,
    },
  });
}

async function main() {
  const base64 = await readBase64();
  const pngPath = await writePng(base64);
  await generateAdditionalFormats(pngPath);
  console.log(`Generated icon assets in ${ASSET_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
