# Deployment

Mockup Studio is an Electron desktop application. This page records the build and packaging commands that exist in [`package.json`](../package.json), the configured artifacts, and the deployment pieces that are not present in the repository.

## Build and package commands

Run commands from the `mock-up-studio/` directory after `npm install`:

```bash
npm run build        # electron-vite build
npm run start        # electron-vite preview
npm run preview      # electron-vite preview

npm run package      # electron-builder --win --publish never
npm run package:mac  # electron-builder --mac --publish never
npm run package:linux # electron-builder --linux --publish never
```

`npm run build` bundles the main, preload, and renderer entries from [`electron.vite.config.ts`](../electron.vite.config.ts). It does not run TypeScript checks; use `npm run typecheck` before packaging. The packaging scripts point electron-builder at `out/**/*`, so build first.

There is no `dist` script, no `release` script, and no `prepare` script. `postinstall` runs `electron-builder install-app-deps`.

## Configured artifacts

The `build` block in [`package.json`](../package.json) declares:

| Setting | Value |
|---|---|
| App id | `com.mockup-studio` |
| Product name | `Mockup Studio` |
| Main entry | `./out/main/index.js` |
| Packaged files | `out/**/*` |
| Extra resource | `public/logo.ico` → `logo.ico` |
| Output directory | `release` |
| Windows | NSIS x64 and portable x64 |
| macOS | DMG x64 and arm64 |
| Linux | AppImage x64 |
| NSIS artifact name | `Mockup-Studio-Setup-${version}.${ext}` |
| File association | `.mockup` |

The scripts pass `--publish never`. The `build.publish` block names GitHub owner `Omar-Khaled-57` and repository `mock-up-studio`, but these package scripts do not publish automatically. Confirm the generated files in `release/` after a build; exact filenames for targets without an `artifactName` override are electron-builder defaults and should not be guessed.

## Runtime update path

[`src/main/auto-updater.ts`](../src/main/auto-updater.ts) initializes `electron-updater` only after the window is ready and skips automatic checks in development. In packaged builds it checks 5 seconds after startup and every 6 hours. It does not auto-download or auto-install; main sends styled `update-prompt` events with `available`, `ready`, or `failed` payloads, and the renderer replies through `respondToUpdate` with `download`, `later`, or `restart`.

[`src/main/ipc-handlers.ts`](../src/main/ipc-handlers.ts) implements the manual `check-for-updates-now` handler. It returns a friendly failure in unpackaged builds and races the check against a `25_000` ms timeout. Download progress is sent to the renderer as a percentage. See [configuration.md](configuration.md) for the build-time version constant and [architecture.md](architecture.md) for the IPC boundary.

## Installed application data

[`src/main/file-system.ts`](../src/main/file-system.ts) derives application data paths from Electron's `app.getPath('userData')`. Recent projects are stored in `recent.json`, the per-user Units library in `components.json`, and crash-recovery snapshots in `recovery/`. Projects themselves are user-chosen `.mockup` ZIP paths with `manifest.json` and `assets/`. See [configuration.md](configuration.md) for the file layout.

## Verification checklist

1. Run `npm test`.
2. Run `npm run typecheck`.
3. Run `npm run build`.
4. Run the package script for the target platform after the build.
5. Inspect `release/` and confirm the product name, version, and expected target artifacts.
6. Install or launch the artifact and verify project save/load, recent files, and recovery.
7. If using the configured GitHub provider, publish or upload artifacts deliberately; the package scripts do not do it.

## Known gaps

- No CI workflow files were found, so no automated deployment pipeline is documented here.
- No signing, notarization, or store-submission configuration was found in [`package.json`](../package.json).
- No release helper script is present; [`scripts/`](../scripts/) contains only `generate-icon.cjs`.
- Historical counts and dates in [`CHANGELOG.md`](../CHANGELOG.md) are release-era notes, not current build metrics.

## Sources

[`../package.json`](../package.json), [`../electron.vite.config.ts`](../electron.vite.config.ts), [`../scripts/generate-icon.cjs`](../scripts/generate-icon.cjs), and [`../CHANGELOG.md`](../CHANGELOG.md).
