import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useStore } from '../../store'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info.componentStack)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const isLight = useStore.getState().theme === 'light'
      return (
        <div className={`flex flex-col items-center justify-center h-full p-8 gap-4 ${isLight ? 'bg-white text-zinc-700' : 'bg-zinc-950 text-zinc-300'}`}>
          <AlertTriangle size={40} className="text-amber-500/80" />
          <h2 className={`text-lg font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Something went wrong</h2>
          <p className={`text-sm text-center max-w-md ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReset}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors border ${isLight ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border-zinc-200' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700'}`}
          >
            <RotateCcw size={14} />
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
