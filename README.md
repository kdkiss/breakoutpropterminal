# BreakoutProp Terminal

BreakoutProp Terminal is an Electron-based desktop shell that wraps the BreakoutProp trading web experience in a packaged application.

## Prerequisites

Before getting started, ensure the following tools are installed:

- [Node.js](https://nodejs.org/) (version 18 or later is recommended for Electron 33)
- npm (bundled with Node.js)
- Git (optional, but recommended for cloning and updating the repository)

## Installation

1. Clone this repository.
2. Install dependencies:

   ```bash
   npm install
   ```

## Running the App in Development

Launch the Electron app with hot reloading support provided by Electron Forge:

```bash
npm start
```

This command compiles the application and opens the BreakoutProp web terminal inside the Electron window.

## Packaging and Distribution

Electron Forge provides multiple targets out of the box:

- Create unpackaged builds for local testing:
  ```bash
  npm run package
  ```
- Create distributable installers/archives for supported platforms:
  ```bash
  npm run make
  ```

The generated artifacts are placed in the `out/` directory. You can configure additional packaging options in `package.json` or `forge.config.js`.

## Testing and Linting

Lint the project using ESLint to ensure code quality and catch common issues:

```bash
npm test
```

The lint script runs automatically in CI to prevent regressions.

## Security Notes

The application loads remote content from BreakoutProp servers within an Electron `BrowserWindow`. When loading remote content:

- Always validate the URLs you load and restrict navigation to trusted domains only.
- Avoid enabling the Node.js integration in renderer processes unless strictly necessary.
- Keep dependencies updated to receive the latest security patches.
- Review Electron's security guidelines regularly: <https://www.electronjs.org/docs/latest/tutorial/security>

## Additional Resources

- [Electron Forge Documentation](https://www.electronforge.io/)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
