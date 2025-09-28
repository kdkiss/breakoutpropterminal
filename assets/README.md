# Icon Assets

The Electron Forge configuration expects platform-specific icon files in this directory. To avoid committing large binary assets, run `npm run generate:icons` (automatically invoked by the existing npm scripts) to materialize `icon.png`, `icon.ico`, and `icon.icns` before packaging or distributing the application.
