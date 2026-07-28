import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { loadProjectFromZipResult } from '../../lib/project-serialization'

interface RecentEntry {
  path: string
  name: string
  lastOpened: number
  thumbnailPath: string
}

export default function SplashScreen() {
  const [recentProjects, setRecentProjects] = useState<RecentEntry[]>([])

  useEffect(() => {
    if (window.api) {
      window.api.getRecentProjects().then(setRecentProjects)
    }
  }, [])

  const applyProject = async (result: { manifest: string; assetsJson: string; filePath: string }) => {
    const { project, scenes, activeSceneIndex } = loadProjectFromZipResult(result)

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-lg space-y-8 px-6">
        <div className="text-center space-y-3">
          <img src="/logo.png" alt="Mockup Studio" className="w-16 h-16 mx-auto" />
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Mockup Studio</h1>
            <p className="text-sm text-zinc-500">Desktop device mockup scene builder</p>
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
            className="w-full px-4 py-3 bg-zinc-800 text-zinc-200 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors border border-zinc-700"
          >
            Open Project
          </button>
        </div>

        {recentProjects.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase mb-2">Recent Projects</h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {recentProjects.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => handleOpenRecent(entry.path)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{entry.name}</span>
                  <span className="text-[10px] text-zinc-600 shrink-0 ml-2">
                    {new Date(entry.lastOpened).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-zinc-700">
          Ctrl+N new &middot; Ctrl+O open &middot; Ctrl+S save
        </p>
      </div>
    </div>
  )
}
