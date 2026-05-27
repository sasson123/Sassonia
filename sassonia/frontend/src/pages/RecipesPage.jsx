import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Camera, ChefHat, Clock, Loader2 } from 'lucide-react'
import { recipes as recipesApi, gemini } from '../api'

const CATEGORIES = ['All', 'Main Course', 'Dessert', 'Salad', 'Soup', 'Breakfast', 'Snack', 'Other']
const DIFFICULTY_COLOR = { easy: 'text-green-400', medium: 'text-yellow-400', hard: 'text-red-400' }

export default function RecipesPage() {
  const navigate = useNavigate()
  const [recipeList, setRecipeList] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    recipesApi.list().then(setRecipeList)
  }, [])

  const filtered = recipeList.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || r.category === category
    return matchSearch && matchCat
  })

  async function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const data = await gemini.extractRecipe(file)
      navigate('/recipes/new', { state: { prefill: data } })
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(detail ? `Scan failed: ${detail}` : 'Could not extract recipe from image. Try a clearer photo.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <header className="sticky top-0 bg-slate-900 z-10 px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ChefHat className="text-sky-400" size={28} /> Recipes
          </h1>
          <div className="flex gap-2">
            <label className={`cursor-pointer flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors
              ${uploading ? 'bg-slate-700 text-slate-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              {uploading ? 'Reading...' : 'Scan'}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
            <button
              onClick={() => navigate('/recipes/new')}
              className="flex items-center gap-1 px-3 py-2 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recipes..."
            className="w-full bg-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${category === cat ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="text-red-400 text-sm px-4 pt-3">{error}</p>}

      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        {filtered.length === 0 && (
          <div className="col-span-2 text-center text-slate-500 py-16">
            <ChefHat size={48} className="mx-auto mb-3 opacity-30" />
            <p>No recipes yet.</p>
            <p className="text-sm mt-1">Add one manually or scan a photo.</p>
          </div>
        )}
        {filtered.map(r => (
          <button
            key={r.id}
            onClick={() => navigate(`/recipes/${r.id}`)}
            className="bg-slate-800 rounded-2xl overflow-hidden text-left hover:bg-slate-700 transition-colors active:scale-95"
          >
            {r.image_path ? (
              <img src={r.image_path} alt={r.name} className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 bg-slate-700 flex items-center justify-center">
                <ChefHat size={32} className="text-slate-500" />
              </div>
            )}
            <div className="p-3">
              <p className="font-semibold text-sm text-white leading-tight">{r.name}</p>
              <div className="flex items-center gap-2 mt-1">
                {(r.prep_time + r.cook_time) > 0 && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={11} /> {r.prep_time + r.cook_time}m
                  </span>
                )}
                {r.difficulty && (
                  <span className={`text-xs capitalize ${DIFFICULTY_COLOR[r.difficulty] || 'text-slate-400'}`}>
                    {r.difficulty}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
