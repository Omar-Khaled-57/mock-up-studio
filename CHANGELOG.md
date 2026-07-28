# Changelog

All notable changes to Mockup Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-28

Initial release.

### Origin

Started as `mockup-template.html` — a static HTML mockup generator. Evolved into a React + Vite web app (`legacy` branch) before being rewritten as a proper Electron desktop application with full architecture.

### Added

#### Core
- Electron 33 desktop shell with `contextIsolation: true`, `nodeIntegration: false`
- electron-vite 2 bundler (Vite 5)
- React 18 + TypeScript 5.6
- Tailwind CSS 3.4 utility-first styling
- Zustand 5 state management with 10 merged slices
- MIT license

#### Devices
- 7 device types: Monitor, Laptop, iPad, Phone, Watch, Browser, Terminal
- Device frame components with bezel styling
- Double-click to upload custom screen images
- Drag-and-drop and clipboard paste for screen upload
- Object-fit modes: contain, cover, stretch

#### Canvas & Scene
- Infinite canvas with zoom (trackpad + scroll + buttons) and pan
- Scene renderer with z-sorted element rendering
- Multi-scene support with tab navigation
- Grid overlay with configurable size, color, and snap
- Smart guides with snap to element edges/centers, canvas center/edges, grid intersections
- Auto-fit on first load and on window resize (debounced)

#### Drag & Resize
- 60fps pointer-event-based dragging with direct DOM mutation
- Store commit on pointerup for history compatibility
- 4-corner resize handles with Shift-proportional scaling
- Arrow key nudge (1px, Shift+arrows for 10px)

#### Text
- Inline editing with double-click
- Title block preset (centered title + subtitle)
- Text effects: gradient fill, glow, shadow, stroke
- Font family, size, weight, alignment, line height controls

#### Images
- Image overlay upload, positioning, and sizing
- Object-fit: contain, cover, stretch
- Dedicated Images panel with visibility, lock, duplicate, delete

#### Backgrounds
- Solid color, linear/radial gradient
- 7 built-in presets: Aurora, Neon Grid, Blue Cyber, QPreset, Qless, Storybox 3, Dark Solid
- Themes panel for background selection and customization

#### Layers
- Z-order layer list with drag reorder
- Visibility toggle, lock toggle
- Inline rename, context menu (duplicate, z-order, delete, extract colors)
- Extract dominant colors from device screens

#### Properties Panel
- Position (X, Y) and size (W, H) with live update
- Rotation control
- Device-specific properties (screen radius, bezel width, accent color)
- Text-specific properties (font, size, weight, alignment, color, effects)
- Alignment tools: 6-direction alignment when 2+ elements selected

#### Export
- PNG, JPEG, WebP formats
- Scale: 1x, 2x, 3x, 4x
- Background: solid, transparent, custom
- Watermark toggle (excluded from export via data attribute)
- Multi-scene export as ZIP archive with scene names in filenames

#### Project Files
- `.mockup` ZIP format with JSON manifest + assets
- Save, Save As, Open, New Project
- Recent projects list
- Auto-save recovery (periodic snapshots)
- Crash recovery on relaunch

#### Desktop Integration
- OS file association for `.mockup` files
- Native menu with keyboard shortcuts
- Unsaved changes guard on window close
- Auto-update via GitHub Releases (production, 6h check interval)

#### UI
- Dark / light theme toggle (canvas stays dark)
- Sidebar with 9 tabbed panels
- Shortcuts modal (Ctrl+/)
- Layout templates (5 presets)
- Version history panel with auto-snapshots (5min interval, 50 max)
- Splash screen with logo, new/open/recent project options
- Watermark overlay option

#### Quality
- Error boundaries for crash isolation (root + canvas)
- 136 unit tests across 12 files (vitest + jsdom)
- ESLint with zero warnings
- TypeScript strict mode

### Fixed
- `cutSelected` history contract: push before delete so undo restores items
- `ImagesPanel` store selector: `scene.canvas` instead of non-existent `canvas`
- `historySlice` undo/redo: use `state` parameter instead of redundant `get()` inside `set()`
- `exportAllScenes`: try/finally restores original scene on error
- Close guard: 3-second safety timeout if renderer never responds
- Canvas resize: debounced ResizeObserver (100ms) prevents infinite loops
- Context menu: `useLayoutEffect` for positioning prevents flicker
- PropertiesPanel: input overflow fixed with min-width constraints
- Window icon: multi-size ICO instead of pixlated PNG
- Device double-click: moved to DeviceFrame level to bypass drag handler

### Performance
- LayersPanel entries array wrapped in `useMemo`
- Keyboard shortcuts read `selectedIds` via `getState()` (no closure dependency)
- PropertiesPanel memo deps narrowed to specific scene fields
- Drag uses direct DOM mutation at 60fps, commits to store on pointerup only
