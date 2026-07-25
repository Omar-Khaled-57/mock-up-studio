export default function SplashScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-zinc-100">Mockup Studio</h1>
        <p className="text-zinc-400">Desktop device mockup scene builder</p>
        <div className="space-x-4">
          <button className="px-4 py-2 bg-zinc-800 text-zinc-100 rounded hover:bg-zinc-700">
            New Project
          </button>
          <button className="px-4 py-2 bg-zinc-800 text-zinc-100 rounded hover:bg-zinc-700">
            Open Project
          </button>
        </div>
      </div>
    </div>
  )
}
