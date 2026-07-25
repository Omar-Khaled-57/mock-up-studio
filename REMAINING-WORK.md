# Remaining Work — Mockup Studio

Status as of Phase 6 completion. Cross-referenced with `dev/docs/4-plan.md` and `dev/docs/1-features.md`.

---

## Completed (Phases 0–6)
- Electron + React + TypeScript + Vite scaffolding
- Zustand store (7 slices), scene rendering, device frames (7 types)
- Drag & drop, resize, arrow nudge, undo/redo
- Inline text editing, title/slogan, text styling (gradient, glow, shadow)
- Device management (add/remove/duplicate/toggle/rename/width/object-fit)
- Screenshot upload (click/drag-drop/paste), ScreenContainer
- Layer panel (z-order list, drag reorder, context menu, visibility/lock)
- Properties panel (position, size, rotation, device-specific, text-specific)
- Keyboard shortcuts (Del, Ctrl+D, Ctrl+Z, Escape, arrow nudge)
- 7 background presets (3 animated, 4 static)
- Themes panel (solid/gradient/image/preset type controls, gradient angle, image blur/dim/tint)
- Canvas presets panel (quick, resolution, custom slots)

---

## Remaining Phases

### Phase 7: Smart Guides & Snapping
**From plan:** Alignment guides when dragging, snap to edges/center/grid.

- [ ] `useSnapping.ts` — calculate snap points from all elements + canvas
- [ ] Show alignment guides when edges/centers align (within 5px threshold)
- [ ] `Guides.tsx` — colored dashed lines
- [ ] Canvas center and edge snap points
- [ ] Grid snap toggle (`Grid.tsx` visible + snap behavior)
- [ ] Grid size/color controls in sidebar
- [ ] Manual guides (drag from rulers)

### Phase 8: Full Keyboard Shortcuts & Clipboard
**From plan:** Centralized shortcut system, native menu, clipboard operations.

Partially done (undo/redo, delete, duplicate, nudge). Still needed:
- [ ] Electron native `Menu` integration for OS menu bar
- [ ] Ctrl+C / Ctrl+X / Ctrl+V — copy/cut/paste elements (serialize to internal clipboard)
- [ ] Ctrl+V with image in OS clipboard — paste as image overlay
- [ ] Ctrl+Shift+V — paste screenshot onto focused device
- [ ] Ctrl+A — select all
- [ ] Ctrl+S / Ctrl+Shift+S / Ctrl+N / Ctrl+O — wired to project file ops
- [ ] Ctrl+E — open export dialog
- [ ] Viewport shortcuts: Ctrl+=/-, Ctrl+0, Ctrl+1, Space+drag
- [ ] Help menu listing all keyboard shortcuts

### Phase 9: Project Files (.mockup Save/Load)
**From plan:** Save/load `.mockup` project files with embedded assets.

- [ ] `file-system.ts` in main process — ZIP read/write with jszip
- [ ] IPC handlers: `save-project`, `open-project`, `get-recent-projects`, `delete-recovery`
- [ ] `project-serialization.ts` — state → manifest JSON, extract image blobs
- [ ] `SplashScreen.tsx` — new/open/recent (shown before any project loaded)
- [ ] Ctrl+S / Ctrl+Shift+S — save/save-as with native file dialog
- [ ] Ctrl+O — open project
- [ ] Ctrl+N — new project (prompt to save unsaved changes)
- [ ] `.mockup` file extension association
- [ ] Recent projects list (`recent.json`, max 20 entries, FIFO)
- [ ] Thumbnails generated on save
- [ ] Auto-save: Zustand middleware debounce (30s)
- [ ] Recovery detection on startup

### Phase 10: Export Engine
**From plan:** High-fidelity export to PNG/JPEG/WebP at multiple resolutions.

- [ ] `export-engine.ts` — clone scene DOM, inject offscreen, capture via `modern-screenshot`
- [ ] Font handling in offscreen clone
- [ ] Animated background: capture as static frame
- [ ] Export dialog: format, scale (1x-4x), background (scene/solid/transparent)
- [ ] Preview rendering with progress bar
- [ ] Save to disk via native file dialog
- [ ] Copy to clipboard with IPC fallback
- [ ] Export presets

### Phase 11: Color Extraction
**From plan:** Extract dominant colors from uploaded images.

Most of Phase 11 (backgrounds) is done. Remaining:
- [ ] `color-extraction.ts` — extract dominant colors from uploaded image
- [ ] "Extract Colors" context menu action on devices/images

### Phase 12: Multi-Scene & Version History
**From plan:** Multiple scenes per project, version snapshots.

- [ ] Scenes as tabs/thumbnails at bottom of sidebar
- [ ] Add/duplicate/delete/rename scenes
- [ ] Export individual scene or all scenes
- [ ] Auto-snapshot every 5 minutes of activity
- [ ] Manual named snapshots
- [ ] Version history panel — restore any version
- [ ] Snapshots stored inside `.mockup` ZIP

### Phase 13: Polish & Extras
**From plan:** Quality-of-life features, visual polish, performance.

- [ ] Device arrangement templates (one-click layouts)
- [ ] Batch export dialog
- [ ] Watermark/branding overlay
- [ ] Dark/light UI theme toggle
- [ ] Custom device frames (upload SVG/PNG)
- [ ] Performance/memory profiling
- [ ] Auto-updater (electron-updater)
- [ ] Error handling polish
- [ ] Keyboard shortcuts panel in Help menu

---

## Priority Order (recommended next session)
1. **Phase 9** — Project Files (.mockup save/load) — enables persistence
2. **Phase 10** — Export Engine — enables output
3. **Phase 8** — Full Shortcuts & Clipboard — improves UX
4. **Phase 7** — Smart Guides — improves precision
5. **Phase 12** — Multi-Scene — enables complex projects
6. **Phase 11** — Color Extraction — nice to have
7. **Phase 13** — Polish — final pass
