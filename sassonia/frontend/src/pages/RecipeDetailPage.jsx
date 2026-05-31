import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, ShoppingCart, Clock, Users, ChefHat, CheckCircle, Circle } from 'lucide-react'
import { recipes as recipesApi, shopping } from '../api'

const DIFFICULTY_COLOR = { easy: 'bg-green-900 text-green-300', medium: 'bg-yellow-900 text-yellow-300', hard: 'bg-red-900 text-red-300' }

export default function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState(null)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    recipesApi.get(id).then(setRecipe)
  }, [id])

  async function handleDelete() {
    if (!confirm('Delete this recipe?')) return
    await recipesApi.delete(id)
    navigate('/recipes')
  }

  async function addToShopping() {
    setAdding(true)
    const items = recipe.ingredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity || ''
    }))
    await shopping.addBulk(items)
    setAdding(false)
    setAdded(true)
    setTimeout(() => setAdded(false), 3000)
  }

  if (!recipe) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="h-full overflow-y-auto max-w-2xl mx-auto">
      <div className="relative">
        {recipe.image_path ? (
          <img src={recipe.image_path} alt={recipe.name} className="w-full h-56 object-cover" />
        ) : (
          <div className="w-full h-56 bg-slate-800 flex items-center justify-center">
            <ChefHat size={56} className="text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
        <button
          onClick={() => navigate('/recipes')}
          className="absolute top-4 left-4 bg-slate-900/70 backdrop-blur p-2 rounded-full"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => navigate(`/recipes/${id}/edit`)}
            className="bg-slate-900/70 backdrop-blur p-2 rounded-full"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={handleDelete}
            className="bg-slate-900/70 backdrop-blur p-2 rounded-full text-red-400"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        <h1 dir="auto" className="text-2xl font-bold text-white mb-2">{recipe.name}</h1>

        <div className="flex flex-wrap gap-2 mb-4">
          {recipe.category && (
            <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs">{recipe.category}</span>
          )}
          {recipe.difficulty && (
            <span className={`px-3 py-1 rounded-full text-xs capitalize ${DIFFICULTY_COLOR[recipe.difficulty] || 'bg-slate-700 text-slate-300'}`}>
              {recipe.difficulty}
            </span>
          )}
          {(recipe.prep_time + recipe.cook_time) > 0 && (
            <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs flex items-center gap-1">
              <Clock size={11} /> {recipe.prep_time + recipe.cook_time} min
            </span>
          )}
          {recipe.servings > 0 && (
            <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs flex items-center gap-1">
              <Users size={11} /> {recipe.servings} servings
            </span>
          )}
        </div>

        {recipe.description && (
          <p dir="auto" className="text-slate-400 text-sm mb-5 leading-relaxed">{recipe.description}</p>
        )}

        {recipe.ingredients.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Ingredients</h2>
              <button
                onClick={addToShopping}
                disabled={adding}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors
                  ${added ? 'bg-green-700 text-green-100' : 'bg-sky-700 hover:bg-sky-600 text-white'}`}
              >
                <ShoppingCart size={14} />
                {added ? 'Added!' : adding ? 'Adding...' : 'Add to list'}
              </button>
            </div>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-2.5">
                  <span className="text-sky-400 text-xs font-mono w-5 text-center">{i + 1}</span>
                  <span dir="auto" className="flex-1 text-sm text-white">{ing.name}</span>
                  {ing.quantity && <span className="text-slate-400 text-sm">{ing.quantity}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {recipe.steps.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">Instructions</h2>
            <ol className="space-y-3">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-sky-600 rounded-full flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <p dir="auto" className="text-slate-300 text-sm leading-relaxed pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  )
}
