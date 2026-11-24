# Configuration

This page describes configuration that is visible in the current Mockup Studio source: package scripts, build settings, runtime paths, and persisted browser state. Values not present in the repository are not invented.

## Package scripts

From [`package.json`](../package.json):

| Command | Configured action |
|---|---|
| `npm run dev` | `electron-vite dev` |
| `npm run build` | `electron-vite build` |
| `npm run start` | `electron-vite preview` |
| `npm run preview` | `electron-vite preview` |
| `npm run typecheck:node` | `tsc --noEmit -p tsconfig.node.json` |
| `npm run typecheck:web` | `tsc --noEmit -p tsconfig.web.json` |
| `npm run typecheck` | `npm run typecheck:node && npm run typecheck:web` |
| `npm run lint` | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` |
| `npm run format` | `prettier --write "src/**/*.{ts,tsx,css}"` |
| `npm test` | `vitest run` |
| `npm run test:watch` | `vitest` |
| `npm run package` | `electron-builder --win --publish never` |
| `npm run package:mac` | `electron-builder --mac --publish never` |
| `npm run package:linux` | `electron-builder --linux --publish never` |
| `npm run postinstall` | `electron-builder install-app-deps` |

There is no configured `dist`, `test:ui`, `test:coverage`, `release`, or `prepare` script. In particular, `npm run build` does **not** run TypeScript checking; use `npm run typecheck` separately.

## Build and test configuration

- [`electron.vite.config.ts`](../electron.vite.config.ts) defines the main, preload, and renderer builds. The renderer root is `src/renderer`, the preload output is CommonJS, and the compile-time constant is `__APP_VERSION__`, sourced from the package version.
- Renderer aliases are `@` → `src/renderer` and `@shared` → `src/shared`. TypeScript path mappings in [`tsconfig.node.json`](../tsconfig.node.json) and [`tsconfig.web.json`](../tsconfig.web.json) map `@shared/*` → `src/shared/*`.
- [`vitest.config.ts`](../vitest.config.ts) sets `environment: 'jsdom'`, `globals: true`, `setupFiles: ['src/__tests__/setup.ts']`, includes `src/**/*.test.{ts,tsx}`, maps `@shared` → `src/shared`, and disables Vitest's own typechecking. See [testing.md](testing.md).

## Environment variables

No `.env.example` or application `.env` loader was found. The only explicit `process.env` read found in the source is `ELECTRON_RENDERER_URL` in [`src/main/index.ts`](../src/main/index.ts), used to select the renderer URL in development. Do not infer additional public variables from stale drafts: there is no configured `VITE_APP_VERSION`, `GITHUB_TOKEN`, or `NODE_ENV` define in the current build files.

## Runtime paths

Paths returned by [`src/main/file-system.ts`](../src/main/file-system.ts) are derived from Electron's `app.getPath('userData')`; the repository does not hardcode a platform-specific absolute directory.

| Path helper | Resolved location | Purpose |
|---|---|---|
| `getAppDataDir()` | `app.getPath('userData')` | Base application data directory |
| `getRecoveryDir()` | `<userData>/recovery` | Crash-recovery snapshots |
| `getRecentPath()` | `<userData>/recent.json` | Recent project list |
| `getComponentsPath()` | `<userData>/components.json` | Custom components |
| `<projectId>.recovery` | `<userData>/recovery/<sanitizedId>.recovery` | A single recovery snapshot; ids are sanitized before path construction |

Project files are user-chosen `.mockup` paths. [`src/main/file-system.ts`](../src/main/file-system.ts) reads and writes them as ZIP archives containing `manifest.json` and an `assets/` directory. They are separate from the `userData` files above.

## Browser-persisted state

| Location | Used for | Source |
|---|---|---|
| `mockup-studio-last-seen-version` | Last version shown by the what's-new flow | [`src/renderer/App.tsx`](../src/renderer/App.tsx) |
| `mockup_studio_custom_sizes` | User-added canvas preset sizes | [`src/renderer/components/sidebar/CanvasPresetsPanel.tsx`](../src/renderer/components/sidebar/CanvasPresetsPanel.tsx) |
| `?guide=1` URL flag | Render the standalone user guide view | [`src/renderer/App.tsx`](../src/renderer/App.tsx), [`src/main/index.ts`](../src/main/index.ts) |

## Packaging configuration

The `build` block in [`package.json`](../package.json) declares:

- App id `com.mockup-studio`; product name `Mockup Studio`.
- Main entry `./out/main/index.js`; packaged files `out/**/*`; output directory `release`.
- Windows NSIS and portable x64 targets, macOS DMG x64/arm64 targets, and a Linux AppImage x64 target.
- GitHub publishing configured for `Omar-Khaled-57/mock-up-studio`; the package scripts pass `--publish never`, so they do not publish automatically.
- A `.mockup` file association.

See [deployment.md](deployment.md) for how these settings are used.

## Sources

[`../package.json`](../package.json), [`../electron.vite.config.ts`](../electron.vite.config.ts), [`../vitest.config.ts`](../vitest.config.ts), [`../src/main/file-system.ts`](../src/main/file-system.ts), [`../src/main/index.ts`](../src/main/index.ts), [`../src/renderer/App.tsx`](../src/renderer/App.tsx), and [`../src/renderer/components/sidebar/CanvasPresetsPanel.tsx`](../src/renderer/components/sidebar/CanvasPresetsPanel.tsx).
