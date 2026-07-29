# Changelog

All notable changes to Mockup Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-07-29

### Added

#### Shape System
- 11 SVG shape kinds: rectangle, circle, triangle, hexagon, diamond, parallelogram, trapezoid, cross, plus, heart, shield, arrow-right
- Shape CRUD with dedicated slice, panel, and z-order support
- Shape fill color, opacity, rotation, blur, blend mode
- Shape background image upload (rendered as SVG pattern fill)
- Shape shadow and glow effects via shared editors
- Shape layers in LayersPanel with visibility/lock/rename/duplicate

#### Advanced Editors
- Gradient editor with unlimited color stops, 4 types (linear, radial, conic, reflected), angle control, 10 presets
- Multi-layer shadow editor with inset support and 10 presets
- Multi-layer glow editor with 10 presets
- Shared primitives: ColorInput, SliderInput, ToggleSwitch, SectionHeader

#### Enhanced Typography
- Letter spacing, word spacing, text-transform controls
- Stroke color and stroke width for text
- Line height control
- Added "Add Text Box" button + text box list in TextPanel

#### Image Enhancements
- Opacity, border-radius, blend mode
- Horizontal/vertical flip
- Blur, glow, and shadow effects on image overlays

#### Theme Presets
- 17 color theme presets with swatches and instant apply
- Dedicated ThemePresetsPanel with preview thumbnails
- Device custom color theme: color picker + hex input for bezel/border

#### Interactive Guides & Rulers
- Viewport ruler bars with zoom/pan-aware tick marks
- Drag from ruler onto canvas to create guides
- Interactive guide lines (drag to reposition, right-click to delete)
- Guide preview overlay during drag-from-ruler

#### Layer & Selection Improvements
- Ctrl+click multi-select in LayersPanel
- Triple-click rename for all element kinds (devices, text, images, shapes, groups)
- Nested group rendering with parentGroupId hierarchy
- Extended context menus: Group/Ungroup/Nest in Group/Make Parent Group

#### UI Polish
- Theme token system (`bg.*`, `text.*`, `border.*`) fully migrated across all 20+ panels
- Custom scrollbars, focus indicators, ARIA labels
- Empty states for Devices, Text, Images, and Layers panels
- Light theme support for sidebar, panels, scene tabs
- Preload CJS fix for Electron sandbox compatibility

### Fixed
- `reverseNesting` broken conditional chains
- `GradientEditor` opacity range bars removed per user feedback
- TextPanel alignments not working: `buildTextStyle` missing `textAlign`
- Gradient/glow/shadow toggle always setting `enabled: false`
- Text double-click not editing: added stopPropagation to outer container
- `useResize` pointer capture removed to prevent text edit interference
- LayersPanel broken JSX and duplicate visibility button
- ShapesPanel unused imports cleaned
- `changelog.json` 404 in file:// mode: absolute → relative path
- Various hardcoded theme colors migrated to token system

### Tests
- From 136 to 231 tests across 14 files
- Added shapeSlice tests (10 shape kinds, backgroundImage CRUD)
- Added guide/ruler interaction tests
- Added clipboard shape copy/cut/paste tests

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
