# State Management

Mockup Studio uses **two completely separate Zustand stores** with a strict dependency rule:

- **Document store** (`src/renderer/store/index.ts`) — all persisted/serialized state. Composed of 14 merged slices.
- **Runtime store** (`src/renderer/runtime/store.ts`) — transient editor state (tools, previews, focus, gestures). Never serialized.

Document slices import `resetRuntime` from the runtime module — the runtime store must never import from the document store (circular dependency avoidance).

---

## Document Store

### Composition

```typescript
// store/index.ts
export const useStore = create<StoreState>()((...a) => ({
  ...createProjectSlice(...a),
  ...createSceneSlice(...a),
  ...createSelectionSlice(...a),
  ...createHistorySlice(...a),
  ...createViewportSlice(...a),
  ...createUiSlice(...a),
  ...createExportSlice(...a),
  ...createClipboardSlice(...a),
  ...createVersionHistorySlice(...a),
  ...createWatermarkSlice(...a),
  ...createMaskSlice(...a),
  ...createShapeSlice(...a),
  ...createEffectsSlice(...a),
  // dirty tracking
  ...attachDirtyTracking(...),
}))
```

Each slice is a `createXSlice(set, get, api)` function returning a partial state. The `StoreState` type is the intersection of all slice state interfaces.

### Dirty Tracking

```typescript
// store/dirtyTracking.ts
function attachDirtyTracking(subscribe, getState) {
  let prevScenes = getState().scenes
  subscribe(
    (state) => state.scenes,
    (scenes) => {
      if (scenes !== prevScenes) {
        prevScenes = scenes
        useStore.setState({ dirty: true })
      }
    }
  )
}

function withDirtySuppressed<T>(fn: () => T): T {
  let prevDirty: boolean
  return suppressDirty(() => {
    prevDirty = useStore.getState().dirty
    useStore.setState({ dirtySuppressed: true })
    try { return fn() }
    finally {
      useStore.setState({ dirtySuppressed: false, dirty: prevDirty })
    }
  })
}
```

**Contract:** The tracker fires when the `scenes` array **reference** changes — safe because every mutating action is an immutable update. A raw mutation of scene object fields will NOT set dirty. Programmatic loads (open/new/recent) run inside `withDirtySuppressed` so they don't mark a fresh project dirty.

---

## 1. ProjectSlice

**File:** `src/renderer/store/projectSlice.ts`

### State

| Field | Type | Purpose |
|---|---|---|
| `project` | `Project?` | `{ id, name, createdAt, updatedAt, filePath? }` |
| `projectFilePath` | `string \| null` | OS file path for save (null for unsaved) |
| `dirty` | `boolean` | Unsaved-changes flag (set by dirty tracking) |
| `showSplash` | `boolean` | Splash screen visibility |

### Actions

| Action | Behavior |
|---|---|
| `newProject()` | Creates a fresh project, calls `createDefaultScene`, wraps in `withDirtySuppressed` |
| `openProject(manifest, assets, filePath?)` | Hydrates from deserialized manifest, wraps in `withDirtySuppressed` |
| `setProjectInfo(patch)` | Updates name/filePath/timestamps |
| `setDirty(value)` | Direct dirty setter (rare — most goes through tracking) |
| `setShowSplash(value)` | Splash visibility |
| `saveImage(dataUrl, defaultName)` | Triggers `saveImageDialog` IPC |

### Key Decision

`newProject` and `openProject` wrap their entire operation in `withDirtySuppressed` — the new project's `pushHistory('New project')`/`pushHistory('Open project')` must not mark the project dirty (opening an existing file is not "unsaved changes").

---

## 2. SceneSlice

**File:** `src/renderer/store/sceneSlice.ts`

### State

| Field | Type | Purpose |
|---|---|---|
| `scenes` | `Scene[]` | Multi-scene support |
| `activeSceneIndex` | `number` | Current scene index |

### Scene Structure

```typescript
interface Scene {
  id: string
  name: string
  pinned: boolean            // excluded from multi-scene export
  canvas: CanvasSettings     // { width, height, aspectRatio }
  background: Background      // type/color/gradient/image/preset/transparent
  devices: Device[]
  textBoxes: TextBox[]
  images: ImageOverlay[]
  shapes: Shape[]
  guides: Guide[]
  grid: GridSettings
  groups: ElementGroup[]     // flat list with parentGroupId
  masks: Mask[]             // first-class scene masks
}
```

### Key Exported Helpers

| Function | Purpose |
|---|---|
| `safeScene(state)` | Returns active scene, or a fresh default if empty/OOB. The **only** safe scene access. |
| `clampIndex(scenes, index)` | Guards all index writes to `[0, len-1]`. |
| `findAllElements(scene)` | Flattened `[Device | TextBox | ImageOverlay | Shape][]` sorted by zIndex across all 4 kinds. |
| `patchZIndex(scene, id, delta)` | Moves one element in the flat zIndex list. |

### Heroes as First-Class Text Boxes

`createDefaultScene` seeds `textBoxes = [slogan (z0), title (z1)]` (x=60, title y=60 h=72, slogan y=152 h=36, width = `max(320, canvasW * 0.5)`). They are tagged `stylePreset: 'title' | 'slogan'` and render through the standard TextBox facade — they participate in selection/drag/resize/layer/clipboard/z-order like any text box.

### Actions (by Category)

#### Element CRUD (4 kinds × 4 operations)
Each kind has add/update/remove. Updates accept partial patches. All create/update/delete actions do NOT push history — callers push first.

#### Convenience Creators
- `addDeviceOfType(type)` — creates, `pushHistory('Add device')`, selects, returns id.
- `addDefaultTextBox()` — centered "Double-click to edit" box.
- `importImageFromFile(file)` — FileReader → Image → `buildImageOverlay` → pushHistory + select.

#### Z-Order (5 operations)
All use `findAllElements` + `patchZIndex`:
- `bringToFront`, `sendToBack`, `bringForward`, `sendBackward`, `reorderLayer`.

#### Grouping
- `groupSelected()` — requires ≥2 selected; creates group, sets `groupId` on all 4 arrays, `pushHistory('Group')`.
- `ungroup(groupId)` — clears `groupId`, filters groups; **exits focus** if the ungrouped group is the focused one.
- `renameGroup(id, name)`, `duplicateGroup` (deep-clone children with new IDs + offset), `nestGroup(childId, parentId)`, `combineGroups(groupIds)` (merges into the first + sets parent), `makeParentGroup` (wraps selected groups under a new parent), `reverseNesting(groupId)`.
- `addToGroup(groupId, elementId)` — no-op if group missing or element already a member.

#### Guides
- `addGuide(orientation, position)` — `pushHistory('Add guide')` first.
- `moveGuide`, `removeGuide`, `clearGuides`.

#### Grid
- `updateGrid(patch)` — `{ enabled, size, color, opacity, snapEnabled, style }`.

#### Theme
- `applyThemePreset(preset)` — sets background type/color/gradient, recolors hero textBoxes (`titleColor`/`sloganColor`), shapes (`accentColor`), devices (`deviceTheme`).

#### Multi-Scene
- `addScene()`, `duplicateScene`, `deleteScene` (protects last), `renameScene`, `togglePinScene`, `reorderScene`, `deleteScenes`.

### History Contract

Every mutating convenience creator pushes history BEFORE the mutation:
```typescript
addDeviceOfType(type) {
  const device = createDeviceElement(type, scene)
  pushHistory('Add device')          ← BEFORE
  updateDevice(device)                 ← mutation
  select(device.id)
  return device.id
}
```

The raw CRUD actions (`addDevice`, `updateDevice`, etc.) are "dumb" — they only mutate. All history semantics live at the call sites (tools, panels, convenience creators).

### Reset Semantics

`setActiveSceneIndex` calls `resetRuntime()` (transient) to clear stale runtime references to the previous scene's elements (hover, marquee, interaction, preview, editing all reference element IDs that are invalid on a different scene).

---

## 3. SelectionSlice

**File:** `src/renderer/store/selectionSlice.ts`

### State

| Field | Type | Purpose |
|---|---|---|
| `selectedIds` | `string[]` | Currently selected element IDs |
| `selectionMode` | `'single' \| 'multi'` | Derived from count (reactive) |

### Actions

| Action | Behavior |
|---|---|
| `select(id, multi?, filter?)` | **Group-aware**: if `id` belongs to a group, selects all group `childIds`. Multi-mode toggles (Ctrl+click adds/removes the group). `filter` (defaults to `NOOP_FOCUS_FILTER`) gates by focus scope. Returns `targetIds` (the actual IDs that were selected). Updates `selectionMode`. `pushHistory` at call site. |
| `selectDirect(id)` | Selects only the given element (no group expansion). |
| `deselect(id)` | Removes one id. |
| `clearSelection()` | Empties array. |
| `selectAll(filter?)` | Selects every element across all 4 kinds, filtered. `pushHistory` at call site. |
| `isSelected(id)` | Reactive getter. |
| `selectInRect(x, y, w, h, filter?)` | Marquee selection across all 4 kinds. Handles negative w/h (normalizes internally). `pushHistory` at call site. |
| `bringForward(ids)`, `sendBackward(ids)` | Z-order within selection. |
| `alignSelected(direction)` | `left`/`center-x`/`right`/`top`/`center-y`/`bottom`. Computes bounding box of selected elements, moves each to the appropriate edge/center. `pushHistory('Align')` before. Requires ≥2 selected. |
| `distributeSelected(direction)` | `space-horizontal`/`space-vertical`/`center-horizontal`/`center-vertical`. Space variants pin outer elements and equalize gaps. Center variants equalize center-to-center spacing. Requires ≥3 selected. `pushHistory('Distribute')` before. |

### `select` Group-Aware Algorithm

```
function select(id, multi, filter):
  // Resolve group membership
  const element = findSceneElement(scene, id)
  if (element?.groupId):
    const group = scene.groups.find(g => g.id === element.groupId)
    targetIds = group?.childIds ?? [id]   // the whole group
  else:
    targetIds = [id]

  // Apply focus filter
  targetIds = targetIds.filter(filter)
  if (targetIds.length === 0): return []

  if (multi):
    selectedIds = toggle selectedIds against targetIds
  else:
    selectedIds = targetIds

  selectionMode = selectedIds.length > 1 ? 'multi' : 'single'
  return targetIds
```

### `distributeSelected` Algorithm

```
function distributeSelected(ids, direction):
  elements = findAllElements(scene).filter(e => ids.includes(e.id))
  sorted = sortBy(elements, axis(direction))
  
  if direction is 'space-*':
    // Pin outer elements, equalize gaps
    gap = (lastPos - firstPos - sum(widths)) / (count - 1)
    distribute middle elements at equal intervals
    
  if direction is 'center-*':
    // Equalize center-to-center spacing
    center = (maxCenter + minCenter) / 2  // for center-horizontal
    spacing = (maxCenter - minCenter) / (count - 1)
    place each element's center at even intervals
```

---

## 4. HistorySlice

**File:** `src/renderer/store/historySlice.ts`

### State

| Field | Type |
|---|---|
| `historyUndoStack` | `HistoryEntry[]` |
| `historyRedoStack` | `HistoryEntry[]` |
| `MAX_HISTORY` | `500` (constant) |

### HistoryEntry

```typescript
interface HistoryEntry {
  scenesSnapshot: string    // JSON-serialized Scene[] (pre-serialized for memory)
  timestamp: number
  label?: string
}
```

**Critical optimization:** Snapshots are stored as **JSON strings**, not parsed objects. This reduces memory pressure (the string is interned) and avoids deep-cloning on push. Undo/redo do `JSON.parse` lazily.

### Actions

| Action | Behavior |
|---|---|
| `pushHistory(label?)` | `JSON.stringify(state.scenes)` → push to undoStack, clear redoStack, cap at 500 (shift oldest). Triggers `maybeAutoSnapshot()` via `setTimeout(0)`. |
| `undo()` | Pops undoStack, pushes current `JSON.stringify(scenes)` to redoStack, `JSON.parse` restores scenes, clamps `activeSceneIndex`, calls `resetRuntime()` (transient). |
| `redo()` | Mirror of undo. |
| `canUndo()` / `canRedo()` | Reactive selectors (for toolbar buttons). |

### `maybeAutoSnapshot`

Called from the version history slice — creates a checkpoint snapshot every N actions or T seconds, stored in `versionHistorySnapshots`. Only fires when the active scene is pinned (user wants version history for that scene).

### History Contract (Universal)

```
1. Caller: pushHistory('Label')    ← BEFORE any mutation
2. Caller: storeAction(...)         ← immutable update of scenes
3. Zustand: re-render affected components
4. On undo: parse snapshot → set scenes → clamp index → resetRuntime('transient')
```

Every tool, every panel action, every slice convenience creator follows this. The slice itself is "dumb" — it doesn't push history. This makes the call sites explicit and debuggable.

---

## 5. ClipboardSlice

**File:** `src/renderer/store/clipboardSlice.ts`

### State

| Field | Type |
|---|---|
| `clipboard` | `ClipboardEntry[]` |
| `clipboardMode` | `'copy' \| 'cut' \| null` |
| `copiedStyle` | `CopiedStyle \| null` |

### Types

```typescript
interface ClipboardEntry {
  id: string                    // original element id (for reference)
  kind: ElementKind             // 'device' | 'textbox' | 'image' | 'shape'
  data: Device | TextBox | ImageOverlay | Shape  // deep clone of element
  masks: Mask[]                // masks targeting this element (cloned)
}

interface CopiedStyle {
  kind: ElementKind4            // 'device' | 'textbox' | 'image' | 'shape'
  patch: Partial<Device | TextBox | ImageOverlay | Shape>  // appearance-only fields
}
```

### Actions

| Action | Behavior |
|---|---|
| `copySelected()` | Deep-clones selected elements into clipboard entries. Includes their masks (cloned, targetId preserved for re-targeting on paste). Sets `clipboardMode: 'copy'`. |
| `cutSelected()` | Same as copy, then `pushHistory('Cut')` BEFORE `deleteSelected(ids)`, sets `clipboardMode: 'cut'`. |
| `pasteClipboard()` | Deep-clones clipboard entries with +30px offset, new IDs (via `generateId`), maxZ+1. **ID remapping**: assigns new IDs up front, then remaps `containerId` and `groupId` via `idMap`. Re-adds masks with new IDs + re-targeted `targetId`. `pushHistory('Paste')` before mutation. Auto-selects pasted elements. If `clipboardMode === 'cut'`, clears clipboard + mode. Returns new IDs. |
| `copyStyleSelected()` | Snapshots appearance-only fields from the first selected element via `pickStyle` + `styleFieldsFor(kind)`. |
| `pasteStyleToSelected()` | Applies `copiedStyle` to every selected element of the **same kind**. `pushHistory('Paste style')` before. Cross-kind targets silently skipped. |

### ID Remapping on Paste (critical for container/group integrity)

```
function pasteClipboard():
  entries = clipboard.map(clone)                 // deep clone
  
  // Assign new IDs up front
  idMap = new Map()                               // old → new
  for entry in entries:
    newId = generateId()
    idMap.set(entry.id, newId)    ← key step
    entry.data.id = newId
  
  // Remap references that survive the clone
  for entry in entries:
    if entry.data.containerId in idMap:
      entry.data.containerId = idMap[entry.data.containerId]   ← child re-targets pasted container
    if entry.data.groupId:
      entry.data.groupId = idMap.get(entry.data.groupId) ?? entry.data.groupId  ← group ref
    
    // Re-target masks
    for mask in entry.masks:
      mask.id = generateId()
      mask.targetId = newId                         ← mask follows its element
  
  pushHistory('Paste')
  addDevices/TextBoxes/Images/Shapes(newEntries)
  select(newIds)
```

### Style Fields Per Kind

| Kind | Appearance-only fields |
|---|---|
| **Device** | colorTheme, customBezelColor, customBorderColor, objectFit |
| **TextBox** | fontSize, fontFamily, fontWeight, textAlign, lineHeight, letterSpacing, wordSpacing, textTransform, strokeColor, strokeWidth, color, gradient, glow, shadow, backgroundVisible, backgroundColor, borderVisible, borderColor, borderRadius |
| **Image** | opacity, borderRadius, blendMode, flipX, flipY, blur, glow, shadow |
| **Shape** | color, gradient, opacity, blur, glow, shadow, cornerRadius, backgroundImage, angles, crossThickness, plusThickness, arrowThickness |

**Deliberately excluded**: x/y/width/height (transform), name, content, src, zIndex, locked, visible, groupId, containerId (relationships, not appearance).

---

## 6. EffectsSlice

**File:** `src/renderer/store/effectsSlice.ts`

### State

**None.** Effects state lives on the element itself (`ImageOverlay.effects` / `Shape.effects` as `ImageEffects | undefined`).

### Actions

| Action | Behavior |
|---|---|
| `updateEffects(elementId, patch)` | Finds element in `images[]` then `shapes[]`, merges `{ ...DEFAULT_EFFECTS, ...existing, ...patch }` onto `element.effects`. |
| `resetEffects(elementId)` | Sets `element.effects = undefined` (neutral again). |

### ImageEffects Structure

| Field | Range | Neutral |
|---|---|---|
| `brightness` | 0–200 | 100 |
| `contrast` | 0–200 | 100 |
| `exposure` | 0–200 | 100 |
| `saturation` | 0–200 | 100 |
| `hue` | −180..180 | 0 |
| `gamma` | 50–200 | 100 |
| `temperature` | −100..100 | 0 |
| `tint` | −100..100 | 0 |
| `blur` | 0–30px | 0 |

### `buildEffectsFilter(effects)` (`lib/effects.ts`)

Iterates the `EFFECTS_REGISTRY` (9 entries), skipping neutral values, joining non-empty terms:
- `brightness`, `contrast`, `exposure`, `saturation` → `brightness(N%)`, `contrast(N%)`, etc.
- `hue` → `hue-rotate(Ndeg)`.
- `gamma` → `brightness(G) contrast(2-G)` (decomposition).
- `temperature`/`tint` → sepia + hue-rotate composition.
- `blur` → `blur(Npx)`.

Returns empty string when all neutral (or when `effects` is `null`/`undefined`). Applied as CSS `filter` on the element facade.

---

## 7. MaskSlice

**File:** `src/renderer/store/maskSlice.ts`

### State

**None.** Masks live in `Scene.masks[]`.

### Actions

| Action | Behavior |
|---|---|
| `addMask(mask)` | Appends a fully-formed mask to `Scene.masks[]`. |
| `updateMask(maskId, patch)` | Merges patch into mask by id. |
| `removeMask(maskId)` | Deletes mask by id. |
| `maskElement(elementId, geometry)` | Creates a full-bounds rectangle mask targeting the element. `pushHistory('Add mask')` at call site. |
| `removeMaskFromElement(elementId)` | Removes every mask targeting an element. `pushHistory('Remove mask')` at call site. |
| `reverseMask(maskId)` | Toggles `inverted` flag. `pushHistory('Reverse mask')` at call site. |
| `replaceTargetMasks(targetId, masks)` | Replaces every mask targeting an element with a fresh list (atomic). The commit boundary for subtractive unmask — `resolveUnmaskCommit` returns a new mask list, this action swaps it in. |
| `clearAllMasks()` | Empties the entire scene's masks array (all targets, including the `BACKGROUND_MASK_TARGET_ID` sentinel). Recovery path for stale masks. |
| `refreshMaskSnapshot(maskId)` | Async — finds mask + target, calls `captureMaskSnapshot`, `pushHistory('Refresh mask')` before, updates mask with snapshot. No-ops (no history) on missing mask/target or failed capture. |

### Full Reset Hook

Registered via `useStore.getState().effects`... no — via the runtime store's `registerFullResetHook` — `maskSlice` doesn't need reset hooks since masks live on the scene (which is replaced on project load). `clearAllMasks` is called on scene switch to prevent masks from the previous scene appearing on the new canvas.

Wait — actually, masks are part of `Scene.masks[]`, so they're replaced wholesale when the scene changes. No special reset needed. `clearAllMasks` is only for the PropertiesPanel/Toolbar "Clear masks" action.

---

## 8. VersionHistorySlice

**File:** `src/renderer/store/versionHistorySlice.ts`

### State

| Field | Type |
|---|---|
| `versionHistory: VersionSnapshot[]` | Auto-checkpointed snapshots |
| `versionHistoryEnabled` | `boolean` (default true) |

### VersionSnapshot

```typescript
interface VersionSnapshot {
  id: string
  label: string              // human-readable, e.g. "Add device"
  timestamp: number
  scenesSnapshot: string     // JSON (same format as history)
  canvasWidth: number
  canvasHeight: number
}
```

### Actions

| Action | Behavior |
|---|---|
| `maybeAutoSnapshot(label)` | Creates a checkpoint if conditions met (scene is pinned + enough actions/time elapsed since last). Called from `pushHistory` via `setTimeout(0)`. |
| `createSnapshot(label)` | Explicit user save. |
| `restoreSnapshot(id)` | Deep-restores scenes from snapshot, `pushHistory('Restore snapshot')` before. |
| `deleteSnapshot(id)` | Removes from array. |
| `clearSnapshots()` | Empties array. |

### Auto-Snapshot Policy

Only snapshots when the active scene is **pinned** (`scene.pinned === true`) — the user has explicitly opted into version history for that scene. Threshold: 5 actions or 2 minutes since the last snapshot.

---

## 9. Runtime Store

**File:** `src/renderer/runtime/store.ts`

### Architecture

A **completely separate Zustand store** — `useRuntimeStore`. The document store imports `resetRuntime` from this module; the runtime store imports nothing from the document store. All 14 document slices share a single `resetRuntime` import.

```typescript
// runtime/store.ts
export const useRuntimeStore = create<RuntimeState & RuntimeSlice>()(
  (set, get, api) => ({
    ...createRuntimeSlice(set, get, api),
  })
)
```

### Full State Fields (22)

| Field | Type | Default | Reset (transient) | Reset (all) |
|---|---|---|---|---|
| `activeToolId` | `string` | `'select'` | kept | `'select'` |
| `temporaryToolStack` | `TempEntry[]` | `[]` | cleared | cleared |
| `hoveredElement` | `{id,kind} \| null` | `null` | cleared | cleared |
| `pointerScenePos` | `{x,y} \| null` | `null` | cleared | cleared |
| `pointerInCanvas` | `boolean` | `false` | cleared | cleared |
| `activeInteraction` | `InteractionDesc \| null` | `null` | cleared | cleared |
| `marqueeRect` | `Rect \| null` | `null` | cleared | cleared |
| `strokeBuffer` | `StrokePoint[]` | `[]` | cleared | cleared |
| `strokeDirty` | `boolean` | `false` | cleared | cleared |
| `brush` | `BrushOptions` | defaults | **kept** | **reset to defaults** |
| `temporaryTransform` | `TempTransform \| null` | `null` | cleared | cleared |
| `focusGroupId` | `string \| null` | `null` | **kept** | cleared |
| `focusElementId` | `string \| null` | `null` | **kept** | cleared |
| `snapGuides` | `{vertical:,horizontal:}` | `{[],[]}` | cleared | cleared |
| `containerDropTarget` | `string \| null` | `null` | cleared | cleared |
| `preview` | `PreviewState \| null` | `null` | cleared | cleared |
| `maskPreview` | `MaskPreviewState \| null` | `null` | cleared | cleared |
| `maskShape` | `MaskPreviewShape` | `'rectangle'` | **kept** | `'rectangle'` |
| `maskMode` | `MaskMode` | `'mask'` | **kept** | `'mask'` |
| `editing` | `EditingTarget \| null` | `null` | cleared | cleared |
| `contextMenu` | `RuntimeContextMenu \| null` | `null` | cleared | cleared |
| `propertiesSections` | `Record<string,boolean>` | `{}` | **kept** | `{}` |
| `exportModalOpen` | `boolean` | `false` | kept | `false` |
| `canvasEmptyStateDismissed` | `boolean` | `false` | kept | `false` |
| `toolbarToolsVisible` | `boolean` | `true` | kept | `true` |

### Reset Payloads

```typescript
// TRANSIENT_RESET — runs on undo/redo, scene switch, multi-scene export iteration
{
  hoveredElement: null,
  pointerScenePos: null,
  pointerInCanvas: false,
  activeInteraction: null,
  marqueeRect: null,
  strokeBuffer: [],
  strokeDirty: false,
  temporaryTransform: null,
  snapGuides: { verticalGuides: [], horizontalGuides: [] },
  containerDropTarget: null,
  preview: null,
  maskPreview: null,
  editing: null,
  contextMenu: null,
  // PRESERVED: activeToolId, temporaryToolStack, brush, focusGroupId,
  //   focusElementId, maskShape, maskMode, propertiesSections,
  //   exportModalOpen, canvasEmptyStateDismissed, toolbarToolsVisible
}

// FULL_RESET — runs on project new/open
{
  ...TRANSIENT_RESET,
  activeToolId: DEFAULT_TOOL_ID,
  temporaryToolStack: [],
  brush: DEFAULT_BRUSH_OPTIONS,
  focusGroupId: null,
  focusElementId: null,
  maskShape: 'rectangle',
  maskMode: 'mask',
  propertiesSections: {},
  exportModalOpen: false,
  canvasEmptyStateDismissed: false,
  toolbarToolsVisible: true,
}
```

### `resetRuntime` Implementation

```typescript
export function resetRuntime(scope: 'transient' | 'all' = 'all') {
  if (scope === 'transient') {
    useRuntimeStore.setState(TRANSIENT_RESET, false)  // shallow merge, no replace
  } else {
    useRuntimeStore.setState(FULL_RESET, false)
    fullResetHooks.forEach(hook => hook())            // toolManager.reset(), etc.
  }
}
```

### Full-Reset Hooks

```typescript
const fullResetHooks: (() => void)[] = []

export function registerFullResetHook(fn: () => void) {
  fullResetHooks.push(fn)
  return () => {
    const idx = fullResetHooks.indexOf(fn)
    if (idx >= 0) fullResetHooks.splice(idx, 1)
  }
}
```

Registered by:
- **ToolManager** — `toolManager.reset()` (restores default tool, clears temp stack + ownership, interrupts all pending sessions).
- **ToolEventSurface** — clears `hoveredElement`.
- **Keyboard shortcuts** — resets modifier state.

### Why Transient Reset Preserves Tools/Focus

- `activeToolId` stays — the user's tool selection persists across undo/redo and scene switches.
- `focusGroupId` stays — focus mode persists (the user is still scoped to the same group).
- `brush` stays — current brush settings don't reset on undo.
- `maskShape`/`maskMode` stay — mask tool settings persist.

This is deliberate UX: undoing a brush stroke shouldn't switch you to the Select tool.

---

## Serialization

**File:** `src/renderer/lib/project-serialization.ts`

### Format: `.mockup` (ZIP archive)

```
mockup-project.mockup (ZIP)
├── manifest.json     — full project state with asset:// references
└── assets/
    ├── img-1.png     — extracted data URL content
    ├── img-2.jpg
    └── ...
```

### Serialization Flow (`serializeProject`)

1. Takes `projectData` (the root project object), `scenes[]`, `activeSceneIndex`.
2. Walks all scenes, finds all `data:` URLs in:
   - `device.screenImage`
   - `images[].src`
   - `shapes[].backgroundImage`
   - `background.image.src` (background image type)
   - `mask.snapshot.dataUrl` (frozen masks)
   - `versionHistory[].scenesSnapshot` (nested! re-serialized recursively)
3. For each data URL: decode base64 → binary buffer → assign sequential filename (`img-1.png`).
4. Replace data URL with `asset://<filename>` reference.
5. Return `{ manifest: JSON string, assets: Map<name, Uint8Array> }`.

### Deserialization Flow (`deserializeProject`)

1. Parse `manifest.json`.
2. For each `asset://` reference in the deserialized tree, look up the binary buffer, convert back to base64 data URL via `resolveAssetRef`.
3. Apply legacy migrations:
   - `titleText`/`sloganText` → `textBoxes[]` with `stylePreset: 'title' | 'slogan'` (one-way; legacy keys deleted).
   - Shape `shadow`/`glow` single-object → array format.
   - `masks` defaults to `[]` if absent.
4. Return parsed project state.

### Asset Extraction Utilities

| Function | Purpose |
|---|---|
| `bytesToBase64(bytes)` | Web-API-based (no Node Buffer — sandboxed renderer) |
| `base64ToBytes(b64)` | Reverse |
| `parseDataUrl(dataUrl)` | Regex parse `data:mime;base64,...` → `{mime, buffer}` |
| `replaceDataUrlWithRef(dataUrl, assets, ref)` | Stores binary, returns `asset://` ref |
| `resolveAssetRef(ref, assets)` | `asset://name` → `data:mime;base64,...` |

---

## Cross-Cutting State Contracts

### History Contract (Universal)

```
pushHistory(label)     ← BEFORE mutation, always
store.mutate(state)    ← immutable update
react re-render        ← via store subscription
```

Every tool, panel action, and slice convenience creator pushes history before mutating. The raw CRUD slice methods (`addDevice`, `updateShape`, etc.) do NOT push — they're "dumb" mutators called after the history push.

### Focus Scope Contract

Every editing tool checks `ctx.focusEditable(id)` at pointer-down:
```
if ((focusGroupId || focusElementId) && !isInFocusScope(id, ...)) {
  clearSelection()
  return    // dimmed = no interaction
}
```

Focus scope = focused group's subtree (all descendant groups' children) OR a focused container's children. Empty = everything is in scope (no focus mode).

### Dirty Tracking Contract

- Set true when `scenes` array reference changes (immutable update).
- Suppressed during `openProject`/`newProject` via `withDirtySuppressed`.
- Read by `App.tsx` for the window-close guard and menu actions.
- `saveProject` clears dirty after successful write.

### Serialization Contract

- `lockAspectRatio`, `wrap`, `effects`, `containerId`, `transparent`, `focusGroupId`, `masks[].holes`, `masks[].snapshot` are all **optional** fields that round-trip cleanly via spread — no hydration/migration logic.
- Legacy `.mockup` files load with absent fields → defaults via `??` operator.
- Assets are extracted from data URLs and stored as binary in the ZIP; on load they're reconstructed as data URLs.
- The manifest is `JSON.stringify(projects, null, 2)` — human-readable.

### Multi-Scene Contract

- Each scene is fully independent (its own elements, guides, grid, groups, masks).
- `setActiveSceneIndex` triggers `resetRuntime('transient')` (clear stale references) + `maybeAutoSnapshot`.
- Multi-scene export: iterates scenes with double-rAF waits between captures, restores the original index in `finally`.
- Pinned scenes are excluded from multi-scene export (user's explicit choice).
