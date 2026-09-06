import { useState, useEffect } from 'react'
import { RotateCw, CheckCircle2, AlertTriangle, X, Smartphone, Server, Loader2 } from 'lucide-react'
import { APP_VERSION } from './version'
import { system } from './api'
import { forceFullRefresh } from './refreshApp'

export default function VersionModal({ isOpen, onClose }) {
  const [serverVersion, setServerVersion] = useState(null)
  const [loadingServer, setLoadingServer] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [serverError, setServerError] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoadingServer(true)
    setServerError(false)
    system.getVersion()
      .then(res => {
        setServerVersion(res?.version || null)
      })
      .catch(() => {
        setServerError(true)
      })
      .finally(() => {
        setLoadingServer(false)
      })
  }, [isOpen])

  if (!isOpen) return null

  const isUpToDate = serverVersion && serverVersion === APP_VERSION
  const hasUpdate = serverVersion && serverVersion !== APP_VERSION

  async function handleRefresh() {
    setRefreshing(true)
    await forceFullRefresh()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn select-none"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 w-full max-w-sm shadow-2xl text-white relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <RotateCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">גרסת אפליקציה ורענון</h3>
              <p className="text-xs text-slate-400">Sassonia Family Hub</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Version Comparison Box */}
        <div className="space-y-2.5 mb-5">
          {/* Client Version */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <Smartphone size={18} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-200">גרסה בטלפון (Client):</span>
            </div>
            <span className="font-mono text-sm font-bold px-2.5 py-0.5 rounded-lg bg-slate-700 text-sky-400">
              v{APP_VERSION}
            </span>
          </div>

          {/* Server Version */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <Server size={18} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-200">גרסה בשרת (HA):</span>
            </div>
            {loadingServer ? (
              <Loader2 size={16} className="animate-spin text-slate-400" />
            ) : serverError ? (
              <span className="text-xs text-amber-400 font-medium">לא מקוון</span>
            ) : (
              <span className="font-mono text-sm font-bold px-2.5 py-0.5 rounded-lg bg-slate-700 text-emerald-400">
                v{serverVersion || '—'}
              </span>
            )}
          </div>
        </div>

        {/* Status indicator banner */}
        {hasUpdate ? (
          <div className="mb-5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-300 text-xs leading-relaxed">
            <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">קיים עדכון חדש בשרת (v{serverVersion})!</p>
              <p className="text-amber-200/80 mt-0.5">הטלפון טרם טען את הגרסה החדשה. לחץ למטה לרענון מלא.</p>
            </div>
          </div>
        ) : isUpToDate ? (
          <div className="mb-5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-300 text-xs font-medium">
            <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
            <span>האפליקציה בטלפון מעודכנת לגרסה האחרונה.</span>
          </div>
        ) : null}

        <p className="text-xs text-slate-400 leading-relaxed mb-4 text-center">
          בלחיצה על הכפתור ינוקה זיכרון המטמון (Cache) של הדפדפן והאפליקציה תיטען מחדש במלואה מהשרת.
        </p>

        {/* Action Button: Full Refresh */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm bg-sky-600 hover:bg-sky-500 active:scale-[0.98] text-white flex items-center justify-center gap-2 shadow-lg shadow-sky-600/25 transition-all disabled:opacity-50"
        >
          {refreshing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>מנקה מטמון ומרענן...</span>
            </>
          ) : (
            <>
              <RotateCw size={18} />
              <span>רענון מלא ומחיקת מטמון</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
