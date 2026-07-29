/**
 * Test helper — provides a clean Zustand store for each test.
 * Resets all slices to their initial state.
 */
import { useStore } from '../renderer/store'
import { createDefaultScene } from '../renderer/store/sceneSlice'

/** Resets the entire store to a fresh default state. */
export function resetStore(): void {
  const defaultScene = createDefaultScene()
  useStore.setState({
    // Project
    project: null,
    filePath: null,
    dirty: false,
    lastSaved: null,
    // Scene
    scenes: [defaultScene],
    activeSceneIndex: 0,
    // Selection
    selectedIds: [],
    selectionMode: 'single',
    // History
    undoStack: [],
    redoStack: [],
    // Viewport
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    // UI
    sidebarTab: 'devices',
    sidebarCollapsed: false,
    propertiesPanelOpen: false,
    showSplash: true,
    theme: 'dark',
    showRulers: false,
    sidebarPanelWidth: 224,
    propertiesPanelWidth: 208,
    // Export
    exportFormat: 'png',
    exportScale: 2,
    exportQuality: 90,
    exportBackground: 'scene',
    exportBackgroundColor: '#ffffff',
    // Clipboard
    clipboard: [],
    clipboardMode: null,
    // Version history
    snapshots: [],
    autoSnapshotEnabled: false, // disabled for tests
    lastSnapshotTime: Date.now(),
    // Watermark
    watermark: {
      enabled: false,
      text: 'Mockup Studio',
      fontSize: 14,
      color: '#ffffff',
      opacity: 30,
      position: 'bottom-right' as const
    }
  })
}

/** Returns a minimal device object for testing. */
export function makeDevice(overrides?: Partial<import('@shared/types').Device>): import('@shared/types').Device {
  return {
    id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'monitor',
    name: 'Test Monitor',
    visible: true,
    locked: false,
    x: 100,
    y: 100,
    width: 600,
    height: 400,
    rotation: 0,
    zIndex: 0,
    colorTheme: 'dark',
    screenImage: null,
    objectFit: 'contain',
    groupId: null,
    ...overrides
  }
}

/** Returns a minimal text box for testing. */
export function makeTextBox(overrides?: Partial<import('@shared/types').TextBox>): import('@shared/types').TextBox {
  return {
    id: `tb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Text',
    content: 'Hello',
    x: 50,
    y: 50,
    width: 200,
    height: 60,
    heightAuto: true,
    fontSize: 24,
    fontFamily: 'Inter',
    fontWeight: 400,
    textAlign: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    wordSpacing: 0,
    textTransform: 'none',
    strokeColor: '#ffffff',
    strokeWidth: 0,
    color: '#ffffff',
    gradient: null,
    glow: null,
    shadow: null,
    visible: true,
    backgroundVisible: false,
    backgroundColor: 'transparent',
    borderVisible: false,
    borderColor: '#ffffff',
    borderRadius: 0,
    stylePreset: 'custom',
    zIndex: 1,
    locked: false,
    groupId: null,
    ...overrides
  }
}

/** Returns a minimal shape for testing. */
export function makeShape(overrides?: Partial<import('@shared/types').Shape>): import('@shared/types').Shape {
  return {
    id: `shp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'rectangle',
    name: 'Test Shape',
    x: 200,
    y: 200,
    width: 120,
    height: 120,
    rotation: 0,
    opacity: 100,
    color: '#6366f1',
    gradient: null,
    blur: 0,
    glow: [],
    shadow: [],
    zIndex: 3,
    locked: false,
    visible: true,
    cornerRadius: 0,
    backgroundImage: null,
    angles: [60, 60, 60],
    crossThickness: 0.3,
    plusThickness: 0.3,
    arrowThickness: 0.5,
    groupId: null,
    ...overrides
  }
}

/** Returns a minimal image overlay for testing. */
export function makeImage(overrides?: Partial<import('@shared/types').ImageOverlay>): import('@shared/types').ImageOverlay {
  return {
    id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Image',
    src: 'data:image/png;base64,abc',
    x: 150,
    y: 150,
    width: 300,
    height: 200,
    rotation: 0,
    opacity: 100,
    borderRadius: 0,
    blendMode: 'normal',
    flipX: false,
    flipY: false,
    blur: 0,
    glow: [],
    shadow: [],
    zIndex: 2,
    locked: false,
    visible: true,
    groupId: null,
    ...overrides
  }
}
