import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit, Trash2, ShoppingCart, Clock, Users,
  ChefHat, CheckCircle2, Circle, Flame, ExternalLink, Plus, Minus, Check
} from 'lucide-react'
import { recipes as recipesApi, shopping } from '../api'
import CookingModeModal from './CookingModeModal'

const DIFFICULTY_COLOR = {
  easy: 'bg-green-950/80 text-green-300 border-green-800/40',
  medium: 'bg-yellow-950/80 text-yellow-300 border-yellow-800/40',
  hard: 'bg-red-950/80 text-red-300 border-red-800/40'
}

// Intelligent quantity scaling helper
function scaleQuantity(qtyStr, ratio) {
  if (!qtyStr || ratio === 1) return qtyStr
  // Match numbers or simple fractions like 1/2, 3/4, or decimals
  return qtyStr.replace(/(\d+\/\d+|\d+(?:\.\d+)?)/g, (match) => {
    let val
    if (match.includes('/')) {
      const [n, d] = match.split('/')
      val = parseFloat(n) / parseFloat(d)
    } else {
      val = parseFloat(match)
    }
    if (isNaN(val)) return match
    const scaled = val * ratio
    // Format cleanly
    if (Number.isInteger(scaled)) return scaled.toString()
    if (Math.abs(scaled - 0.5) < 0.05) return '1/2'
    if (Math.abs(scaled - 0.25) < 0.05) return '1/4'
    if (Math.abs(scaled - 0.75) < 0.05) return '3/4'
    return Number(scaled.toFixed(1)).toString()
  })
}

export default function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState(null)
  const [servings, setServings] = useState(4)
  const [checkedIngredients, setCheckedIngredients] = useState({})
  const [checkedSteps, setCheckedSteps] = useState({})
  const [cookingMode, setCookingMode] = useState(false)
  const [addingToShop, setAddingToShop] = useState(false)
  const [addedToShop, setAddedToShop] = useState(false)
  const [shoppingLists, setShoppingLists] = useState([])
  const [selectedList, setSelectedList] = useState('סופר')
  const [showListSelector, setShowListSelector] = useState(false)

  useEffect(() => {
    recipesApi.get(id).then(r => {
      setRecipe(r)
      setServings(r.servings || 4)
    })
    shopping.getLists().then(lists => {
      if (lists?.length) {
        setShoppingLists(lists)
        setSelectedList(lists[0].name)
      }
    }).catch(() => {})
  }, [id])

  // Compute dynamically scaled ingredients
  const scaledIngredients = useMemo(() => {
    if (!recipe?.ingredients) return []
    const baseServings = recipe.servings || 4
    const ratio = servings / baseServings
    return recipe.ingredients.map(ing => ({
      ...ing,
      quantity: scaleQuantity(ing.quantity, ratio)
    }))
  }, [recipe, servings])

  async function handleDelete() {
    if (!confirm('האם למחוק את המתכון לצמיתות?')) return
    await recipesApi.delete(id)
    navigate('/recipes')
  }

  async function addToShopping(listName) {
    setAddingToShop(true)
    const items = scaledIngredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity || '',
      list_name: listName || selectedList
    }))
    await shopping.addBulk(items)
    setAddingToShop(false)
    setAddedToShop(true)
    setShowListSelector(false)
    setTimeout(() => setAddedToShop(false), 3000)
  }

  function toggleIngredient(idx) {
    setCheckedIngredients(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  function toggleStep(idx) {
    setCheckedSteps(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  if (!recipe) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)
  const isHebrew = /[\u0590-\u05FF]/.test((recipe.name || '') + ' ' + (recipe.description || '')) || true

  return (
    <div className="h-full overflow-y-auto max-w-2xl mx-auto pb-12" dir={isHebrew ? 'rtl' : 'ltr'}>
      {/* Top Hero Image & Actions */}
      <div className="relative">
        {recipe.image_path ? (
          <img src={recipe.image_path} alt={recipe.name} className="w-full h-64 object-cover" />
        ) : (
          <div className="w-full h-64 bg-slate-800 flex items-center justify-center">
            <ChefHat size={64} className="text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => navigate('/recipes')}
          className="absolute top-4 start-4 bg-slate-900/80 backdrop-blur p-2.5 rounded-full text-slate-200 hover:text-white transition-colors"
          title="חזרה"
        >
          <ArrowLeft size={20} className={isHebrew ? 'rotate-180' : ''} />
        </button>

        {/* Top Action Buttons (opposite side) */}
        <div className="absolute top-4 end-4 flex gap-2">
          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-900/80 backdrop-blur p-2.5 rounded-full text-slate-300 hover:text-white transition-colors"
              title="מתכון מקורי"
            >
              <ExternalLink size={18} />
            </a>
          )}
          <button
            onClick={() => navigate(`/recipes/${id}/edit`)}
            className="bg-slate-900/80 backdrop-blur p-2.5 rounded-full text-slate-300 hover:text-white transition-colors"
            title="עריכת מתכון"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={handleDelete}
            className="bg-slate-900/80 backdrop-blur p-2.5 rounded-full text-red-400 hover:text-red-300 transition-colors"
            title="מחיקת מתכון"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Title & Metadata over Hero bottom */}
        <div className="absolute bottom-4 left-4 right-4">
          <h1 dir="auto" className="text-2xl sm:text-3xl font-extrabold text-white mb-2 drop-shadow-md">
            {recipe.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {recipe.category && (
              <span className="bg-slate-800/90 text-slate-200 px-3 py-1 rounded-full text-xs font-medium border border-slate-700">
                {recipe.category}
              </span>
            )}
            {recipe.difficulty && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize border ${DIFFICULTY_COLOR[recipe.difficulty] || 'bg-slate-800 text-slate-300'}`}>
                {recipe.difficulty}
              </span>
            )}
            {totalTime > 0 && (
              <span className="bg-slate-800/90 text-slate-200 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 border border-slate-700">
                <Clock size={12} /> {totalTime} דק׳
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-6">
        {/* Big Prominent Cooking Mode Button */}
        <button
          onClick={() => setCookingMode(true)}
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-[0.99] transition-all"
        >
          <Flame size={24} className="animate-bounce" />
          <span>מצב הכנה (מסך דולק קבוע)</span>
        </button>

        {recipe.description && (
          <p dir="auto" className="text-slate-300 text-sm leading-relaxed bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
            {recipe.description}
          </p>
        )}

        {/* Servings Scaler Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200">
            <Users size={18} className="text-sky-400" />
            <span className="text-sm font-semibold">כמות מנות:</span>
            <span className="text-sm font-bold text-sky-400">{servings}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setServings(s => Math.max(1, s - 1))}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition-all"
            >
              <Minus size={15} />
            </button>
            <span className="w-6 text-center text-sm font-mono font-bold text-white">{servings}</span>
            <button
              onClick={() => setServings(s => s + 1)}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition-all"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* Section 1: Ingredients Card */}
        {scaledIngredients.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">מצרכים</h2>
                <span className="text-xs text-slate-400">לחץ לסימון מצרך שהוכן</span>
              </div>

              {/* Add to shopping list */}
              <div className="relative">
                <button
                  onClick={() => setShowListSelector(v => !v)}
                  disabled={addingToShop}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    addedToShop ? 'bg-green-600 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white'
                  }`}
                >
                  <ShoppingCart size={15} />
                  {addedToShop ? 'נוסף בהצלחה!' : addingToShop ? 'מוסיף...' : 'הוסף לקניות'}
                </button>

                {showListSelector && (
                  <div className="absolute left-0 mt-2 w-48 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-2 z-30">
                    <p className="text-xs text-slate-400 px-2 py-1 font-medium">בחר רשימת יעד:</p>
                    {shoppingLists.map(l => (
                      <button
                        key={l.id}
                        onClick={() => addToShopping(l.name)}
                        className="w-full text-right px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                      >
                        <span>{l.name}</span>
                        {selectedList === l.name && <Check size={14} className="text-sky-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <ul className="space-y-2">
              {scaledIngredients.map((ing, i) => {
                const isChecked = checkedIngredients[i]
                return (
                  <li
                    key={i}
                    onClick={() => toggleIngredient(i)}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer transition-colors ${
                      isChecked ? 'bg-slate-800/40 opacity-50' : 'bg-slate-800 hover:bg-slate-800/80'
                    }`}
                  >
                    <button className="flex-shrink-0">
                      {isChecked ? (
                        <CheckCircle2 size={20} className="text-sky-500" />
                      ) : (
                        <Circle size={20} className="text-slate-500" />
                      )}
                    </button>
                    <span dir="auto" className={`flex-1 text-sm font-medium ${isChecked ? 'line-through text-slate-500' : 'text-white'}`}>
                      {ing.name}
                    </span>
                    {ing.quantity && (
                      <span dir="auto" className={`text-sm font-semibold ${isChecked ? 'text-slate-500' : 'text-sky-400'}`}>
                        {ing.quantity}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Section 2: Instructions Card */}
        {recipe.steps.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-white mb-4">הוראות הכנה</h2>
            <ol className="space-y-3">
              {recipe.steps.map((step, i) => {
                const isStepDone = checkedSteps[i]
                return (
                  <li
                    key={i}
                    onClick={() => toggleStep(i)}
                    className={`flex gap-3 p-4 rounded-2xl cursor-pointer border transition-all ${
                      isStepDone
                        ? 'bg-slate-800/30 border-slate-800/40 opacity-50'
                        : 'bg-slate-800 border-slate-750 hover:border-slate-700'
                    }`}
                  >
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isStepDone ? 'bg-green-700 text-white' : 'bg-sky-600 text-white'
                    }`}>
                      {i + 1}
                    </span>
                    <p dir="auto" className={`flex-1 text-sm sm:text-base leading-relaxed pt-0.5 ${
                      isStepDone ? 'line-through text-slate-500' : 'text-slate-200 font-normal'
                    }`}>
                      {step}
                    </p>
                  </li>
                )
              })}
            </ol>
          </section>
        )}
      </div>

      {/* Cooking Mode Fullscreen Overlay */}
      {cookingMode && (
        <CookingModeModal
          recipe={recipe}
          scaledIngredients={scaledIngredients}
          onClose={() => setCookingMode(false)}
        />
      )}
    </div>
  )
}
