import { useState, useEffect, useRef } from 'react'
import {
  X, ChevronRight, ChevronLeft, CheckCircle2, Circle,
  ListOrdered, BookOpen, Clock, Play, Pause, RotateCcw,
  CheckCheck, ChefHat
} from 'lucide-react'

export default function CookingModeModal({ recipe, scaledIngredients = [], onClose }) {
  // Requirement: Default first screen must be ingredients!
  const [viewMode, setViewMode] = useState('ingredients') // 'ingredients' | 'step' | 'list'
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState({})
  const [checkedIngredients, setCheckedIngredients] = useState({})
  const [wakeLockActive, setWakeLockActive] = useState(false)

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const timerRef = useRef(null)

  const steps = recipe.steps || []
  const totalSteps = steps.length

  // Detect Hebrew
  const isHebrew = /[\u0590-\u05FF]/.test(
    (recipe.name || '') + ' ' +
    (recipe.description || '') + ' ' +
    steps.join(' ')
  )

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
            try {
              if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300])
              const ctx = new (window.AudioContext || window.webkitAudioContext)()
              const osc = ctx.createOscillator()
              osc.type = 'sine'
              osc.frequency.setValueAtTime(587.33, ctx.currentTime)
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

  function toggleIngredient(idx) {
    setCheckedIngredients(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  function toggleAllIngredients() {
    const allChecked = scaledIngredients.every((_, idx) => checkedIngredients[idx])
    if (allChecked) {
      setCheckedIngredients({})
    } else {
      const all = {}
      scaledIngredients.forEach((_, idx) => { all[idx] = true })
      setCheckedIngredients(all)
    }
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const checkedCount = Object.values(checkedIngredients).filter(Boolean).length

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col select-none h-dvh overflow-hidden"
      dir={isHebrew ? 'rtl' : 'ltr'}
    >
      {/* ── TOP HEADER ────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex-shrink-0"
            title="יציאה ממצב בישול"
          >
            <X size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="font-bold text-sm sm:text-base truncate text-right text-white">
              {recipe.name}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className={`inline-block w-2 h-2 rounded-full ${wakeLockActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{wakeLockActive ? 'מסך תמיד דולק' : 'מצב הכנה'}</span>
            </div>
          </div>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/60 flex-shrink-0 text-xs font-semibold">
          <button
            onClick={() => setViewMode('ingredients')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
              viewMode === 'ingredients'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen size={14} />
            <span>מצרכים</span>
          </button>

          <button
            onClick={() => setViewMode('step')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
              viewMode === 'step'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ChefHat size={14} />
            <span>שלב-שלב</span>
          </button>

          <button
            onClick={() => setViewMode('list')}
            className={`px-2 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
              viewMode === 'list'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="כל השלבים ברשימה"
          >
            <ListOrdered size={14} />
          </button>

          {/* Timer button */}
          <button
            onClick={() => setShowTimer(v => !v)}
            className={`px-2 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
              timerRunning
                ? 'bg-amber-500 text-slate-950 font-bold'
                : showTimer
                ? 'bg-slate-700 text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="טיימר"
          >
            <Clock size={14} />
            {timerSeconds > 0 && <span className="font-mono text-[11px]">{formatTime(timerSeconds)}</span>}
          </button>
        </div>
      </header>

      {/* ── EMBEDDED TIMER PANEL ──────────────────────────────── */}
      {showTimer && (
        <div className="bg-slate-900/95 border-b border-slate-800 p-3 px-4 flex flex-wrap items-center justify-between gap-3 animate-fadeIn flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-amber-400">{formatTime(timerSeconds)}</span>
            <div className="flex gap-1.5">
              <button onClick={() => addMinutes(1)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold">+1 דק׳</button>
              <button onClick={() => addMinutes(5)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold">+5 דק׳</button>
              <button onClick={() => addMinutes(10)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold">+10 דק׳</button>
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

      {/* ── VIEW 1: INGREDIENTS CHECKLIST (DEFAULT FIRST SCREEN) ── */}
      {viewMode === 'ingredients' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Subheader */}
          <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/70 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">
                מצרכים להכנה ({scaledIngredients.length})
              </span>
              <span className="text-xs text-sky-400 font-medium">
                {checkedCount} / {scaledIngredients.length} הוכנו
              </span>
            </div>
            <button
              onClick={toggleAllIngredients}
              className="text-xs font-medium text-slate-400 hover:text-sky-400 flex items-center gap-1 transition-colors"
            >
              <CheckCheck size={14} />
              <span>{checkedCount === scaledIngredients.length ? 'בטל הכל' : 'סמן הכל'}</span>
            </button>
          </div>

          {/* Scrollable Checklist */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2 max-w-2xl mx-auto w-full">
            {scaledIngredients.map((ing, idx) => {
              const isChecked = checkedIngredients[idx]
              return (
                <div
                  key={idx}
                  onClick={() => toggleIngredient(idx)}
                  className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl cursor-pointer border transition-all active:scale-[0.99] ${
                    isChecked
                      ? 'bg-slate-900/50 border-slate-800/60 opacity-55'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-sm'
                  }`}
                >
                  {/* Right side in RTL: Checkbox + Ingredient Name */}
                  <div className="flex items-center gap-3 min-w-0 flex-1 pl-2">
                    <button type="button" className="flex-shrink-0 text-sky-400">
                      {isChecked ? (
                        <CheckCircle2 size={22} className="text-emerald-400" />
                      ) : (
                        <Circle size={22} className="text-slate-500" />
                      )}
                    </button>
                    <span className={`text-base font-medium text-right ${isChecked ? 'line-through text-slate-500' : 'text-white'}`}>
                      {ing.name}
                    </span>
                  </div>

                  {/* Left side in RTL: Quantity in prominent font */}
                  {ing.quantity && (
                    <span className={`text-sm sm:text-base font-bold flex-shrink-0 text-left px-2 py-0.5 rounded-lg ${
                      isChecked ? 'text-slate-500 bg-slate-800/40' : 'text-sky-400 bg-sky-950/40 border border-sky-800/30'
                    }`}>
                      {ing.quantity}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Fixed Sticky Bottom Action Bar — Always visible, safe padding */}
          <div className="flex-shrink-0 bg-slate-900 border-t border-slate-800 p-4 pb-8 sm:pb-4 z-30 shadow-2xl">
            <div className="max-w-2xl mx-auto w-full">
              <button
                onClick={() => {
                  setViewMode('step')
                  setCurrentStep(0)
                }}
                className="w-full py-4 px-6 rounded-2xl font-bold text-base bg-sky-600 hover:bg-sky-500 active:scale-[0.98] text-white flex items-center justify-center gap-3 shadow-xl shadow-sky-600/30 transition-all"
              >
                <span>התחל בהכנת המתכון (מעבר לשלב 1)</span>
                {isHebrew ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 2: STEP-BY-STEP (PAGINATED WITH UNHIDDEN STICKY FOOTER) ── */}
      {viewMode === 'step' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Step Progress bar */}
          <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/70 flex-shrink-0">
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1.5">
                <span>שלב {currentStep + 1} מתוך {totalSteps}</span>
                <span className="text-sky-400">{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-sky-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Middle Step Card (Scrollable internally if text is long) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col justify-center max-w-2xl mx-auto w-full">
            <div
              onClick={() => toggleStep(currentStep)}
              className={`p-6 sm:p-8 rounded-3xl cursor-pointer border transition-all my-auto shadow-2xl ${
                completedSteps[currentStep]
                  ? 'bg-slate-900/60 border-emerald-500/50 text-slate-400'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-white'
              }`}
            >
              {/* Step Status Badge */}
              <div className="mb-5 flex justify-center">
                {completedSteps[currentStep] ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 text-xs sm:text-sm font-bold bg-emerald-950/80 px-3.5 py-1.5 rounded-full border border-emerald-800/60">
                    <CheckCircle2 size={18} /> הושלם (לחץ לביטול)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sky-400 text-xs sm:text-sm font-semibold bg-sky-950/70 px-3.5 py-1.5 rounded-full border border-sky-800/50">
                    <Circle size={16} /> לחץ על השלב לסימון סיום
                  </span>
                )}
              </div>

              {/* Step Text */}
              <p className={`text-xl sm:text-2xl md:text-3xl text-center leading-relaxed font-semibold ${completedSteps[currentStep] ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                {steps[currentStep]}
              </p>
            </div>
          </div>

          {/* Fixed Sticky Bottom Navigation Bar — GUARANTEED VISIBLE, SAFE PADDING */}
          <div className="flex-shrink-0 bg-slate-900 border-t border-slate-800 p-4 pb-8 sm:pb-4 z-30 shadow-2xl">
            <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto w-full">
              {/* Previous Step Button */}
              <button
                onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                disabled={currentStep === 0}
                className="flex-1 py-4 px-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white transition-all border border-slate-700"
              >
                {isHebrew ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
                <span>הקודם</span>
              </button>

              {/* Quick Jump to Ingredients */}
              <button
                onClick={() => setViewMode('ingredients')}
                className="p-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] rounded-2xl text-slate-300 hover:text-white transition-colors border border-slate-700 flex items-center justify-center"
                title="הצג מצרכים"
              >
                <BookOpen size={20} />
              </button>

              {/* Next Step Button */}
              <button
                onClick={() => {
                  setCompletedSteps(prev => ({ ...prev, [currentStep]: true }))
                  if (currentStep < totalSteps - 1) {
                    setCurrentStep(s => s + 1)
                  }
                }}
                className={`flex-1 py-4 px-4 rounded-2xl flex items-center justify-center gap-2 text-base font-bold active:scale-[0.98] transition-all shadow-lg ${
                  currentStep === totalSteps - 1
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/30'
                }`}
              >
                <span>{currentStep === totalSteps - 1 ? 'סיימתי הכל! 🎉' : 'הבא'}</span>
                {isHebrew ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 3: FULL SCROLLABLE LIST ───────────────────────── */}
      {viewMode === 'list' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-3">
            {steps.map((step, idx) => {
              const isDone = completedSteps[idx]
              return (
                <div
                  key={idx}
                  onClick={() => toggleStep(idx)}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex gap-4 items-start ${
                    isDone
                      ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-sm'
                  }`}
                >
                  <button className="mt-1 flex-shrink-0">
                    {isDone ? (
                      <CheckCircle2 size={24} className="text-emerald-400" />
                    ) : (
                      <Circle size={24} className="text-slate-500" />
                    )}
                  </button>
                  <div className="flex-1 text-right">
                    <span className="text-xs font-bold text-sky-400 block mb-1">
                      שלב {idx + 1}
                    </span>
                    <p className={`text-base sm:text-lg leading-relaxed ${isDone ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                      {step}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Sticky footer */}
          <div className="flex-shrink-0 bg-slate-900 border-t border-slate-800 p-4 pb-8 sm:pb-4 z-30 shadow-2xl">
            <div className="max-w-2xl mx-auto flex gap-3">
              <button
                onClick={() => setViewMode('ingredients')}
                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold text-sm text-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <BookOpen size={18} />
                <span>צפה במצרכים</span>
              </button>
              <button
                onClick={() => setViewMode('step')}
                className="flex-1 py-3.5 bg-sky-600 hover:bg-sky-500 rounded-2xl font-bold text-sm text-white transition-colors flex items-center justify-center gap-2"
              >
                <ChefHat size={18} />
                <span>מעבר לשלב-שלב</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
