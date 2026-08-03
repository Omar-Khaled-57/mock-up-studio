# Folder Structure

Canonical, up-to-date source tree for Mockup Studio v0.3.0. This document is the single source of truth for the repository layout; any folder-structure block in other docs should reference this file rather than duplicate the tree.

```
src/
  main/                    Electron main process (Node)
    index.ts               Window creation, icon, lifecycle, file association, close guard
    menu.ts                Native Electron menu
    ipc-handlers.ts        All IPC handlers (save, open, export, recovery)
    file-system.ts         Recovery, recent projects, ZIP I/O
    auto-updater.ts        Auto-update via GitHub Releases (production only)
  preload/
    index.ts               contextBridge API (window.api) — sandbox-compatible CJS build
  shared/
    types.ts               Core interfaces (Scene, Device, TextBox, ImageOverlay, Shape, Mask, Background, etc.)
  guide/
    content.ts             In-app User Guide content (heading/section/paragraph model)
  renderer/
    App.tsx                Root layout, dirty tracking, menu IPC, file association
    main.tsx               React entry point
    index.html             Renderer HTML shell
    vite-env.d.ts          Vite type references
    styles/
      globals.css          Centralized scrollbars, focus-visible rings, accent CSS vars, reduced-motion rules
    store/                 Zustand document store — 13 slices merged in index.ts
      index.ts             Store composition (all slices spread into one store)
      projectSlice.ts      File path, dirty state, save/open/new
      sceneSlice.ts        Scene CRUD, z-order, grid/guides/masks/groups, safeScene(), element factories
      selectionSlice.ts    Multi-select, select-all, alignment, distribution, focus filter
      historySlice.ts      Undo/redo (JSON snapshots, 500 max)
      viewportSlice.ts     Zoom, pan, fit-to-window
      uiSlice.ts           Sidebar tab, theme, splash, rulers, smart-guides toggle
      exportSlice.ts       Export format, scale, quality, background, scope
      clipboardSlice.ts    Internal copy/cut/paste, copy-paste style
      versionHistorySlice.ts  Auto-snapshots (5min interval, pinned scenes only)
      watermarkSlice.ts    Watermark text and visibility
      shapeSlice.ts        Shape CRUD
      maskSlice.ts         Mask CRUD, reverse, clear-all, refresh snapshot
      effectsSlice.ts      Per-element image effects
      dirtyTracking.ts     attachDirtyTracking + withDirtySuppressed
    runtime/               Zustand runtime store (transient editor state, never serialized)
      runtimeSlice.ts      Runtime state + actions (tools, brush, focus, previews, marquee, editing, contextMenu)
      store.ts             createRuntimeStore, TRANSIENT_RESET / FULL_RESET semantics, full-reset hooks
    tools/                 Tool system
      types.ts             Tool descriptors, InteractionContext, DocumentActions, ToolGroup
      manager.ts           createToolManager, buildContext, cursor resolution, shortcuts, temp tools
      registry.ts          TOOLS registry + isToolReachable
      index.ts             Re-exports
      tools/
        select.ts          Select/move/resize/marquee ownership, context menus, drag-to-nest
        hand.ts            Hand/pan tool
        marquee.ts         Marquee selection tool
        focus.ts           Focus tool (element/group scoping)
        paint.ts           Paint brush tool
        blur.ts            Blur brush tool
        eraser.ts          Eraser tool
        magic-eraser.ts    Magic Eraser tool
        delete.ts          Delete tool
        mask.ts            Mask/unmask tool (brush, rectangle, ellipse)
        destructive.ts     createDestructiveTool factory (shared by blur/eraser/magic-eraser)
    services/              Pure logic (no React, no store imports)
      viewport.ts          screenToScene / sceneToScreen transforms
      hit-test.ts          Scene-geometry hit testing
      geometry.ts          Element geometry, rotated bounds, union, applyLockedSize
      transform.ts         createDragSession / createResizeSession (DOM mutation + commit-on-end)
      snapping.ts          computeSnapForScene (smart guides + grid snap)
      capabilities.ts      Per-kind capability sets + history labels
      focus.ts             Focus scope resolution (subtree, paths, bounds)
      parent-transform.ts  Parent-local coordinate transforms (sceneToLocal / localToScene)
      container-clip.ts    Container shape clip path builder
      container-drop.ts    Drag-to-nest resolver
      selection-chrome.ts  Selection chrome collection + union bounds
      preview.ts           PreviewState builders + drawPreview (ghost / blur indicators)
      stroke.ts            StrokeSampler (typed-array point buffer)
      stroke-host.ts       FastOverlayHost registry (brush preview canvas)
      rasterizer.ts        createRasterSurface, floodFill, blur, erase, compositeStrokeToDataUrl
      paint-layers.ts      Paint layer registry (Paint N naming)
      bitmap-targets.ts    Destructive-stroke target resolution (device screens etc.)
      mask-brush.ts        buildMaskStrokePolygon (capsule brush outline)
      mask-diff.ts         Subtractive unmask resolution (polygon difference)
      mask-visualization.ts  Mask clip paths, dim punches, collectMaskVisuals
      mask-snapshot.ts     Frozen mask whole-scene capture
      polygon-clip.ts      Martinez-style boolean difference engine
      shape-geometry.ts    getShapePath + cross union-outline geometry
      shape-rasterizer.ts  Shape gradient fills (linear/radial/conic) to canvas
    hooks/
      useDebouncedHistory.ts
      useDrag.ts
      useKeyboardShortcuts.ts
      useResize.ts
      useSnapping.ts
      useTheme.ts
      useTripleClick.ts
    lib/
      constants.ts         Background presets, ThemePreset, BACKGROUND_PRESETS
      device-utils.ts      buildTextStyle, resolveThemeColors
      effects.ts           Effects registry + buildEffectsFilter
      element-factories.ts createDefaultDevice/TextBox/Image/Shape
      export-engine.ts     domToCanvas, exportScene, mask punch, multi-scene ZIP export
      project-serialization.ts  .mockup save/load (ZIP + asset walk)
      file-upload.ts       Native file picker helper
      color-extraction.ts  Dominant color extraction
      color-utils.ts       Hex/color helpers
      icons.ts             Lucide icon map
      id.ts                generateId
      multi-drag.ts        Multi-drag follower entries
      brush-presets.ts     Paint brush presets (Paint/Pencil/Airbrush/Marker/Pen/Pixel)
      watermark.ts         Watermark rendering
      save-guard.ts        Unsaved-changes guard
    elements/
      ElementFacade.tsx    Presentational wrapper (data-element-id surface, masks)
      RenameOverlay.tsx    Inline rename input
    components/
      canvas/
        Canvas.tsx             Viewport shell
        CanvasChromeBar.tsx    Scene tabs + zoom + View menu
        CanvasEmptyState.tsx   First-run quick actions
        Scene.tsx              z-sorted render, [data-scene-export] node, container clip wrappers
        ToolEventSurface.tsx   Pointer dispatcher (tool routing, chrome hit resolution)
        OverlayRenderer.tsx    Transient editor chrome (focus, guides, chrome, marquee, hover)
        FocusDim.tsx           Focus scrim + ring
        Grid.tsx               Grid overlay
        Guides.tsx             Snap guides
        Ruler.tsx              Ruler bars + drag-to-create-guide
        StrokeSurface.tsx      Imperative brush preview canvas
        PreviewSurface.tsx     Imperative ghost/blur preview canvas
      devices/
        DeviceFrame.tsx, ScreenContainer.tsx + shell components
        Monitor.tsx, Laptop.tsx, Phone.tsx, Ipad.tsx, Watch.tsx, Browser.tsx, Terminal.tsx
      text/
        InlineEditor.tsx, TextBox.tsx
      images/
        ImageOverlay.tsx
      shapes/
        ShapeRenderer.tsx, ShapeColorControl.tsx
      backgrounds/
        BackgroundRenderer.tsx
        SolidBg.tsx, GradientBg.tsx, AuroraBg.tsx, NeonGridBg.tsx, BlueCyberBg.tsx,
        QPresetBg.tsx, QlessBg.tsx, Storybox3Bg.tsx, DarkSolidBg.tsx
      effects/
        EffectsEditor.tsx
      masks/
        MaskRenderer.tsx, MaskSnapshotLayer.tsx
      primitives/              Design-system primitives (14 components + index.ts)
        Button.tsx, IconButton.tsx, Modal.tsx, Menu.tsx, NumberInput.tsx, SliderInput.tsx,
        SegmentedControl.tsx, AccordionSection.tsx, Badge.tsx, Kbd.tsx, Field.tsx,
        Tooltip.tsx, ChromeStrip.tsx, ResponsiveButtonGroup.tsx, index.ts
      sidebar/
        Sidebar.tsx, BackgroundPanel.tsx, CanvasPresetsPanel.tsx, ThemesPanel.tsx,
        ThemePresetsPanel.tsx, GridPanel.tsx, DevicesPanel.tsx, TextPanel.tsx,
        ImagesPanel.tsx, ShapesPanel.tsx, MasksPanel.tsx, LayersPanel.tsx,
        PropertiesPanel.tsx, SceneTabs.tsx, VersionHistoryPanel.tsx,
        ExportDialog.tsx, LayoutTemplates.tsx
      shared/
        ErrorBoundary.tsx, ResizeHandle.tsx, ResizeHandles.tsx, ContextMenu.tsx,
        ShortcutsModal.tsx, GradientEditor.tsx, ShadowEditor.tsx, GlowEditor.tsx,
        ColorInput.tsx, SliderInput.tsx, ToggleSwitch.tsx, SectionHeader.tsx,
        Checkerboard.tsx, SaveChangesDialog.tsx, UpdateModal.tsx, UserGuide.tsx
      splash/
        SplashScreen.tsx
      toolbar/
        BottomToolbar.tsx, ToolButton.tsx, ToolOptionsPanel.tsx, icons.ts
  __tests__/                  Vitest + Testing Library suites (74 files: 72 test suites + helpers + setup)
    helpers.ts                resetStore, makeDevice/makeTextBox/makeImage/makeShape
    setup.ts                  jest-dom matchers, ImageData polyfill, ResizeObserver stub
    *.test.ts / *.test.tsx    Per-module test suites
docs/
  index.md             Architecture documentation index (ToC for all docs)
  architecture.md      High-level architecture, rendering pipeline, store separation
  engines.md           Rasterizer, export, transform, polygon boolean, paint layers, stroke, preview
  tools.md             Tool manager + tool taxonomy and behavior
  state.md             Zustand store (13 slices), history, serialization, clipboard, runtime store
  components.md        Component hierarchy, facades, overlay renderer, canvas subsystems
  types.md             Core type definitions
  mask-engine.md       Mask system deep-dive
  folder-structure.md  This document
public/
  changelog.json       In-app "What's New" data (versions array)
  logo.png, logo.ico   App icons (multi-size ICO for Windows)
scripts/
  generate-icon.cjs    Sharp-based PNG → ICO converter
dev/                   Planning docs, design docs, v0.3.0 implementation plan (gitignored)
release/               electron-builder output (NSIS + portable installers)
```

## Conventions Worth Knowing

- **`@shared/*` alias** — `tsconfig.web.json` and `tsconfig.node.json` both map `@shared/*` to `src/shared/types.ts`.
- **Two stores** — `renderer/store/` (document state, serialized/snapshotted) and `renderer/runtime/` (transient editor state, never serialized). The runtime store never imports the document store.
- **Element facades** — `elements/ElementFacade.tsx` and every visual component under `components/{devices,text,images,shapes}/` are pure presentational facades with **zero pointer handlers**; all interactions flow through `components/canvas/ToolEventSurface.tsx` → `tools/manager.ts`.
- **Services are pure** — `services/` contains no React and no store imports; tools and components consume them.
- **Export boundary** — `components/canvas/Scene.tsx` owns the `[data-scene-export]` node; all transient chrome lives in `OverlayRenderer.tsx` as a sibling so it can never leak into exports.
