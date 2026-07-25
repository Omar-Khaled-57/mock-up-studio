# Mockup Studio — Development Log

## Project Overview
Desktop mockup scene builder. Electron + React + TypeScript + Vite + Tailwind 3 + Zustand.

## Tech Stack
- **Electron** — desktop shell, `contextIsolation: true`, `nodeIntegration: false`
- **electron-vite** — bundler (requires Vite 5)
- **React 19** + TypeScript
- **Tailwind CSS 3.4** — utility-first styling
- **Zustand** — state management (7 slices merged into single store)
- **shared/types.ts** — core interfaces (`Scene`, `Device`, `TextBox`, `ImageOverlay`, `Background`, etc.)

## Key Decisions
- `@shared/*` path alias configured in both `tsconfig.web.json` and `tsconfig.node.json`
- `useDrag` commits only on pointerup (direct DOM mutation during drag for 60fps)
- `useResize` uses window-level pointermove/pointerup listeners (not pointer capture)
- History via JSON snapshots — `pushHistory` serializes scenes, undo/redo parses; max 500 entries
- Debounced `pushHistoryDebounced` (500ms) for continuous inputs (sliders, color pickers)
- `buildTextStyle` + `resolveThemeColors` extracted to `src/renderer/lib/device-utils.ts` — eliminates DRY violations
- `BackgroundPresetName` type exported from `constants.ts`, not `types.ts`
- ESLint does not honor `_id` prefix convention — unused params must be removed entirely
- `dev/` folder is in `.gitignore` — docs not tracked

## Folder Structure
```
src/
  main/              — Electron main process
  preload/           — contextBridge
  shared/            — types.ts
  renderer/
    App.tsx           — root layout: Sidebar | Canvas | PropertiesPanel
    store/            — Zustand (sceneSlice, selectionSlice, historySlice, viewportSlice, uiSlice, projectSlice)
    hooks/            — useDrag, useResize, useKeyboardShortcuts
    lib/              — constants, device-utils, id
    components/
      canvas/         — Canvas.tsx (viewport), Scene.tsx (z-sorted render)
      devices/        — DeviceFrame, Monitor, Laptop, Phone, Ipad, Watch, Browser, Terminal, ScreenContainer
      text/           — InlineEditor, TitleBlock, TextBox
      images/         — ImageOverlay
      backgrounds/    — BackgroundRenderer, SolidBg, GradientBg, ImageBg(?), AuroraBg, NeonGridBg, BlueCyberBg, QPresetBg, QlessBg, Storybox3Bg, DarkSolidBg
      sidebar/        — Sidebar, DevicesPanel, TextPanel, CanvasPresetsPanel, LayersPanel, PropertiesPanel, ThemesPanel
      shared/         — ResizeHandles, ContextMenu
      splash/         — SplashScreen (not wired)
```

## Build Commands
- `npm run dev` — dev mode with hot reload
- `npm run build` — production build
- `npm start` — run production build

## Git
- `main` branch — active development
- `legacy` branch — old React+Vite code (pre-Electron rewrite)
- All docs in `dev/` are gitignored

## Phases Completed
| Phase | Description | Status |
|---|---|---|
| 0 | Project Scaffolding | Done |
| 1 | Scene Foundation | Done |
| 2 | Drag & Drop | Done |
| 3 | Text Editing | Done |
| 4 | Device Management | Done |
| 5 | Layer Panel, Selection & Properties | Done |
| 6 | Preset Gallery & Theme Backgrounds | Done |

## Phases Remaining
| Phase | Description | Status |
|---|---|---|
| 7 | Smart Guides & Snapping | Pending |
| 8 | Full Keyboard Shortcuts & Clipboard | Partially done |
| 9 | Project Files (.mockup save/load) | Pending |
| 10 | Export Engine | Pending |
| 11 | Color Extraction (partial) | Pending |
| 12 | Multi-Scene & Version History | Pending |
| 13 | Polish & Extras | Pending |
