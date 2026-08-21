import { useEffect, useState, useCallback } from 'react'
import Canvas from './components/canvas/Canvas'
import CanvasChromeBar from './components/canvas/CanvasChromeBar'
import Sidebar from './components/sidebar/Sidebar'
import PropertiesPanel from './components/sidebar/PropertiesPanel'
import SplashScreen from './components/splash/SplashScreen'
import ShortcutsModal from './components/shared/ShortcutsModal'
import ErrorBoundary from './components/shared/ErrorBoundary'
import UpdateModal from './components/shared/UpdateModal'
import AboutDialog from './components/shared/AboutDialog'
import UpdatePromptDialog from './components/shared/UpdatePromptDialog'
import ResizeHandle from './components/shared/ResizeHandle'
import UserGuide from './components/shared/UserGuide'
import type { ChangelogVersion } from './components/shared/UpdateModal'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useStore } from './store'
import { loadProjectFromZipResult } from './lib/project-serialization'
import { resetRuntime, useRuntimeStore } from './runtime/store'
import { withDirtySuppressed } from './store/dirtyTracking'
import { useTheme } from './hooks/useTheme'
import BottomToolbar from './components/toolbar/BottomToolbar'
import ExportDialog from './components/sidebar/ExportDialog'
import SaveChangesDialog from './components/shared/SaveChangesDialog'
import ComponentCreationModal from './components/shared/ComponentCreationModal'
import { withSaveGuard } from './lib/save-guard'

const STORAGE_KEY = 'mockup-studio-last-seen-version'

async function openFileAtPath(filePath: string): Promise<void> {
  try {
    const result = await window.api.openProjectByPath(filePath)
    if (!result) return

    const { project, scenes, activeSceneIndex } = loadProjectFromZipResult(result)

    withDirtySuppressed(() =>
      useStore.setState({
        project: project as unknown as import('@shared/types').Project,
        scenes: scenes as never[],
        activeSceneIndex,
        filePath: result.filePath,
        dirty: false,
        lastSaved: Date.now(),
        undoStack: [],
        redoStack: [],
        selectedIds: [],
        showSplash: false
      })
    )
    resetRuntime('all')
  } catch (err) {
    console.error('[openFileAtPath] Failed to load project:', err)
  }
}

// If the URL has ?guide=1, render just the UserGuide
const isGuideMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('guide') === '1'

export default function App() {
  useKeyboardShortcuts()
  const showSplash = useStore((s) => s.showSplash)
  const saveProject = useStore((s) => s.saveProject)
  const saveProjectAs = useStore((s) => s.saveProjectAs)
  const openProject = useStore((s) => s.openProject)
  const newProject = useStore((s) => s.newProject)
  const theme = useStore((s) => s.theme)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const copySelected = useStore((s) => s.copySelected)
  const cutSelected = useStore((s) => s.cutSelected)
  const pasteClipboard = useStore((s) => s.pasteClipboard)
  const selectAll = useStore((s) => s.selectAll)
  const { clsx, isLight, bg } = useTheme()

  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [updateVersion, setUpdateVersion] = useState<ChangelogVersion | null>(null)
  const downloadProgress = useStore((s) => s.downloadProgress)
  const setDownloadProgress = useStore((s) => s.setDownloadProgress)
  const exportModalOpen = useRuntimeStore((s) => s.exportModalOpen)
  const closeExportModal = useRuntimeStore((s) => s.closeExportModal)
  const focusGroupId = useRuntimeStore((s) => s.focusGroupId)
  const focusElementId = useRuntimeStore((s) => s.focusElementId)
  const exitFocus = useRuntimeStore((s) => s.exitFocus)

  const toggleShortcuts = useCallback(() => setShowShortcuts((v) => !v), [])

  // Check for version update on mount.
  useEffect(() => {
    fetch('./changelog.json')
      .then((r) => r.json())
      .then((data: { versions: ChangelogVersion[] }) => {
        if (!data.versions?.length) return
        const latest = data.versions[0]
        const lastSeen = localStorage.getItem(STORAGE_KEY)
        if (lastSeen !== latest.version) {
          setUpdateVersion(latest)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light')
    window.api?.setNativeTheme?.(theme)
  }, [theme])

  // Load component library on startup
  useEffect(() => {
    useStore.getState().loadFromDisk()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        toggleShortcuts()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleShortcuts])

  const dismissUpdate = useCallback(() => {
    if (updateVersion) {
      localStorage.setItem(STORAGE_KEY, updateVersion.version)
    }
    setUpdateVersion(null)
  }, [updateVersion])

  useEffect(() => {
    if (!window.api?.onMenuAction) return

    const cleanup = window.api.onMenuAction((action: string) => {
      switch (action) {
        case 'save-project':
          saveProject()
          break
        case 'save-project-as':
          saveProjectAs()
          break
        case 'open-project':
          withSaveGuard('opening another project', () => openProject())
          break
        case 'new-project':
          withSaveGuard('creating a new project', () => newProject())
          break
        case 'close-project':
          withSaveGuard('closing this project', () => {
            newProject()
            useStore.setState({ showSplash: true })
          })
          break
        case 'show-shortcuts':
          setShowShortcuts(true)
          break
        case 'undo':
          undo()
          break
        case 'redo':
          redo()
          break
        case 'cut-selected':
          cutSelected()
          break
        case 'copy-selected':
          copySelected()
          break
        case 'paste-clipboard':
          pasteClipboard()
          break
        case 'select-all':
          selectAll()
          break
        case 'open-user-guide':
          window.api?.openUserGuide?.()
          break
        case 'about':
          setShowAbout(true)
          break
        case 'check-for-updates': {
          useRuntimeStore.getState().setUpdatePrompt({ kind: 'checking' })
          window.api?.checkForUpdatesNow?.().then((result) => {
            const rt = useRuntimeStore.getState()
            if (!result.success) {
              rt.setUpdatePrompt({
                kind: 'failed',
                message: result.error ?? 'No release has been published yet. Make sure you are connected to the internet and try again.'
              })
            } else if (rt.updatePrompt?.kind === 'checking') {
              rt.setUpdatePrompt({ kind: 'uptodate' })
            }
          }).catch(() => {
            useRuntimeStore.getState().setUpdatePrompt({
              kind: 'failed',
              message: 'Update check failed. Please try again.'
            })
          })
          break
        }
        case 'export':
          useRuntimeStore.getState().openExportModal()
          break
      }
    })

    return cleanup
  }, [saveProject, saveProjectAs, openProject, newProject, undo, redo, cutSelected, copySelected, pasteClipboard, selectAll])

  useEffect(() => {
    if (!window.api?.onDownloadProgress) return

    const cleanup = window.api.onDownloadProgress((percent: number) => {
      if (percent === 0) {
        setDownloadProgress(0)
      } else if (percent >= 100) {
        setDownloadProgress(null)
      } else {
        setDownloadProgress(percent)
      }
    })

    return cleanup
  }, [setDownloadProgress])

  useEffect(() => {
    if (!window.api?.onUpdatePrompt) return

    const cleanup = window.api.onUpdatePrompt((prompt) => {
      useRuntimeStore.getState().setUpdatePrompt(prompt)
    })

    return cleanup
  }, [])

  useEffect(() => {
    if (!window.api?.onRequestClose) return

    const cleanup = window.api.onRequestClose(() => {
      // Acknowledge immediately so the main-process safety timer is cancelled —
      // we are alive and handling the request (the Save changes? dialog may stay
      // open as long as the user needs). The timer only exists for a renderer
      // that never acks (crash/hang).
      window.api.ackClose()
      const currentDirty = useStore.getState().dirty
      if (!currentDirty) {
        window.api.confirmClose()
        return
      }
      withSaveGuard('closing', () => window.api.confirmClose(), () => window.api.cancelClose())
    })

    return cleanup
  }, [])

  useEffect(() => {
    if (!window.api?.onOpenFile) return

    const cleanup = window.api.onOpenFile(async (filePath: string) => {
      const { dirty } = useStore.getState()
      if (dirty) {
        withSaveGuard('opening another project', () => void openFileAtPath(filePath))
        return
      }
      await openFileAtPath(filePath)
    })

    return cleanup
  }, [])

  if (isGuideMode) {
    return <UserGuide />
  }

  if (showSplash) {
    return <SplashScreen />
  }

  return (
    <ErrorBoundary label="App">
      <div className={`flex h-screen ${isLight ? 'bg-white text-zinc-900' : 'bg-zinc-950 text-zinc-100'}`}>
        <Sidebar />
        <ResizeHandle position="right" onResize={(delta) => {
          const current = useStore.getState().sidebarPanelWidth
          useStore.getState().setSidebarPanelWidth(Math.max(160, Math.min(400, current + delta)))
        }} />
        <ErrorBoundary label="Canvas">
          <div className="flex flex-col flex-1 min-w-0 relative">
            <CanvasChromeBar />
            <Canvas />
            {(focusGroupId || focusElementId) && (
              <button
                type="button"
                data-focus-esc-hint
                aria-label="Exit focus mode"
                onClick={exitFocus}
                className={clsx(
                  "absolute top-10 right-3 z-40 flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-opacity hover:opacity-80",
                  bg.danger
                )}
              >
                Press
                <kbd className="px-1 py-0.5 rounded bg-black/20 text-[10px] font-semibold">Esc</kbd>
                to exit focus
              </button>
            )}
            <BottomToolbar />
          </div>
        </ErrorBoundary>
        <ResizeHandle position="left" onResize={(delta) => {
          const current = useStore.getState().propertiesPanelWidth
          useStore.getState().setPropertiesPanelWidth(Math.max(160, Math.min(400, current - delta)))
        }} />
        <PropertiesPanel />
        {<ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />}
        {updateVersion && <UpdateModal version={updateVersion} onDismiss={dismissUpdate} />}
        <AboutDialog open={showAbout} onClose={() => setShowAbout(false)} />
        <ExportDialog open={exportModalOpen} onClose={closeExportModal} />
        <SaveChangesDialog />
        <ComponentCreationModal />
        <UpdatePromptDialog />
        {downloadProgress !== null && (
          <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-2 bg-zinc-900 border-t border-zinc-700 px-4 py-2 text-xs text-zinc-400">
            <span>Downloading update… {Math.round(downloadProgress)}%</span>
            <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
