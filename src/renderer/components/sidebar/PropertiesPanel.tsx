import { useCallback, useMemo, useState } from 'react'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import { useTheme } from '../../hooks/useTheme'
import { safeScene } from '../../store/sceneSlice'
import type { Device, TextBox, ImageOverlay, Shape, BlendMode, ShadowLayer, GlowLayer, TextShadow, TextGlow, ShapeKind } from '@shared/types'
import type { AlignmentDirection, DistributeDirection } from '../../store/selectionSlice'
import { applyLockedSize } from '../../services/geometry'
import { isEffectsNeutral } from '../../lib/effects'
import { pickImageFile, pickImageFileObject } from '../../lib/file-upload'
import { QUICK_ADD_DEVICE_TYPES } from '../../lib/element-factories'
import { ICON } from '../../lib/icons'
import { AccordionSection, Button, NumberInput, ResponsiveButtonGroup } from '../primitives'
import SliderInput from '../shared/SliderInput'
import ColorInput from '../shared/ColorInput'
import ShadowEditor from '../shared/ShadowEditor'
import GlowEditor from '../shared/GlowEditor'
import EffectsEditor from '../effects/EffectsEditor'
import ShapeColorControl from '../shapes/ShapeColorControl'
import { useDebouncedHistory } from '../../hooks/useDebouncedHistory'
import {
  Monitor, Type, Image as ImageIcon, Shapes, Eye, EyeOff, Lock, Unlock, Scan, Plus, Users,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalSpaceAround, AlignVerticalSpaceAround, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  ArrowUp, ArrowDown
} from 'lucide-react'

type Kind = 'device' | 'textbox' | 'image' | 'shape'

type SelectedEntry =
  | { kind: 'device'; data: Device }
  | { kind: 'textbox'; data: TextBox }
  | { kind: 'image'; data: ImageOverlay }
  | { kind: 'shape'; data: Shape }

const BLEND_MODES: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion']

const FONT_OPTIONS = ['Inter', 'Arial', 'Georgia', 'Courier New', 'monospace', 'system-ui']

const ALIGN_BUTTONS: { dir: AlignmentDirection; icon: typeof AlignStartVertical; label: string }[] = [
  { dir: 'left', icon: AlignStartVertical, label: 'Align Left' },
  { dir: 'center-x', icon: AlignCenterVertical, label: 'Align Center X' },
  { dir: 'right', icon: AlignEndVertical, label: 'Align Right' },
  { dir: 'top', icon: AlignStartHorizontal, label: 'Align Top' },
  { dir: 'center-y', icon: AlignCenterHorizontal, label: 'Align Center Y' },
  { dir: 'bottom', icon: AlignEndHorizontal, label: 'Align Bottom' }
]

const DISTRIBUTE_BUTTONS: { dir: DistributeDirection; icon: typeof AlignHorizontalSpaceAround; label: string }[] = [
  { dir: 'space-horizontal', icon: AlignHorizontalSpaceAround, label: 'Distribute horizontal space' },
  { dir: 'space-vertical', icon: AlignVerticalSpaceAround, label: 'Distribute vertical space' },
  { dir: 'center-horizontal', icon: AlignHorizontalDistributeCenter, label: 'Distribute horizontal centers' },
  { dir: 'center-vertical', icon: AlignVerticalDistributeCenter, label: 'Distribute vertical centers' }
]

const SHAPE_KINDS: ShapeKind[] = ['rectangle', 'circle', 'ellipse', 'triangle', 'star', 'hexagon', 'diamond', 'parallelogram', 'trapezoid', 'cross', 'plus', 'heart', 'arrow-right']

function toShadowLayers(ts: TextShadow | null): ShadowLayer[] {
  if (!ts) return []
  return [{
    enabled: ts.enabled,
    color: ts.color,
    offsetX: ts.offsetX,
    offsetY: ts.offsetY,
    blur: ts.blur,
    spread: 0,
    opacity: 100,
    inset: false
  }]
}

function fromShadowLayers(layers: ShadowLayer[]): TextShadow | null {
  if (layers.length === 0) return null
  const l = layers[0]
  return { enabled: l.enabled, color: l.color, offsetX: l.offsetX, offsetY: l.offsetY, blur: l.blur }
}

function toGlowLayers(tg: TextGlow | null): GlowLayer[] {
  if (!tg) return []
  return [{
    enabled: tg.enabled,
    color: tg.color,
    blur: tg.blur,
    spread: 0,
    opacity: 100
  }]
}

function fromGlowLayers(layers: GlowLayer[]): TextGlow | null {
  if (layers.length === 0) return null
  const l = layers[0]
  return { enabled: l.enabled, color: l.color, blur: l.blur }
}

function wrapDeg(v: number): number {
  return ((v + 180) % 360 + 360) % 360 - 180
}

function hasEnabled(list: { enabled: boolean }[] | null | undefined): boolean {
  return (list ?? []).some((item) => item.enabled)
}

function KindGlyph({ kind, size = 14 }: { kind: string; size?: number }) {
  const Icon = kind === 'device' ? Monitor : kind === 'textbox' ? Type : kind === 'image' ? ImageIcon : Shapes
  return <Icon size={size} strokeWidth={1.75} className={useTheme().text.secondary} />
}

function EditableName({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const { clsx, text, bg, border } = useTheme()

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onCommit(trimmed)
    else setDraft(value)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          else if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Element name"
        className={clsx('min-w-0 flex-1 px-1.5 py-0.5 text-[13px] font-medium rounded outline-none', bg.input, border.focus)}
      />
    )
  }

  return (
    <span
      title="Double-click to rename"
      onDoubleClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true) }}
      className={clsx('min-w-0 flex-1 text-[13px] font-medium truncate cursor-text', text.primary)}
    >
      {value}
    </span>
  )
}

export default function PropertiesPanel() {
  const selectedIds = useStore((s) => s.selectedIds)
  const updateDevice = useStore((s) => s.updateDevice)
  const updateTextBox = useStore((s) => s.updateTextBox)
  const updateImage = useStore((s) => s.updateImage)
  const updateEffects = useStore((s) => s.updateEffects)
  const resetEffects = useStore((s) => s.resetEffects)
  const copiedStyle = useStore((s) => s.copiedStyle)
  const propertiesPanelWidth = useStore((s) => s.propertiesPanelWidth)
  const propertiesSections = useRuntimeStore((s) => s.propertiesSections)
  const { clsx, bg, text, border, shadow } = useTheme()
  const pushHistoryDebounced = useDebouncedHistory()

  const scene = useStore(safeScene)

  const selected = useMemo<SelectedEntry | null>(() => {
    if (selectedIds.length !== 1) return null
    const id = selectedIds[0]
    const dev = scene.devices.find((d) => d.id === id)
    if (dev) return { kind: 'device' as const, data: dev }
    const tb = scene.textBoxes.find((t) => t.id === id)
    if (tb) return { kind: 'textbox' as const, data: tb }
    const img = scene.images.find((i) => i.id === id)
    if (img) return { kind: 'image' as const, data: img }
    const shape = scene.shapes.find((s) => s.id === id)
    if (shape) return { kind: 'shape' as const, data: shape }
    return null
  }, [selectedIds, scene.devices, scene.textBoxes, scene.images, scene.shapes])

  const multi = useMemo(() => {
    if (selectedIds.length < 2) return null
    const kinds = new Set<Kind>()
    const groupIds = new Set<string>()
    for (const id of selectedIds) {
      const dev = scene.devices.find((d) => d.id === id)
      if (dev) { kinds.add('device'); if (dev.groupId) groupIds.add(dev.groupId); continue }
      const tb = scene.textBoxes.find((t) => t.id === id)
      if (tb) { kinds.add('textbox'); if (tb.groupId) groupIds.add(tb.groupId); continue }
      const img = scene.images.find((i) => i.id === id)
      if (img) { kinds.add('image'); if (img.groupId) groupIds.add(img.groupId); continue }
      const shape = scene.shapes.find((s) => s.id === id)
      if (shape) { kinds.add('shape'); if (shape.groupId) groupIds.add(shape.groupId) }
    }
    return { count: selectedIds.length, kinds: [...kinds], groupIds: [...groupIds] }
  }, [selectedIds, scene.devices, scene.textBoxes, scene.images, scene.shapes])

  const sectionOpen = (key: string, defaultOpen: boolean) => propertiesSections[key] ?? defaultOpen
  const onToggleSection = (key: string) => (open: boolean) => useRuntimeStore.getState().setPropertiesSectionOpen(key, open)

  const patchX = useCallback(
    (v: number) => {
      if (!selected) return
      const { kind, data } = selected
      if (kind === 'device') updateDevice(data.id, { x: v })
      else if (kind === 'textbox') updateTextBox(data.id, { x: v })
      else if (kind === 'shape') useStore.getState().updateShape(data.id, { x: v })
      else updateImage(data.id, { x: v })
    },
    [selected, updateDevice, updateTextBox, updateImage]
  )

  const patchY = useCallback(
    (v: number) => {
      if (!selected) return
      const { kind, data } = selected
      if (kind === 'device') updateDevice(data.id, { y: v })
      else if (kind === 'textbox') updateTextBox(data.id, { y: v })
      else if (kind === 'shape') useStore.getState().updateShape(data.id, { y: v })
      else updateImage(data.id, { y: v })
    },
    [selected, updateDevice, updateTextBox, updateImage]
  )

  const patchW = useCallback(
    (v: number) => {
      if (!selected || v < 20) return
      const { kind, data } = selected
      if (kind === 'device') {
        const s = applyLockedSize(data, { width: v, height: data.height }, data.lockAspectRatio ?? false)
        updateDevice(data.id, { width: Math.round(s.width), height: Math.round(s.height) })
      } else if (kind === 'textbox') {
        updateTextBox(data.id, { width: v })
      } else if (kind === 'shape') {
        const s = applyLockedSize(data, { width: v, height: data.height }, data.lockAspectRatio ?? false)
        useStore.getState().updateShape(data.id, { width: Math.round(s.width), height: Math.round(s.height) })
      } else {
        const s = applyLockedSize(data, { width: v, height: data.height }, data.lockAspectRatio ?? false)
        updateImage(data.id, { width: Math.round(s.width), height: Math.round(s.height) })
      }
    },
    [selected, updateDevice, updateTextBox, updateImage]
  )

  const patchH = useCallback(
    (v: number) => {
      if (!selected || v < 20) return
      const { kind, data } = selected
      if (kind === 'device') {
        const s = applyLockedSize(data, { width: data.width, height: v }, data.lockAspectRatio ?? false)
        updateDevice(data.id, { width: Math.round(s.width), height: Math.round(s.height) })
      } else if (kind === 'textbox') {
        updateTextBox(data.id, { height: v })
      } else if (kind === 'shape') {
        const s = applyLockedSize(data, { width: data.width, height: v }, data.lockAspectRatio ?? false)
        useStore.getState().updateShape(data.id, { width: Math.round(s.width), height: Math.round(s.height) })
      } else {
        const s = applyLockedSize(data, { width: data.width, height: v }, data.lockAspectRatio ?? false)
        updateImage(data.id, { width: Math.round(s.width), height: Math.round(s.height) })
      }
    },
    [selected, updateDevice, updateTextBox, updateImage]
  )

  const patchRotation = useCallback(
    (v: number) => {
      if (!selected) return
      const { kind, data } = selected
      if (kind === 'device') updateDevice(data.id, { rotation: v })
      else if (kind === 'shape') useStore.getState().updateShape(data.id, { rotation: v })
      else if (kind === 'image') updateImage(data.id, { rotation: v })
    },
    [selected, updateDevice, updateImage]
  )

  const commitName = useCallback(
    (name: string) => {
      if (!selected) return
      const { kind, data } = selected
      const state = useStore.getState()
      state.pushHistory('Rename')
      if (kind === 'device') updateDevice(data.id, { name })
      else if (kind === 'textbox') updateTextBox(data.id, { name })
      else if (kind === 'shape') state.updateShape(data.id, { name })
      else updateImage(data.id, { name })
    },
    [selected, updateDevice, updateTextBox, updateImage]
  )

  const handleAddDevice = () => {
    const state = useStore.getState()
    const type = QUICK_ADD_DEVICE_TYPES[Math.floor(Math.random() * QUICK_ADD_DEVICE_TYPES.length)]
    state.addDeviceOfType(type)
  }

  const handleAddText = () => {
    useStore.getState().addDefaultTextBox()
  }

  const handleAddImage = () => {
    pickImageFileObject((file) => {
      void useStore.getState().importImageFromFile(file)
    })
  }

  // ---- Single-selection actions ----
  const toggleVisible = () => {
    if (!selected) return
    const { kind, data } = selected
    const next = !data.visible
    if (kind === 'device') updateDevice(data.id, { visible: next })
    else if (kind === 'textbox') updateTextBox(data.id, { visible: next })
    else if (kind === 'shape') useStore.getState().updateShape(data.id, { visible: next })
    else updateImage(data.id, { visible: next })
  }

  const toggleLock = () => {
    if (!selected) return
    const { kind, data } = selected
    const next = !data.locked
    if (kind === 'device') updateDevice(data.id, { locked: next })
    else if (kind === 'textbox') updateTextBox(data.id, { locked: next })
    else if (kind === 'shape') useStore.getState().updateShape(data.id, { locked: next })
    else updateImage(data.id, { locked: next })
  }

  const uploadScreenshot = (id: string) => {
    pickImageFile((src) => {
      const state = useStore.getState()
      state.pushHistory('Upload screenshot')
      state.updateDevice(id, { screenImage: src })
    })
  }

  const replaceImage = (id: string) => {
    pickImageFile((src) => {
      const state = useStore.getState()
      state.pushHistory('Replace image')
      state.updateImage(id, { src })
    })
  }

  const setShapeBackground = (id: string, src: string | null) => {
    const state = useStore.getState()
    state.pushHistory(src ? 'Set shape background' : 'Remove shape background')
    state.updateShape(id, { backgroundImage: src })
  }

  const handleBringForward = (id: string) => {
    const state = useStore.getState()
    state.pushHistory('Bring forward')
    state.bringForward(id)
  }

  const handleSendBackward = (id: string) => {
    const state = useStore.getState()
    state.pushHistory('Send backward')
    state.sendBackward(id)
  }

  // ---- Multi-selection actions ----
  const handleGroup = () => {
    const state = useStore.getState()
    state.pushHistory('Group')
    state.groupSelected()
  }

  const handleUngroup = (groupId: string) => {
    const state = useStore.getState()
    state.pushHistory('Ungroup')
    state.ungroup(groupId)
  }

  const handleDuplicate = () => {
    const state = useStore.getState()
    state.pushHistory('Duplicate')
    state.duplicateSelected(state.selectedIds)
  }

  const handleDelete = () => {
    const state = useStore.getState()
    state.pushHistory('Delete')
    state.deleteSelected(state.selectedIds)
  }

  // ---- Empty state (nothing selected) ----
  if (!selected && !multi) {
    return (
      <aside
        data-properties-panel
        className={clsx("border-l p-4 flex flex-col pt-[30px] gap-4 overflow-y-auto", bg.panel, border.primary, shadow.sm)}
        style={{ width: propertiesPanelWidth }}
      >
        <div className="flex flex-col items-center text-center gap-2">
          <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center", bg.tertiary)}>
            <Scan size={20} strokeWidth={1.5} className={text.muted} />
          </div>
          <h3 className={clsx("text-[13px] font-medium", text.primary)}>Nothing selected</h3>
          <p className={clsx("text-[11px] leading-relaxed", text.muted)}>
            Select an element on the canvas, or add something new to get started.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Button variant="accent" onClick={handleAddDevice} className="w-full">
            <Plus size={14} /> Add device
          </Button>
          <Button variant="default" onClick={handleAddText} className="w-full">
            <Plus size={14} /> Add text
          </Button>
          <Button variant="default" onClick={handleAddImage} className="w-full">
            <Plus size={14} /> Add image
          </Button>
        </div>
      </aside>
    )
  }

  // ---- Multi selection ----
  if (multi) {
    return (
      <aside
        data-properties-panel
        className={clsx("border-l p-3 flex flex-col gap-1 overflow-y-auto", bg.panel, border.primary, shadow.md)}
        style={{ width: propertiesPanelWidth }}
      >
        <div className="flex items-center gap-2 pb-2">
          <Users size={14} strokeWidth={1.75} className={text.secondary} />
          <span className={clsx("text-[13px] font-medium", text.primary)}>{multi.count} elements selected</span>
        </div>
        <div className="flex flex-wrap gap-1 pb-2">
          {multi.kinds.map((k) => (
            <span
              key={k}
              className={clsx("inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full capitalize", bg.selected, text.secondary)}
            >
              <KindGlyph kind={k} size={11} />
              {k === 'textbox' ? 'Text' : k}
            </span>
          ))}
        </div>

        <AccordionSection
          title="Align"
          data-section="align"
          open={sectionOpen('multi:align', true)}
          onToggle={onToggleSection('multi:align')}
        >
          <div className="grid grid-cols-3 gap-1">
            {ALIGN_BUTTONS.map(({ dir, icon: Icon, label }) => (
              <button
                key={dir}
                onClick={() => useStore.getState().alignSelected(dir)}
                title={label}
                aria-label={label}
                className={clsx("flex items-center justify-center p-1.5 rounded transition-colors", bg.button)}
              >
                <Icon size={14} strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </AccordionSection>

        <AccordionSection
          title="Distribute"
          data-section="distribute"
          open={sectionOpen('multi:distribute', true)}
          onToggle={onToggleSection('multi:distribute')}
        >
          <div className="grid grid-cols-2 gap-1">
            {DISTRIBUTE_BUTTONS.map(({ dir, icon: Icon, label }) => (
              <button
                key={dir}
                onClick={() => useStore.getState().distributeSelected(dir)}
                title={label}
                aria-label={label}
                className={clsx("flex items-center justify-center p-1.5 rounded transition-colors", bg.button)}
              >
                <Icon size={14} strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </AccordionSection>

        <AccordionSection
          title="Arrange"
          data-section="arrange"
          open={sectionOpen('multi:arrange', true)}
          onToggle={onToggleSection('multi:arrange')}
        >
          <ResponsiveButtonGroup gap="md" minChildWidth="72px">
            <Button size="sm" onClick={handleGroup} disabled={multi.count < 2}>Group</Button>
            <Button size="sm" onClick={() => multi.groupIds[0] && handleUngroup(multi.groupIds[0])} disabled={multi.groupIds.length !== 1}>Ungroup</Button>
            <Button size="sm" onClick={handleDuplicate}>Duplicate</Button>
            <Button size="sm" onClick={handleDelete} variant="danger">Delete</Button>
            <Button size="sm" onClick={() => useStore.getState().copyStyleSelected()}>Copy Style</Button>
            <Button size="sm" onClick={() => useStore.getState().pasteStyleToSelected()} disabled={!copiedStyle}>Paste Style</Button>
          </ResponsiveButtonGroup>
        </AccordionSection>
      </aside>
    )
  }

  // ---- Single selection ----
  const { kind, data } = selected!
  const x = data.x
  const y = data.y
  const width = data.width
  const height = data.height
  const rotation = wrapDeg('rotation' in data ? data.rotation : 0)
  const effectsValue = (data as ImageOverlay | Shape).effects
  const effectsNeutral = isEffectsNeutral(effectsValue)

  const aspectLocked = kind !== 'textbox' && 'lockAspectRatio' in data && !!data.lockAspectRatio

  const toggleAspectLock = () => {
    if (!selected || kind === 'textbox') return
    const next = !aspectLocked
    useStore.getState().pushHistory(next ? 'Lock aspect ratio' : 'Unlock aspect ratio')
    if (kind === 'device') updateDevice(data.id, { lockAspectRatio: next })
    else if (kind === 'image') updateImage(data.id, { lockAspectRatio: next })
    else useStore.getState().updateShape(data.id, { lockAspectRatio: next })
  }

  let contentDot = false
  if (kind === 'device') {
    const d = data as Device
    contentDot = !!d.screenImage || d.objectFit !== 'contain' || d.colorTheme !== 'dark'
  } else if (kind === 'textbox') {
    contentDot = (data as TextBox).content.trim().length > 0
  } else if (kind === 'image') {
    contentDot = false
  } else {
    const s = data as Shape
    contentDot = !!s.backgroundImage || s.kind !== 'rectangle'
  }

  let appearanceDot = false
  if (kind === 'image') {
    const img = data as ImageOverlay
    appearanceDot = img.opacity < 100 || img.borderRadius > 0 || img.blur > 0 || img.flipX || img.flipY || hasEnabled(img.shadow) || hasEnabled(img.glow)
  } else if (kind === 'shape') {
    const s = data as Shape
    appearanceDot = s.opacity < 100 || s.blur > 0 || s.cornerRadius > 0 || hasEnabled(s.shadow) || hasEnabled(s.glow)
  } else if (kind === 'textbox') {
    const t = data as TextBox
    appearanceDot = t.backgroundVisible || t.borderVisible || !!t.shadow?.enabled || !!t.glow?.enabled
  }

  const renderAppearance = kind !== 'device'

  return (
    <aside
      data-properties-panel
      className={clsx("border-l p-3 flex flex-col gap-1 overflow-y-auto", bg.panel, border.primary, shadow.md)}
      style={{ width: propertiesPanelWidth }}
    >
      <div className="flex items-center gap-2 py-1 pb-2">
        <KindGlyph kind={kind} />
        <EditableName value={data.name} onCommit={commitName} />
        <button
          onClick={toggleVisible}
          aria-label={data.visible ? 'Hide element' : 'Show element'}
          title={data.visible ? 'Hide' : 'Show'}
          className={clsx("w-6 h-6 flex items-center justify-center rounded transition-colors shrink-0", text.muted)}
        >
          {data.visible ? <Eye size={ICON.micro} /> : <EyeOff size={ICON.micro} />}
        </button>
        <button
          onClick={toggleLock}
          aria-label={data.locked ? 'Unlock element' : 'Lock element'}
          title={data.locked ? 'Unlock' : 'Lock'}
          className={clsx("w-6 h-6 flex items-center justify-center rounded transition-colors shrink-0", text.muted)}
        >
          {data.locked ? <Lock size={ICON.micro} /> : <Unlock size={ICON.micro} />}
        </button>
      </div>

      {/* Transform */}
      <AccordionSection
        title="Transform"
        data-section="transform"
        valueDot={rotation !== 0}
        open={sectionOpen(`${kind}:transform`, true)}
        onToggle={onToggleSection(`${kind}:transform`)}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={clsx("block text-[10px] mb-1", text.secondary)}>X Position</span>
            <NumberInput ariaLabel="X position" value={Math.round(x)} onChange={patchX} />
          </div>
          <div>
            <span className={clsx("block text-[10px] mb-1", text.secondary)}>Y Position</span>
            <NumberInput ariaLabel="Y position" value={Math.round(y)} onChange={patchY} />
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className={clsx("text-[10px]", text.secondary)}>Width</span>
            <span className={clsx("text-[10px]", text.secondary)}>Height</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <NumberInput ariaLabel="Width" value={Math.round(width)} onChange={patchW} />
            </div>
            {kind !== 'textbox' && (
              <button
                onClick={toggleAspectLock}
                aria-label={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                aria-pressed={aspectLocked}
                title={aspectLocked ? 'Aspect ratio locked' : 'Lock aspect ratio'}
                className={clsx(
                  "w-7 h-7 flex items-center justify-center rounded transition-colors shrink-0",
                  aspectLocked ? bg.selected : text.muted
                )}
              >
                {aspectLocked ? <Lock size={ICON.compact} /> : <Unlock size={ICON.compact} />}
              </button>
            )}
            <div className="flex-1 min-w-0">
              <NumberInput ariaLabel="Height" value={Math.round(height)} onChange={patchH} />
            </div>
          </div>
        </div>
        {kind !== 'textbox' && (
          <SliderInput label="Rotation" value={rotation} min={-180} max={180} unit="°" onChange={patchRotation} />
        )}
      </AccordionSection>

      {/* Content */}
      <AccordionSection
        title="Content"
        data-section="content"
        valueDot={contentDot}
        open={sectionOpen(`${kind}:content`, true)}
        onToggle={onToggleSection(`${kind}:content`)}
      >
        {kind === 'device' && (
          <>
            <div>
              <span className={clsx("block text-[11px] mb-1", text.secondary)}>Name</span>
              <input
                value={(data as Device).name}
                onChange={(e) => updateDevice(data.id, { name: e.target.value })}
                className={clsx("w-full px-2 py-1.5 text-[13px] rounded-lg outline-none", bg.input, border.focus)}
              />
            </div>
            <div>
              <span className={clsx("block text-[11px] mb-1", text.secondary)}>Screenshot</span>
              {(data as Device).screenImage ? (
                <div className="space-y-1.5">
                  <div className={clsx("w-full h-14 rounded-lg overflow-hidden", border.secondary)}>
                    <img src={(data as Device).screenImage!} alt="" className="w-full h-full object-cover" />
                  </div>
                  <ResponsiveButtonGroup gap="sm" minChildWidth="72px">
                    <Button size="sm" onClick={() => uploadScreenshot(data.id)}>Replace</Button>
                    <Button size="sm" variant="danger" onClick={() => {
                      const state = useStore.getState()
                      state.pushHistory('Remove screenshot')
                      state.updateDevice(data.id, { screenImage: null })
                    }}>Remove</Button>
                  </ResponsiveButtonGroup>
                </div>
              ) : (
                <Button size="sm" onClick={() => uploadScreenshot(data.id)} className="w-full">Upload Screenshot</Button>
              )}
            </div>
            <div>
              <span className={clsx("block text-[11px] mb-1", text.secondary)}>Object Fit</span>
              <div className="flex gap-1">
                {(['contain', 'cover', 'stretch'] as const).map((fit) => (
                  <button
                    key={fit}
                    onClick={() => updateDevice(data.id, { objectFit: fit })}
                    className={clsx(
                      "flex-1 px-2 py-1 text-xs rounded transition-colors",
                      (data as Device).objectFit === fit ? bg.selected : bg.button
                    )}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={clsx("block text-[11px] mb-1", text.secondary)}>Color Theme</span>
              <div className="grid grid-cols-5 gap-1">
                {(['dark', 'light', 'space-gray', 'midnight', 'custom'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => updateDevice(data.id, { colorTheme: theme })}
                    className={clsx(
                      "px-1 py-1 text-[10px] rounded transition-colors capitalize",
                      (data as Device).colorTheme === theme ? bg.selected : bg.button
                    )}
                  >
                    {theme === 'space-gray' ? 'Space Gray' : theme === 'midnight' ? 'Midnight' : theme}
                  </button>
                ))}
              </div>
            </div>
            {(data as Device).colorTheme === 'custom' && (
              <div className="space-y-1.5">
                <ColorInput label="Bezel" value={(data as Device).customBezelColor ?? '#27272a'} onChange={(c) => updateDevice(data.id, { customBezelColor: c })} />
                <ColorInput label="Border" value={(data as Device).customBorderColor ?? '#09090b'} onChange={(c) => updateDevice(data.id, { customBorderColor: c })} />
              </div>
            )}
          </>
        )}

        {kind === 'textbox' && (
          <>
            <div>
              <span className={clsx("block text-[11px] mb-1", text.secondary)}>Text</span>
              <textarea
                value={(data as TextBox).content}
                onChange={(e) => updateTextBox(data.id, { content: e.target.value })}
                rows={3}
                className={clsx("w-full px-2 py-1.5 text-[13px] rounded-lg outline-none resize-y", bg.input, border.focus)}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className={clsx("block text-[11px] mb-1", text.secondary)}>Font</span>
                <select
                  value={(data as TextBox).fontFamily}
                  onChange={(e) => updateTextBox(data.id, { fontFamily: e.target.value })}
                  className={clsx("w-full px-2 py-1.5 text-[13px] rounded-lg outline-none", bg.input, border.focus)}
                >
                  {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <span className={clsx("block text-[11px] mb-1", text.secondary)}>Size</span>
                <NumberInput ariaLabel="Font size" value={(data as TextBox).fontSize} onChange={(v) => updateTextBox(data.id, { fontSize: v })} min={8} max={400} />
              </div>
            </div>
            <div>
              <span className={clsx("block text-[11px] mb-1", text.secondary)}>Color</span>
              <ColorInput value={(data as TextBox).color} onChange={(c) => updateTextBox(data.id, { color: c })} />
            </div>
          </>
        )}

        {kind === 'image' && (
          <div>
            <span className={clsx("block text-[11px] mb-1", text.secondary)}>Image</span>
            <div className={clsx("w-full h-16 rounded-lg overflow-hidden mb-1.5", border.secondary)}>
              <img src={(data as ImageOverlay).src} alt="" className="w-full h-full object-cover" />
            </div>
            <Button size="sm" onClick={() => replaceImage(data.id)} className="w-full">Replace Image</Button>
          </div>
        )}

        {kind === 'shape' && (
          <>
            <div>
              <span className={clsx("block text-[11px] mb-1", text.secondary)}>Kind</span>
              <select
                value={(data as Shape).kind}
                onChange={(e) => useStore.getState().updateShape(data.id, { kind: e.target.value as ShapeKind })}
                className={clsx("w-full px-2 py-1.5 text-[13px] rounded-lg outline-none", bg.input, border.focus)}
              >
                {SHAPE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <span className={clsx("block text-[11px] mb-1", text.secondary)}>Background Image</span>
              {(data as Shape).backgroundImage ? (
                <div className="space-y-1.5">
                  <div className={clsx("w-full h-14 rounded-lg overflow-hidden", border.secondary)}>
                    <img src={(data as Shape).backgroundImage!} alt="" className="w-full h-full object-cover" />
                  </div>
                    <ResponsiveButtonGroup gap="sm" minChildWidth="72px">
                      <Button size="sm" onClick={() => pickImageFile((src) => setShapeBackground(data.id, src))}>Replace</Button>
                      <Button size="sm" variant="danger" onClick={() => setShapeBackground(data.id, null)}>Remove</Button>
                    </ResponsiveButtonGroup>
                </div>
              ) : (
                <Button size="sm" onClick={() => pickImageFile((src) => setShapeBackground(data.id, src))} className="w-full">Upload Image</Button>
              )}
            </div>
            <div>
              <span className={clsx("block text-[11px] mb-1", text.secondary)}>Fill</span>
              <ShapeColorControl
                shape={data as Shape}
                onChange={(patch) => {
                  useStore.getState().updateShape(data.id, patch)
                  pushHistoryDebounced('Shape fill')
                }}
              />
            </div>
          </>
        )}
      </AccordionSection>

      {/* Appearance */}
      {renderAppearance && (
        <AccordionSection
          title="Appearance"
          data-section="appearance"
          valueDot={appearanceDot}
          open={sectionOpen(`${kind}:appearance`, true)}
          onToggle={onToggleSection(`${kind}:appearance`)}
        >
          {kind === 'image' && (
            <>
              <SliderInput label="Opacity" value={(data as ImageOverlay).opacity} min={0} max={100} unit="%" onChange={(v) => updateImage(data.id, { opacity: v })} />
              <SliderInput label="Radius" value={(data as ImageOverlay).borderRadius} min={0} max={60} unit="px" onChange={(v) => updateImage(data.id, { borderRadius: v })} />
              <div>
                <span className={clsx("block text-[11px] mb-1", text.secondary)}>Blend Mode</span>
                <select
                  value={(data as ImageOverlay).blendMode}
                  onChange={(e) => updateImage(data.id, { blendMode: e.target.value as BlendMode })}
                  className={clsx("w-full px-2 py-1.5 text-[13px] rounded-lg outline-none", bg.input, border.focus)}
                >
                  {BLEND_MODES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <ResponsiveButtonGroup gap="sm" minChildWidth="64px">
                <Button size="sm" variant={(data as ImageOverlay).flipX ? 'accent' : 'default'} onClick={() => updateImage(data.id, { flipX: !(data as ImageOverlay).flipX })}>Flip X</Button>
                <Button size="sm" variant={(data as ImageOverlay).flipY ? 'accent' : 'default'} onClick={() => updateImage(data.id, { flipY: !(data as ImageOverlay).flipY })}>Flip Y</Button>
              </ResponsiveButtonGroup>
              <SliderInput label="Blur" value={(data as ImageOverlay).blur} min={0} max={20} unit="px" onChange={(v) => updateImage(data.id, { blur: v })} />
              <ShadowEditor value={(data as ImageOverlay).shadow} onChange={(shadows) => updateImage(data.id, { shadow: shadows })} />
              <GlowEditor value={(data as ImageOverlay).glow} onChange={(glows) => updateImage(data.id, { glow: glows })} />
            </>
          )}

          {kind === 'shape' && (
            <>
              <SliderInput label="Opacity" value={(data as Shape).opacity} min={0} max={100} unit="%" onChange={(v) => useStore.getState().updateShape(data.id, { opacity: v })} />
              {(data as Shape).kind === 'rectangle' && (
                <SliderInput label="Radius" value={(data as Shape).cornerRadius} min={0} max={60} unit="px" onChange={(v) => useStore.getState().updateShape(data.id, { cornerRadius: v })} />
              )}
              {(data as Shape).kind === 'triangle' && (
                <div className="space-y-1.5">
                  {(['A', 'B', 'C'] as const).map((label, i) => {
                    const angles = (data as Shape).angles ?? [60, 60, 60]
                    const unchangedIdx = (i + 1) % 3
                    const lastIdx = (i + 2) % 3
                    const unchangedVal = angles[unchangedIdx]
                    const maxAllowed = 180 - unchangedVal - 1
                    return (
                      <SliderInput
                        key={label}
                        label={`Angle ${label}`}
                        value={angles[i]}
                        min={1}
                        max={Math.max(maxAllowed, 1)}
                        unit="°"
                        onChange={(v) => {
                          const newAngles: [number, number, number] = [...angles] as [number, number, number]
                          newAngles[i] = v
                          newAngles[lastIdx] = 180 - v - unchangedVal
                          useStore.getState().updateShape(data.id, { angles: newAngles })
                        }}
                      />
                    )
                  })}
                </div>
              )}
              {(data as Shape).kind === 'cross' && (
                <SliderInput label="Arm" value={Math.round(((data as Shape).crossThickness ?? 0.3) * 100)} min={5} max={50} unit="%" onChange={(v) => useStore.getState().updateShape(data.id, { crossThickness: v / 100 })} />
              )}
              {(data as Shape).kind === 'plus' && (
                <SliderInput label="Arm" value={Math.round(((data as Shape).plusThickness ?? 0.3) * 100)} min={10} max={50} unit="%" onChange={(v) => useStore.getState().updateShape(data.id, { plusThickness: v / 100 })} />
              )}
              {(data as Shape).kind === 'arrow-right' && (
                <SliderInput label="Arm" value={Math.round(((data as Shape).arrowThickness ?? 0.5) * 100)} min={10} max={100} unit="%" onChange={(v) => useStore.getState().updateShape(data.id, { arrowThickness: v / 100 })} />
              )}
              <SliderInput label="Blur" value={(data as Shape).blur} min={0} max={20} unit="px" onChange={(v) => useStore.getState().updateShape(data.id, { blur: v })} />
              <ShadowEditor value={(data as Shape).shadow} onChange={(shadows) => useStore.getState().updateShape(data.id, { shadow: shadows })} />
              <GlowEditor value={(data as Shape).glow} onChange={(glows) => useStore.getState().updateShape(data.id, { glow: glows })} />
            </>
          )}

          {kind === 'textbox' && (
            <>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant={(data as TextBox).backgroundVisible ? 'accent' : 'default'} onClick={() => updateTextBox(data.id, { backgroundVisible: !(data as TextBox).backgroundVisible })}>Background</Button>
                {(data as TextBox).backgroundVisible && (
                  <ColorInput value={(data as TextBox).backgroundColor} onChange={(c) => updateTextBox(data.id, { backgroundColor: c })} />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant={(data as TextBox).borderVisible ? 'accent' : 'default'} onClick={() => updateTextBox(data.id, { borderVisible: !(data as TextBox).borderVisible })}>Border</Button>
                {(data as TextBox).borderVisible && (
                  <ColorInput value={(data as TextBox).borderColor} onChange={(c) => updateTextBox(data.id, { borderColor: c })} />
                )}
              </div>
              <SliderInput label="Radius" value={(data as TextBox).borderRadius} min={0} max={60} unit="px" onChange={(v) => updateTextBox(data.id, { borderRadius: v })} />
              <ShadowEditor
                value={toShadowLayers((data as TextBox).shadow)}
                onChange={(shadows) => updateTextBox(data.id, { shadow: fromShadowLayers(shadows) })}
              />
              <GlowEditor
                value={toGlowLayers((data as TextBox).glow)}
                onChange={(glows) => updateTextBox(data.id, { glow: fromGlowLayers(glows) })}
              />
            </>
          )}
        </AccordionSection>
      )}

      {/* Effects */}
      {(kind === 'image' || kind === 'shape') && (
        <AccordionSection
          title="Effects"
          data-section="effects"
          valueDot={!effectsNeutral}
          open={sectionOpen(`${kind}:effects`, !effectsNeutral)}
          onToggle={onToggleSection(`${kind}:effects`)}
        >
          <EffectsEditor
            value={effectsValue}
            onChange={(patch) => updateEffects(data.id, patch)}
            onReset={() => resetEffects(data.id)}
          />
        </AccordionSection>
      )}

      {/* Advanced */}
      <AccordionSection
        title="Advanced"
        data-section="advanced"
        open={sectionOpen(`${kind}:advanced`, false)}
        onToggle={onToggleSection(`${kind}:advanced`)}
      >
        <div>
          <span className={clsx("block text-[11px] mb-1", text.secondary)}>Element ID</span>
          <div className={clsx("px-2 py-1 text-[10px] font-mono rounded-lg truncate", bg.input, text.muted)}>{data.id}</div>
        </div>
        <ResponsiveButtonGroup gap="sm" minChildWidth="100px">
          <Button size="sm" onClick={() => handleBringForward(data.id)}>
            <ArrowUp size={12} /> Bring Forward
          </Button>
          <Button size="sm" onClick={() => handleSendBackward(data.id)}>
            <ArrowDown size={12} /> Send Backward</Button>
        </ResponsiveButtonGroup>
      </AccordionSection>
    </aside>
  )
}
