# Product

## Problem and audience

Mockup Studio is a desktop scene builder for composing device mockups. It is for users who need to arrange device screenshots, text, images, and shapes on a canvas, then export the result as an image or a multi-scene ZIP. The current package version is `0.4.0` in [`package.json`](../package.json).

The app runs as an Electron desktop application; the maintained build configuration targets desktop installers and AppImage rather than a web deployment.

## What it does today

### Scene editing

- Devices, text boxes, image overlays, shapes, groups, and masks are stored as scene data in [`src/shared/types.ts`](../src/shared/types.ts).
- The document store is composed from slices under [`src/renderer/store/`](../src/renderer/store/); [`src/renderer/store/index.ts`](../src/renderer/store/index.ts) is the composition point. The runtime store in [`src/renderer/runtime/`](../src/renderer/runtime/) holds transient editor state and is not serialized.
- Element components are presentational facades; pointer interaction is routed through the Tool Manager and [`src/renderer/components/canvas/ToolEventSurface.tsx`](../src/renderer/components/canvas/ToolEventSurface.tsx).
- Drag and resize sessions mutate DOM styles during a gesture and commit to the store on pointer-up; see [`src/renderer/services/transform.ts`](../src/renderer/services/transform.ts).
- Undo and redo use JSON snapshots with a maximum of 500 entries in [`src/renderer/store/historySlice.ts`](../src/renderer/store/historySlice.ts).

### Tools and canvas

The tool taxonomy is defined in [`src/renderer/tools/`](../src/renderer/tools/) and rendered by [`src/renderer/components/toolbar/BottomToolbar.tsx`](../src/renderer/components/toolbar/BottomToolbar.tsx). It includes select, hand, marquee, focus, paint, blur, eraser, magic eraser, delete, and mask behaviors. [`src/renderer/services/`](../src/renderer/services/) contains viewport transforms, hit testing, snapping, focus resolution, preview geometry, raster operations, and polygon boolean difference.

Canvas chrome and transient overlays are separated from the export node in [`src/renderer/components/canvas/`](../src/renderer/components/canvas/). The export boundary is `[data-scene-export]`.

### Masks and effects

Masks are first-class scene layers in [`src/shared/types.ts`](../src/shared/types.ts): each mask has scene-space geometry, a `zIndex`, visibility/lock flags, and optional `holes` or `snapshot` data. There is no `targetId`. The rendering and subtraction logic lives in [`src/renderer/services/mask-visualization.ts`](../src/renderer/services/mask-visualization.ts), [`src/renderer/services/mask-diff.ts`](../src/renderer/services/mask-diff.ts), and [`src/renderer/services/polygon-clip.ts`](../src/renderer/services/polygon-clip.ts). See the [mask engine](./mask-engine.md) for the detailed contract.

Per-element effects are defined by the registry in [`src/renderer/lib/effects.ts`](../src/renderer/lib/effects.ts) and edited through the Properties panel under [`src/renderer/components/sidebar/`](../src/renderer/components/sidebar/).

### Projects and export

- `.mockup` files are ZIP archives containing `manifest.json` and an `assets/` directory; serialization lives in [`src/renderer/lib/project-serialization.ts`](../src/renderer/lib/project-serialization.ts) and file I/O in [`src/main/file-system.ts`](../src/main/file-system.ts).
- Crash-recovery snapshots and the recent-project list are stored under Electron's `app.getPath('userData')`; see [`src/main/file-system.ts`](../src/main/file-system.ts) and [configuration](./configuration.md).
- Export logic in [`src/renderer/lib/export-engine.ts`](../src/renderer/lib/export-engine.ts) captures the scene to a canvas, supports solid/transparent/scene backgrounds, punches scene masks on the raster, and writes multi-scene output through JSZip.
- Auto-update wiring is in [`src/main/auto-updater.ts`](../src/main/auto-updater.ts) and the GitHub publish provider is configured in [`package.json`](../package.json). The package scripts pass `--publish never`.

## Feature inventory by area

| Area | Evidence |
| --- | --- |
| Device and element scene model | [`src/shared/types.ts`](../src/shared/types.ts), [`src/renderer/lib/element-factories.ts`](../src/renderer/lib/element-factories.ts) |
| Store slices and runtime separation | [`src/renderer/store/`](../src/renderer/store/), [`src/renderer/runtime/`](../src/renderer/runtime/) |
| Tools and keyboard interaction | [`src/renderer/tools/`](../src/renderer/tools/), [`src/renderer/hooks/useKeyboardShortcuts.ts`](../src/renderer/hooks/useKeyboardShortcuts.ts) |
| Canvas rendering and overlay chrome | [`src/renderer/components/canvas/`](../src/renderer/components/canvas/), [`src/renderer/elements/`](../src/renderer/elements/) |
| Sidebar panels and properties | [`src/renderer/components/sidebar/`](../src/renderer/components/sidebar/) |
| Export, ZIP I/O, and recovery | [`src/renderer/lib/export-engine.ts`](../src/renderer/lib/export-engine.ts), [`src/main/file-system.ts`](../src/main/file-system.ts) |
| Packaging | [`package.json`](../package.json), [`electron.vite.config.ts`](../electron.vite.config.ts) |

## Known gaps

- No editor screenshot is checked in; see [visual identity](./visual-identity.md).
- No `.env.example` or application environment loader was found. The explicit source-level environment read is `ELECTRON_RENDERER_URL`; see [configuration](./configuration.md).
- No coverage report is committed. [Testing](./testing.md) records the fresh `npm test` command output instead of percentages.
- The root `CHANGELOG.md` contains historical release notes, including test counts from the time of each release. Those counts are not the current canonical suite result.
- The [development log](../AGENTS.md) contains historical counts and implementation notes that may not match the current source.

## Sources

[`package.json`](../package.json), [`src/shared/types.ts`](../src/shared/types.ts), [`src/renderer/store/`](../src/renderer/store/), [`src/renderer/runtime/`](../src/renderer/runtime/), [`src/renderer/tools/`](../src/renderer/tools/), [`src/renderer/services/`](../src/renderer/services/), [`src/renderer/lib/export-engine.ts`](../src/renderer/lib/export-engine.ts), [`src/main/file-system.ts`](../src/main/file-system.ts), [`src/main/auto-updater.ts`](../src/main/auto-updater.ts).
