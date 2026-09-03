import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { ShoppingCart, CheckSquare, BookOpen } from 'lucide-react'
import RecipesPage from './pages/RecipesPage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import RecipeFormPage from './pages/RecipeFormPage'
import ShoppingPage from './pages/ShoppingPage'
import TasksPage from './pages/TasksPage'

const NAV_LINKS = [
  { to: '/shopping', icon: ShoppingCart, label: 'Shopping' },
  { to: '/recipes', icon: BookOpen, label: 'Recipes' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
]

function NavBar() {
  return (
    <nav className="flex-shrink-0 bg-slate-800 border-t border-slate-700 flex z-50">
      {NAV_LINKS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 pt-3 text-xs transition-colors ${
              isActive ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          <Icon size={22} />
          <span className="mt-1">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-dvh">
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
        <NavBar />
      </div>
    </BrowserRouter>
  )
}
