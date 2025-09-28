# breakoutpropterminal
An Electron-based trading terminal for BreakoutProp.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the Electron app:
   ```bash
   npm start
   ```

## Packaging Icons

Binary icon assets are generated on demand so they do not need to be stored in the repository.
Before packaging the application, run:

```bash
npm run generate-icons
```

The `prepackage` npm script runs this command automatically, ensuring `npm run package`
creates `.ico`, `.icns`, and `.png` files under `assets/` for each platform.
