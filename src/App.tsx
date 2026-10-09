import { useEffect } from 'react'
import { CameraSetup } from './components/CameraSetup'
import { ClashReport } from './components/ClashReport'
import { ClashSession } from './components/ClashSession'
import { ExerciseSelection } from './components/ExerciseSelection'
import { Gameplay } from './components/Gameplay'
import { HomeScreen } from './components/HomeScreen'
import { Results } from './components/Results'
import { RivalSelect } from './components/RivalSelect'
import { useAppStore } from './state/store'

export default function App() {
  const screen = useAppStore((s) => s.screen)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    const rival = params.get('rival')
    if (room || rival === 'live') {
      useAppStore.getState().setClash({
        rival: 'live',
        room: room || 'dojo-1',
      })
      useAppStore.getState().go('rival')
    }
  }, [])
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-base-950 font-sans text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Apple-style ambient depth gradients (calm and subtle) */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-[20%] left-1/2 h-[550px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-b from-cyan-500/10 via-violet-600/10 to-transparent blur-[120px]" />
        <div className="absolute top-[45%] -left-[10%] h-[400px] w-[500px] rounded-full bg-violet-600/8 blur-[140px]" />
        <div className="absolute bottom-[10%] -right-[10%] h-[450px] w-[550px] rounded-full bg-cyan-500/8 blur-[140px]" />
      </div>

      <main className="relative z-10 animate-fadeIn">
        {screen === 'home' && <HomeScreen />}
        {screen === 'setup' && <CameraSetup />}
        {screen === 'select' && <ExerciseSelection />}
        {screen === 'game' && <Gameplay />}
        {screen === 'results' && <Results />}
        {screen === 'rival' && <RivalSelect />}
        {screen === 'clash' && <ClashSession />}
        {screen === 'clash-report' && <ClashReport />}
      </main>
    </div>
  )
}
