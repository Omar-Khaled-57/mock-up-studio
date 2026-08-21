# Changelog

All notable changes to Mockup Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-08-21

Units (Components) system release. A Figma-style master/instance reusable-element library with per-user global storage, definition editing with live instance sync, type-tag categorization, panel search/sort/group management, drag-and-drop placement, 36 themed default units, and cross-platform emoji rendering fix.

### Units (Components) System

- **Save as Unit** — save any canvas element as a reusable Unit definition via context menu ("Add to Units") or the Units panel
- **Master/instance model** — instances mirror their definition's visual properties; edit the definition to update every instance live
- **Per-user global library** — units persist to disk and load on startup; separate from the project file
- **36 themed default units** across 3 palettes: Redora (Hover Agency), Qless (BoardFlow), CatarinaUI — each with buttons, badges, cards, headings, inputs, navbars, progress bars, and alerts
- **Three group modes** — Default (by theme palette), Custom (user-created), and By type
- **Search** — filter units by name across all groups
- **Context menu** — Rename, Edit Properties, Delete, Move to group
- **Drag-and-drop** — drag units from the panel onto the canvas to place them
- **Definition editing** — edit unit properties (text, color, shape, effects) with changes synced to all instances
- **Type tags** — each unit carries an optional type tag (Text, Shape, Image, etc.) for categorization
- **Group management** — create, rename, delete, and inline-rename groups; "+ New Group" always visible

### Cross-Platform

- **Emoji rendering fixed on Linux** — all emoji in the User Guide and ComponentsPanel replaced with lucide-react SVG icons that render identically on all platforms

### UI Fixes

- **Modal dropdown clipping** — `FilterableGroupSelect` portals its dropdown to `document.body` so it is no longer clipped by the modal's `overflow-y: auto`
- **ContextMenu dismiss timing** — outside-click listener delayed by one tick to prevent premature close on right-click open
- **Sidebar panel opacity** — `bg.panel` changed from translucent `bg-zinc-900/50` to opaque `bg-zinc-900`
- **White modal divider** — uses `border.primary` theme token instead of hardcoded `borderColor: 'inherit'`

### Performance

- **ComponentCreationModal split** — outer shell subscribes only to the boolean flag; inner form mounts only when open (zero store overhead when closed)

### Quality

- 1158 tests / 76 files passing
- ESLint zero errors / zero warnings
- TypeScript strict mode clean
- Production build clean (pre-existing dynamic-import warnings only)

---

## [0.3.1] - 2026-08-04

Polish release. Native Electron dialogs are replaced with styled in-app modals, the auto-update flow gains visible feedback end to end, and the Keyboard Shortcuts reference gets clearer section headings.

### Styled Dialogs

- **About Mockup Studio** — now a styled modal (app name, tagline, version, creator, GitHub + portfolio links) instead of a native system dialog
- **Auto-update prompts** — update-available, ready-to-restart, and update-failed states render as styled in-app dialogs driven by the runtime store
- **Live update checks** — Help → Check for Updates shows a "checking…" spinner state immediately
- **Up-to-date confirmation** — when no newer release exists, the prompt resolves to a "You're running the latest version" dialog instead of silently closing
- **Network-timeout guard** — the update check races a 25-second timer, so a blocked/slow network surfaces a clear error ("The update server did not respond in time…") rather than hanging silently
- **Download progress bars** — update download progress renders as a live percentage bar in the toolbar footer and the canvas chrome bar
- **Escape semantics** — pressing Escape on an available-update prompt defers the download (equivalent to Later)

### Keyboard Shortcuts

- **Section dividers** — hairline separators now sit between the File, Edit, and Canvas sections of the shortcuts reference modal
- **Section titles** — File / Edit / Canvas render at full contrast (white in dark mode, black in light mode) so they read clearly as headings rather than shortcuts

### Internal Improvements

- The updater no longer sends IPC after a promise resolves (no stale "available" frames after the renderer has moved on); the renderer owns the modal lifecycle
- `respondToUpdate('download' | 'later' | 'restart')` bridges prompt actions over IPC to the main process (download + progress bar, clear progress, quit-and-install)
- Unpackaged (dev) builds return a friendly "update checks only run in the packaged app" message instead of dialogs

### Quality

- 1091 tests / 74 files passing
- ESLint zero errors / zero warnings
- TypeScript strict mode clean
- Production build clean (pre-existing dynamic-import warnings only)

---

## [0.3.0] - 2026-08-04

A major release overhauling the tool system, adding the complete mask engine, brush tools, visual feedback layer, and the v0.3.0 redesign foundation. The editor moves from inline element handlers to a centralized Tool Manager pattern, introduces first-class masking with polygon boolean clipping, and adds paint/eraser/blur/focus tools. The UI gets a bottom toolbar, contextual Properties panel, canvas chrome bar, and export modal.

### Tool System

- **Bottom toolbar** with grouped tool faces (Select, Brush, Eraser, Focus, Mask) and variant flyouts
- **Tool shortcuts** — single-key activation: V (Select), H (Hand), M (Marquee), X (Focus), B (Brush group), E (Eraser group), G (Mask), Space (temporary Hand)
- **Tool Manager pattern** — centralized dispatch via `ToolEventSurface` pointer dispatcher; tools are stateless descriptors receiving an `InteractionContext`
- **Tool-independent resize** — corner-handle resizing works with any tool active (Select tool's gate stack is reused)
- **Tool options** — inline options panel beneath the toolbar (paint: Color + Size + Hardness; mask: shape/mode buttons)
- **Reachability gating** — only tools with `onPointerDown` are shortcut-reachable; stubs stay disabled
- **Keyboard Shortcuts reference modal** (Ctrl+/)

### Masking System

- **First-class masks** — `Scene.masks[]` with reusable clip geometry in the target element's local coordinate frame
- **Mask tool (G)** with brush, rectangle, and ellipse shapes
- **Mask / Unmask modes** — draw to hide (inverted punch) or draw to restore (reveal)
- **Additive masking** — every mask-mode stroke adds a fresh mask, stacking by clip-path intersection
- **Subtractive unmask** — polygon boolean difference engine (Martinez-style) removes masked content in the data model
- **Frozen mask snapshots** — opt-in whole-scene capture glued to the target, rotating with it (Refresh action)
- **Background/canvas masks** — sentinel `__background__` target clips the whole scene, including later-added content
- **Reveal-mask recovery** — an unmask stroke on a whole-canvas reveal removes it entirely
- **Scene-level canvas masks** — background masks clip the whole scene (background + grid + all elements), so content added after a mask is clipped too
- **Export mask punch** — the export engine reproduces mask holes deterministically on the raster (canvas `destination-out` + `evenodd`), since foreignObject capture silently drops evenodd clip-paths; scene backgrounds composite through the punched hole
- **Transparency checkerboard** — 64×64 black + blue squares for mask and transparent-canvas visualization

### Image Editing Tools

- **Paint Brush tool** — freehand strokes committed as per-stroke `Paint N` raster layers, composited via the rasterizer
- **Blur Brush tool** — destructive blur on existing element bitmaps
- **Eraser tool** — `destination-out` erase to transparent
- **Magic Eraser** — tolerance-based flood-fill erase
- **Delete tool** — single-click element deletion
- **Per-element image effects** — 9 non-destructive effects (brightness, contrast, exposure, saturation, hue, gamma, temperature, tint, blur)
- **Image enhancements** — opacity, border-radius, blend modes (12), flip X/Y, CSS blur, glow, shadow
- **`objectFit: 'fill'`** — images always fill their box for WYSIWYG aspect-ratio lock

### Shapes

- **Gradient shape fills** — reusable fill control with solid + linear / radial / conic gradients; renders identically on canvas, in exports, and in the rasterizer
- **Cross containers** — cross (`✕`) shapes clip their children to the exact union outline (12-gon), no box fallback
- **WYSIWYG resize** — the shape render tracks live resize bounds via the shared ghost source, so shapes never letterbox during a gesture

### Selection & Editing Improvements

- **Focus mode (X)** — group-scoped editing with a dimming scrim and highlight ring; dimmed content rejects all interactions
- **Element focus** — focus works on every element kind (devices, text boxes, images, shapes); new elements auto-parent into the focused container, and the container's clip lifts while focused so children stay fully editable
- **Container clips** — grouped elements render clipped to their container's shape outline at render time
- **Drag-to-nest** — drag one element onto another to make it a child (clipped to parent); empty-canvas drop un-nests
- **Aspect ratio lock** — per-element toggle in the Transform row; locked elements resize proportionally without Shift
- **Alignment tools** — 6-direction align and 4-direction distribute (space-horizontal/vertical, center-horizontal/vertical)
- **Copy / Paste Style** — transfer appearance-only properties between same-kind elements

### Canvas & Viewport

- **Canvas chrome bar** — scene tabs, zoom controls (in/out/reset/fit), View menu (rulers, grid, smart guides, snap)
- **Canvas empty state** — first-run overlay with quick-add actions (device, text, image, template presets)
- **Canvas rotation** — Rotate 90° button swaps width/height through `applySize`
- **Transparent canvas** — toggle in the Themes panel; scene background renderer returns `null`, editor shows checkerboard, exports carry real alpha
- **Grid opacity** — slider control in the Grid panel
- **Rulers** — zoom/pan-aware tick marks with drag-to-create-guide
- **Interactive guides** — drag to reposition, right-click to delete

### UI/UX Redesign

- **Contextual Properties panel** — three states: empty (quick actions), multi-selection (align/distribute/copy-paste style), single element (sectioned: Transform, Content, Appearance, Effects, Mask, Advanced)
- **Sectioned sidebar rail** — Design, Content, Organize, View, History groups
- **Sectioned layout** — Properties sections are collapsible with persistent per-session open/closed state
- **Dark / light UI theme** — sidebar and panels adapt; canvas stays dark in both
- **Theme token system** — semantic `bg.*`, `text.*`, `border.*` tokens replace hardcoded colors
- **Component primitives** — 14 shared components (Button, Modal, Menu, NumberInput, SliderInput, etc.)

### Performance

- **60fps live manipulation** — drag/resize mutate DOM styles directly, committing to the store only on pointer-up
- **Imperative canvas previews** — StrokeSurface (brush strokes) and PreviewSurface (ghost/blur indicators) render via direct canvas APIs, no React re-renders per frame
- **Serialized stroke commits** — module-level promise chains ensure overlapping brush/eraser strokes commit in document order

### Internal Improvements

- **Two-store architecture** — Document store (serialized/snapshotted) separated from Runtime store (transient, reset-aware)
- **13 merged Zustand slices** (was 10) — shape, mask, and effects slices added
- **Dirty tracking** — `attachDirtyTracking` detects scene reference changes; `withDirtySuppressed` for programmatic loads
- **Full reset hooks** — `registerFullResetHook` fires registered callbacks on project load/new
- **Gesture interrupt** — `onInterrupt` lifecycle on every tool; Escape/blur/reset clears all pending state

### Refactoring

- **Element facades** — DeviceFrame, TextBox, ImageOverlay, ShapeRenderer are now pure presentational components with zero pointer handlers; the Select tool owns all interactions
- **Hero text refactor** — title/slogan promoted from `Scene.titleText`/`sloganText` to first-class `textBoxes[]` with `stylePreset`
- **Shared services** — `buildTextStyle`/`resolveThemeColors` extracted to `lib/device-utils.ts`; `getShapePath` to `services/shape-geometry.ts` (shared by renderer + container clip)
- **Preview architecture** — data-driven `PreviewState` system with `drawPreview` as the single geometry→canvas mapper

### Fixed

- **Image aspect-ratio break** — `<img>` rendered with `objectFit: 'contain'`, causing letterboxing when the box aspect diverged from the source; now `objectFit: 'fill'`
- **Mask tool polarity flipped** — drawing a mask no longer checkerboards the whole element; the drawn region is masked out
- **Resize aspect-lock broken** — `ctx.modifiers.shift` was always false; now tracked via keyboard events
- **Ctrl/Shift+click multi-select lost** — restored group-aware selection via `select(id, multi)`
- **Locked elements editable via double-click** — added `hit.locked` guard before edit/upload branches
- **RenameOverlay double-commit on Enter** — Enter triggers commit → unmount → blur → commit again; now guarded with `doneRef`
- **LayersPanel JSX syntax errors** — ternary false branches missing closing tokens
- **LayersPanel duplicate visibility button** — lock button was replaced with second visibility button
- **Mask clip rendering** — multi-contour `polygon(… evenodd)` is corrupted by Chromium's contour joining (and trailing `evenodd` was rejected outright); all mask and focus-dim clips now emit opposite-wound `path()` subpaths, matching real-browser pixel probes
- **Export masks** — evenodd clip-paths were dropped by foreignObject capture; masks now punch the exported raster deterministically so exports match the editor
- **Calligraphy → Pen** — the brush preset is labelled Pen (button identity) while the options strip keeps the "Calligraphy" heading

### Removed

- **TitleBlock component** — heroes now render through the standard TextBox facade
- **Inline element pointer handlers** — drag/resize/snap handlers removed from DeviceFrame, TextBox, ImageOverlay, ShapeRenderer, ResizeHandles (all interactions now go through the Tool Manager)

### Quality

- 1074 tests / 72 files passing (was 136 / 12)
- ESLint zero errors / zero warnings
- TypeScript strict mode clean
- Production build clean (pre-existing dynamic-import warnings only)

---

## [0.2.8] - 2026-07-31

### Fixed
- **Unsaved-changes guard now catches scene edits** — editing the canvas (move/resize/brush/mask/effects, etc.) marks the project dirty, so closing/new/open no longer silently discards changes (critical data-loss fix)
- User guides no longer leak into exported images
- Export background overrides (solid color / transparent) now actually apply instead of being covered by the scene background
- Resize now commits to the store only on pointer-up (like drag), so a cancelled resize leaves the document untouched
- Escape / window blur / full reset cancel in-flight gestures (drag, resize, pan, marquee, brush strokes, mask strokes) so no stranded session can commit against a later scene
- Window blur no longer leaves the app stuck in a temporary Hand tool
- Removed an unvalidated `save-image` IPC channel that could write to arbitrary absolute paths (security fix)
- Scene edits now surface correctly in undo/redo dirty tracking after a save

### Quality
- 618 tests / 39 files passing (was 602/39); lint, typecheck, and production build clean; NSIS + portable packaging verified

## [0.2.7] - 2026-07-30

### Added
- Download progress bar in the app footer during auto-update downloads
- Error dialog when auto-update download fails

### Fixed
- Auto-update "Download" button now shows visible progress instead of appearing to do nothing

### Changed
- Version bump from 0.2.6 → 0.2.7

## [0.2.6] - 2026-07-30

### Fixed
- Auto-updater error dialog no longer shows on automatic startup checks — only on manual "Check for Updates…"
- Clean, user-friendly error message instead of raw stack trace

### Changed
- Version bump from 0.2.5 → 0.2.6

## [0.2.5] - 2026-07-30

### Added
- Scene tab drag-to-reorder with visual drop indicator
- Scene pinning (pinned tabs grouped separately, not draggable, excluded from bulk delete)
- Collapsible scene tab bar with header showing active scene name
- Scroll arrows on tab bar (scroll one tab at a time)
- Scene switcher in LayersPanel (◀/▶ arrows)
- Rename scene via context menu

### Fixed
- History contract violation in keyboard shortcuts: `pushHistory` now called before `deleteSelected` and `duplicateSelected` so undo correctly restores pre-mutation state
- Removed unused `scrollbar` theme tokens from `useTheme`

### Removed
- "Delete All Tabs" context menu option

### Quality
- Pre-release audit: ESLint 0, TypeScript clean, 231 tests passing, production build clean

## [0.2.0] - 2026-07-29

### Added

#### Shape System
- 12 SVG shape kinds: rectangle, circle, triangle, hexagon, diamond, parallelogram, trapezoid, cross, plus, heart, shield, arrow-right
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
