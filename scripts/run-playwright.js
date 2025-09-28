#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const commandArgs = ['playwright', 'test', ...args];
const env = { ...process.env, ELECTRON_HEADLESS: process.env.ELECTRON_HEADLESS || '1' };

function run(command, commandArgsList) {
  const result = spawnSync(command, commandArgsList, {
    stdio: 'inherit',
    env,
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 0;
}

if (process.platform === 'linux' && !process.env.DISPLAY) {
  const check = spawnSync('which', ['xvfb-run'], { encoding: 'utf-8' });
  if (check.status === 0) {
    const exitCode = run('xvfb-run', ['--auto-servernum', '--', 'npx', ...commandArgs]);
    process.exit(exitCode);
  } else {
    console.warn(
      'xvfb-run not found; attempting to run Playwright without a virtual display. Tests may fail if no display is available.',
    );
  }
}

const exitCode = run('npx', commandArgs);
process.exit(exitCode);
