import Canvas from './components/canvas/Canvas'
import Sidebar from './components/sidebar/Sidebar'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
  useKeyboardShortcuts()

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <Canvas />
    </div>
  )
}
