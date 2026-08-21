import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { useTheme } from '../../hooks/useTheme'
import { loadProjectFromZipResult } from '../../lib/project-serialization'
import { withDirtySuppressed } from '../../store/dirtyTracking'
import splashLogo from '../../assets/splash-logo.png'

interface RecentEntry {
  path: string
  name: string
  lastOpened: number
  thumbnailPath: string
}

export default function SplashScreen() {
  const { isLight, clsx, text, accent } = useTheme()
  const [recentProjects, setRecentProjects] = useState<RecentEntry[]>([])

  useEffect(() => {
    if (window.api) {
      window.api.getRecentProjects().then(setRecentProjects).catch(() => setRecentProjects([]))
    }
  }, [])

  const applyProject = async (result: { manifest: string; assetsJson: string; filePath: string }) => {
    try {
      const { project, scenes, activeSceneIndex } = loadProjectFromZipResult(result)

      withDirtySuppressed(() =>
        useStore.setState({
          project: {
            ...project,
            scenes: scenes as never[]
          },
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
    } catch (err) {
      console.error('[SplashScreen] Failed to load project:', err)
    }
  }

  const handleNew = () => {
    useStore.getState().newProject()
    useStore.setState({ showSplash: false })
  }

  const handleOpen = async () => {
    const result = await window.api?.openProject()
    if (result) {
      await applyProject(result)
    }
  }

  const handleOpenRecent = async (path: string) => {
    if (!window.api) return
    const result = await window.api.openProjectByPath(path)
    if (result) {
      await applyProject(result)
    }
  }

  return (
    <div className={clsx("fixed inset-0 z-50 flex items-center justify-center", isLight ? "bg-white" : "bg-zinc-950")}>
      <div className="w-full max-w-lg space-y-8 px-6">
        <div className="text-center space-y-3">
          <img src={splashLogo} alt="Mockup Studio" className="w-22 h-22 mx-auto" />
          <div className="space-y-1">
            <h1 className={clsx("text-4xl font-bold tracking-tight", isLight ? "text-zinc-900" : "text-zinc-100")}>Mockup Studio</h1>
            <p className={clsx("text-base", isLight ? "text-zinc-700" : "text-zinc-300")}>Desktop device mockup scene builder</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleNew}
            className="w-full px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors"
          >
            New Project
          </button>
          <button
            onClick={handleOpen}
            className={clsx("w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors border", isLight ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border-zinc-200" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border-zinc-700")}
          >
            Open Project
          </button>
        </div>

        {recentProjects.length > 0 && (
          <div>
            <h3 className={clsx("text-sm font-semibold uppercase mb-2", isLight ? "text-zinc-700" : "text-zinc-300")}>Recent Projects</h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {recentProjects.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => handleOpenRecent(entry.path)}
                  className={clsx("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between", isLight ? "text-zinc-700 hover:bg-zinc-100" : "text-zinc-300 hover:bg-zinc-800")}
                >
                  <span className="truncate">{entry.name}</span>
                  <span className={clsx("text-xs shrink-0 ml-2", isLight ? "text-zinc-500" : "text-zinc-400")}>
                    {new Date(entry.lastOpened).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className={clsx("text-center text-xs", isLight ? "text-zinc-600" : "text-zinc-400")}>
          Ctrl+N new &middot; Ctrl+O open &middot; Ctrl+S save
        </p>

        <p className={clsx("text-center text-xs select-none", text.muted)}>
          v{__APP_VERSION__}
        </p>

        <div className={clsx("text-center text-xs leading-relaxed", text.muted)}>
          <div className={clsx("font-medium", accent.text)}>Omar Khaled</div>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <a href="https://github.com/Omar-Khaled-57" target="_blank" rel="noopener noreferrer" className={clsx(accent.text, "hover:underline")}>GitHub</a>
            <span className={text.muted}>|</span>
            <a href="https://omar-el-khouly.vercel.app" target="_blank" rel="noopener noreferrer" className={clsx(accent.text, "hover:underline")}>Portfolio</a>
          </div>
        </div>
      </div>
    </div>
  )
}
