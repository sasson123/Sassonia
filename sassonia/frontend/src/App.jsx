import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { ShoppingCart, CheckSquare, BookOpen, RotateCw, Sparkles } from 'lucide-react'
import RecipesPage from './pages/RecipesPage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import RecipeFormPage from './pages/RecipeFormPage'
import ShoppingPage from './pages/ShoppingPage'
import TasksPage from './pages/TasksPage'
import VersionModal from './VersionModal'
import { APP_VERSION } from './version'
import { system } from './api'

const NAV_LINKS = [
  { to: '/shopping', icon: ShoppingCart, label: 'Shopping' },
  { to: '/recipes', icon: BookOpen, label: 'Recipes' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
]

function NavBar({ onOpenVersion, hasUpdate }) {
  return (
    <nav className="flex-shrink-0 bg-slate-800 border-t border-slate-700 flex z-50">
      {NAV_LINKS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 pt-2.5 text-xs transition-colors ${
              isActive ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          <Icon size={20} />
          <span className="mt-1">{label}</span>
        </NavLink>
      ))}

      {/* Version & Refresh Button */}
      <button
        type="button"
        onClick={onOpenVersion}
        className="flex-1 flex flex-col items-center py-2 pt-2.5 text-xs text-slate-400 hover:text-slate-200 active:text-sky-400 transition-colors relative"
        title="גרסה ורענון מלא"
      >
        <div className="relative">
          <RotateCw size={20} className={hasUpdate ? 'text-amber-400' : ''} />
          {hasUpdate && (
            <>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />
            </>
          )}
        </div>
        <span className={`mt-1 font-mono font-medium text-[11px] ${hasUpdate ? 'text-amber-400 font-bold' : ''}`}>
          v{APP_VERSION}
        </span>
      </button>
    </nav>
  )
}

export default function App() {
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [serverVersion, setServerVersion] = useState(null)

  // Check server version periodically and on window focus
  useEffect(() => {
    function checkVersion() {
      system.getVersion()
        .then(res => {
          if (res?.version) {
            setServerVersion(res.version)
          }
        })
        .catch(() => {})
    }

    checkVersion()
    window.addEventListener('focus', checkVersion)
    const interval = setInterval(checkVersion, 60000)

    return () => {
      window.removeEventListener('focus', checkVersion)
      clearInterval(interval)
    }
  }, [])

  const hasUpdate = serverVersion && serverVersion !== APP_VERSION

  return (
    <BrowserRouter>
      <div className="flex flex-col h-dvh">
        {/* Top alert banner when a newer server version is ready */}
        {hasUpdate && (
          <div
            onClick={() => setShowVersionModal(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between cursor-pointer transition-colors shadow-md z-50 select-none"
            dir="rtl"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="animate-bounce" />
              <span>גרסה חדשה זמינה בשרת (v{serverVersion})! לחץ כאן לרענון מלא</span>
            </div>
            <span className="text-[11px] underline bg-amber-600/30 px-2 py-0.5 rounded-md">
              רענן עכשיו
            </span>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/shopping" replace />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/recipes/new" element={<RecipeFormPage />} />
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
            <Route path="/shopping" element={<ShoppingPage />} />
            <Route path="/tasks" element={<TasksPage />} />
          </Routes>
        </div>

        <NavBar onOpenVersion={() => setShowVersionModal(true)} hasUpdate={hasUpdate} />

        <VersionModal
          isOpen={showVersionModal}
          onClose={() => setShowVersionModal(false)}
        />
      </div>
    </BrowserRouter>
  )
}
