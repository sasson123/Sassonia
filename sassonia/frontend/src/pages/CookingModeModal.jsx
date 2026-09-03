import { useState, useEffect, useRef } from 'react'
import { X, ChevronRight, ChevronLeft, CheckCircle2, Circle, ListOrdered, BookOpen, Clock, Play, Pause, RotateCcw, Volume2 } from 'lucide-react'

export default function CookingModeModal({ recipe, scaledIngredients, onClose }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState({})
  const [showIngredients, setShowIngredients] = useState(false)
  const [viewMode, setViewMode] = useState('step') // 'step' | 'list'
  const [wakeLockActive, setWakeLockActive] = useState(false)

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const timerRef = useRef(null)

  const steps = recipe.steps || []
  const totalSteps = steps.length

  // Screen Wake Lock API management
  useEffect(() => {
    let wakeLock = null

    async function requestWakeLock() {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await navigator.wakeLock.request('screen')
          setWakeLockActive(true)
          wakeLock.addEventListener('release', () => {
            setWakeLockActive(false)
          })
        } catch (err) {
          console.warn('Wake Lock request failed:', err)
          setWakeLockActive(false)
        }
      }
    }

    requestWakeLock()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockActive) {
        requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (wakeLock) {
        wakeLock.release().catch(() => {})
      }
    }
  }, [])

  // Timer countdown effect
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            setTimerRunning(false)
            // Play alert sound & vibrate if available
            try {
              if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300])
              const ctx = new (window.AudioContext || window.webkitAudioContext)()
              const osc = ctx.createOscillator()
              osc.type = 'sine'
              osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
              osc.connect(ctx.destination)
              osc.start()
              osc.stop(ctx.currentTime + 0.6)
            } catch {}
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [timerRunning, timerSeconds])

  function addMinutes(min) {
    setTimerSeconds(s => s + min * 60)
  }

  function resetTimer() {
    setTimerRunning(false)
    setTimerSeconds(0)
  }

  function toggleStep(idx) {
    setCompletedSteps(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col select-none">
      {/* Top Header */}
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="יציאה ממצב בישול"
          >
            <X size={22} />
          </button>
          <div>
            <h2 dir="auto" className="font-bold text-base line-clamp-1 max-w-[200px] sm:max-w-md">{recipe.name}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`inline-block w-2 h-2 rounded-full ${wakeLockActive ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{wakeLockActive ? 'מסך תמיד דולק' : 'מצב הכנה'}</span>
            </div>
          </div>
        </div>

        {/* View toggles and Timer button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTimer(v => !v)}
            className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
              timerRunning ? 'bg-amber-500 text-slate-950 font-bold' : showTimer ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <Clock size={16} />
            {timerSeconds > 0 ? formatTime(timerSeconds) : 'טיימר'}
          </button>

          <button
            onClick={() => setShowIngredients(v => !v)}
            className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showIngredients ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <BookOpen size={16} />
            <span>מרכיבים</span>
          </button>

          <button
            onClick={() => setViewMode(m => m === 'step' ? 'list' : 'step')}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            title={viewMode === 'step' ? 'מעבר לתצוגת רשימה' : 'מעבר לשלב-אחר-שלב'}
          >
            {viewMode === 'step' ? <ListOrdered size={16} /> : 'שלבים'}
          </button>
        </div>
      </header>

      {/* Embedded Timer Panel */}
      {showTimer && (
        <div className="bg-slate-900/95 border-b border-slate-800 p-3 px-4 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-amber-400">{formatTime(timerSeconds)}</span>
            <div className="flex gap-1.5">
              <button onClick={() => addMinutes(1)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs">+1 דק׳</button>
              <button onClick={() => addMinutes(5)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs">+5 דק׳</button>
              <button onClick={() => addMinutes(10)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs">+10 דק׳</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {timerSeconds > 0 && (
              <>
                <button
                  onClick={() => setTimerRunning(r => !r)}
                  className="p-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors font-bold"
                >
                  {timerRunning ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  onClick={resetTimer}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
                >
                  <RotateCcw size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {viewMode === 'step' ? (
          /* Step-by-Step Focus View */
          <div className="flex-1 flex flex-col justify-between p-6 max-w-2xl mx-auto w-full">
            {/* Progress indicator */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-400 font-medium mb-1.5">
                <span>שלב {currentStep + 1} מתוך {totalSteps}</span>
                <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-sky-500 h-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                />
              </div>
            </div>

            {/* Current Step Big Card */}
            <div
              onClick={() => toggleStep(currentStep)}
              className={`flex-1 flex flex-col justify-center items-center p-6 rounded-3xl cursor-pointer border transition-all ${
                completedSteps[currentStep]
                  ? 'bg-slate-900/60 border-green-500/40 text-slate-400'
                  : 'bg-slate-900 border-slate-800 text-white shadow-2xl'
              }`}
            >
              <div className="mb-4">
                {completedSteps[currentStep] ? (
                  <span className="flex items-center gap-1.5 text-green-400 text-sm font-semibold bg-green-950/60 px-3 py-1 rounded-full border border-green-800/50">
                    <CheckCircle2 size={16} /> הושלם (לחץ לביטול)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sky-400 text-sm font-semibold bg-sky-950/60 px-3 py-1 rounded-full border border-sky-800/50">
                    <Circle size={16} /> לחץ על השלב לסימון סיום
                  </span>
                )}
              </div>

              <p dir="auto" className={`text-xl sm:text-2xl md:text-3xl text-center leading-relaxed font-medium ${completedSteps[currentStep] ? 'line-through' : ''}`}>
                {steps[currentStep]}
              </p>
            </div>

            {/* Navigation Big Touch Buttons */}
            <div className="flex items-center justify-between gap-4 mt-6">
              <button
                onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                disabled={currentStep === 0}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none rounded-2xl flex items-center justify-center gap-2 text-base font-bold transition-colors"
              >
                <ChevronRight size={22} /> הקודם
              </button>

              <button
                onClick={() => {
                  setCompletedSteps(prev => ({ ...prev, [currentStep]: true }))
                  if (currentStep < totalSteps - 1) {
                    setCurrentStep(s => s + 1)
                  }
                }}
                className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 text-base font-bold transition-colors ${
                  currentStep === totalSteps - 1
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
              >
                {currentStep === totalSteps - 1 ? 'סיימתי הכל! 🎉' : 'הבא'} <ChevronLeft size={22} />
              </button>
            </div>
          </div>
        ) : (
          /* Full Scrollable List View */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-3">
            {steps.map((step, idx) => {
              const isDone = completedSteps[idx]
              return (
                <div
                  key={idx}
                  onClick={() => toggleStep(idx)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-start ${
                    isDone
                      ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <button className="mt-1 flex-shrink-0">
                    {isDone ? (
                      <CheckCircle2 size={24} className="text-green-500" />
                    ) : (
                      <Circle size={24} className="text-slate-500" />
                    )}
                  </button>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-sky-400 block mb-1">שלב {idx + 1}</span>
                    <p dir="auto" className={`text-base sm:text-lg leading-relaxed ${isDone ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                      {step}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick Ingredients Slide-Over Drawer */}
        {showIngredients && (
          <div className="absolute inset-0 bg-black/60 z-20 backdrop-blur-sm flex justify-end" onClick={() => setShowIngredients(false)}>
            <div
              className="bg-slate-900 w-full max-w-md h-full shadow-2xl p-5 overflow-y-auto flex flex-col border-l border-slate-800 animate-slideLeft"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen className="text-sky-400" size={20} /> מצרכים למתכון
                </h3>
                <button onClick={() => setShowIngredients(false)} className="p-1.5 text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-2">
                {scaledIngredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80">
                    <span dir="auto" className="text-sm font-medium text-white">{ing.name}</span>
                    <span dir="auto" className="text-sm text-sky-400 font-semibold">{ing.quantity}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowIngredients(false)}
                className="w-full mt-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium text-slate-300 transition-colors"
              >
                סגור וחזור לשלבים
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
