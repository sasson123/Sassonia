import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { ShoppingCart, CheckSquare, BookOpen, Home } from 'lucide-react'
import RecipesPage from './pages/RecipesPage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import RecipeFormPage from './pages/RecipeFormPage'
import ShoppingPage from './pages/ShoppingPage'
import TasksPage from './pages/TasksPage'

function NavBar() {
  const location = useLocation()
  const hideNav = location.pathname.startsWith('/recipes/') && location.pathname !== '/recipes'

  if (hideNav && location.pathname !== '/recipes/new') {
    const isDetail = /^\/recipes\/\d+$/.test(location.pathname)
    if (!isDetail) return null
  }

  const links = [
    { to: '/recipes', icon: BookOpen, label: 'Recipes' },
    { to: '/shopping', icon: ShoppingCart, label: 'Shopping' },
    { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex safe-bottom z-50">
      {links.map(({ to, icon: Icon, label }) => (
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
      <div className="min-h-screen pb-16">
        <Routes>
          <Route path="/" element={<RecipesPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/recipes/new" element={<RecipeFormPage />} />
          <Route path="/recipes/:id" element={<RecipeDetailPage />} />
          <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
          <Route path="/shopping" element={<ShoppingPage />} />
          <Route path="/tasks" element={<TasksPage />} />
        </Routes>
        <NavBar />
      </div>
    </BrowserRouter>
  )
}
