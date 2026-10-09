import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in AthleteMind UI:', error, errorInfo)
  }

  private handleReset = () => {
    localStorage.clear()
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-base-950 p-6 text-slate-100 font-display">
          <div className="max-w-lg rounded-2xl border border-red-500/30 bg-base-900/90 p-8 text-center shadow-glow">
            <span className="text-4xl">⚠️</span>
            <h1 className="mt-3 text-2xl font-bold uppercase text-red-400">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-300">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold uppercase text-base-950 hover:bg-cyan-400"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="rounded-xl border border-base-600 bg-base-800 px-5 py-2.5 text-sm font-bold uppercase text-slate-300 hover:border-red-400"
              >
                Clear Data & Reset
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
