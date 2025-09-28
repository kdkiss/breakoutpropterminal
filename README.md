# BreakoutProp Terminal

BreakoutProp Terminal packages the BreakoutProp trading experience inside a cross-platform Electron desktop shell built with Electron Forge.

## Prerequisites

Install the following tools before working on the project:

- **Node.js 18.x or newer** – Electron 33 (used by this project) requires at least Node 18 to build native modules reliably.
- **npm** – installed automatically with Node.js.
- **Git** – recommended for cloning the repository and receiving updates.

If you plan to ship native installers, ensure you have the platform-specific build tooling required by Electron Forge (for example, Xcode command-line tools on macOS or the build-essential package group on Debian/Ubuntu).

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/breakoutpropterminal.git
cd breakoutpropterminal
npm install
```

## Running the App in Development

Start Electron with live-reload support:

```bash
npm start
```

`npm start` runs `electron-forge start`, generates icons through the `prestart` hook, and opens the BreakoutProp web terminal within the Electron shell.

## Packaging and Distribution

Electron Forge can generate distributable artifacts through the included `make` targets. Icons are generated automatically before each build step.

```bash
# Create unpackaged output for local inspection
npm run package

# Produce platform-specific installers/archives in the out/ directory
npm run make
```

Refer to the Forge configuration embedded in `package.json` (`package.json → config.forge`) for maker and plugin settings. Within that JSON block you can add, remove, or adjust makers and plugins to match the installers and packaging tweaks your release process requires.

## Updating an Existing Installation

To pick up the latest application changes:

1. Pull the most recent code.
   ```bash
   git pull
   ```
2. Reinstall dependencies in case new packages were introduced.
   ```bash
   npm install
   ```
3. Rebuild artifacts or restart the development server as needed (`npm start`, `npm run package`, or `npm run make`).

The project does not currently ship an auto-updater; distribute new installers generated with `npm run make` whenever an update is required.

## Security Model

The Electron shell hosts the remote BreakoutProp web application at `https://app.breakoutprop.com` and applies the following hardening measures (see `main.js`):

- **Renderer isolation** – `nodeIntegration` is disabled, `contextIsolation` is enabled, and the renderer runs in a sandboxed environment with a minimal preload script to prevent access to Node.js APIs from web content.
- **Navigation restrictions** – window creation and in-app navigation are limited to the trusted BreakoutProp origin; external links open in the system browser instead of the Electron window.
- **Content Security Policy enforcement** – responses without a CSP header receive a restrictive default policy covering scripts, styles, images, WebSocket connections, and frame ancestors.
- **Remote content** – no local HTML is served. The hosted BreakoutProp application continues to handle authentication; no additional credentials or API keys are stored in the desktop shell.

The app does not require custom environment variables or bundled secrets. Users authenticate against BreakoutProp services directly inside the embedded web experience.

## Contributing and Testing

Contributions are welcome. Before submitting changes:

1. Ensure dependencies are installed (`npm install`).
2. Run the automated checks. `npm test` now executes linting, formatting, unit tests, and the Playwright integration suite in the same order used in CI.
   ```bash
   npm test
   ```
   To run only the Node.js unit tests, use the dedicated command:
   ```bash
   npm run test:unit
   ```
3. Verify the app still runs (`npm start`) and, if applicable, that packaged artifacts build successfully (`npm run make`).

Please follow conventional Git workflows (feature branches + pull requests) and document significant changes in the changelog or release notes when distributing new builds.

## Additional Resources

- [Electron Forge Documentation](https://www.electronforge.io/)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Auto-Updates Guide](https://www.electronjs.org/docs/latest/tutorial/updates) – reference if you plan to add update infrastructure in the future.
