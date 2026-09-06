import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Sparkles, ChefHat, Clock, Users, Plus, Check,
  AlertCircle, ChevronDown, ChevronUp, BookOpen, ExternalLink,
  Flame, ShoppingCart, Loader2, BookmarkPlus, CheckCircle2
} from 'lucide-react'
import { gemini, recipes as recipesApi, shopping as shoppingApi } from '../api'

const QUICK_INGREDIENTS = [
  'ביצים', 'עגבניות', 'בצל', 'תפו״א', 'פסטה', 'אורז',
  'גבינה צהובה', 'שום', 'שמן זית', 'טונה', 'פטריות',
  'שמנת', 'חזה עוף', 'קישואים', 'פלפלים', 'חמאה'
]

export default function WhatToCookModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [selectedIngredients, setSelectedIngredients] = useState(['ביצים', 'עגבניות'])
  const [customInput, setCustomInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null) // { local_recipes, ai_recipes }
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'local' | 'ai'
  const [expandedAiRecipe, setExpandedAiRecipe] = useState(null)
  const [savingRecipeIdx, setSavingRecipeIdx] = useState(null)
  const [savedSuccessIdx, setSavedSuccessIdx] = useState({})
  const [importingShopping, setImportingShopping] = useState(false)

  if (!isOpen) return null

  function toggleQuick(ing) {
    if (selectedIngredients.includes(ing)) {
      setSelectedIngredients(prev => prev.filter(i => i !== ing))
    } else {
      setSelectedIngredients(prev => [...prev, ing])
    }
  }

  function addCustom(e) {
    e?.preventDefault()
    const trimmed = customInput.trim()
    if (!trimmed) return
    const parts = trimmed.split(/[,،\n]+/).map(p => p.trim()).filter(Boolean)
    const newItems = parts.filter(p => !selectedIngredients.includes(p))
    if (newItems.length > 0) {
      setSelectedIngredients(prev => [...prev, ...newItems])
    }
    setCustomInput('')
  }

  function removeIngredient(ing) {
    setSelectedIngredients(prev => prev.filter(i => i !== ing))
  }

  async function importFromShoppingList() {
    setImportingShopping(true)
    try {
      const items = await shoppingApi.list('סופר')
      if (items?.length) {
        // take unchecked or all item names
        const names = items.map(i => i.name.trim()).filter(Boolean)
        const newOnes = names.filter(n => !selectedIngredients.includes(n))
        setSelectedIngredients(prev => [...prev, ...newOnes])
      }
    } catch (e) {
      console.warn('Could not import shopping items:', e)
    } finally {
      setImportingShopping(false)
    }
  }

  async function handleSearch() {
    if (!selectedIngredients.length) return
    setLoading(true)
    setResults(null)
    try {
      const data = await gemini.whatToCook(selectedIngredients)
      setResults(data)
      // default tab: if local found, show local, else ai
      if (data.local_recipes?.length) {
        setActiveTab('local')
      } else {
        setActiveTab('ai')
      }
    } catch (err) {
      alert('אירעה שגיאה בחיפוש מתכונים. אנא נסה שוב.')
    } finally {
      setLoading(false)
    }
  }

  async function saveAiRecipe(recipe, idx) {
    setSavingRecipeIdx(idx)
    try {
      const payload = {
        name: recipe.name,
        category: recipe.category || 'עיקרית',
        prep_time: recipe.prep_time || 15,
        cook_time: recipe.cook_time || 20,
        servings: recipe.servings || 4,
        difficulty: recipe.difficulty || 'easy',
        description: recipe.description || '',
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || [],
        source_url: '',
      }
      const saved = await recipesApi.create(payload)
      setSavedSuccessIdx(prev => ({ ...prev, [idx]: saved.id }))
    } catch (e) {
      alert('שגיאה בשמירת המתכון')
    } finally {
      setSavingRecipeIdx(null)
    }
  }

  const localCount = results?.local_recipes?.length || 0
  const aiCount = results?.ai_recipes?.length || 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-800 flex-shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-white">מה נבשל היום? 🍳</h2>
              <p className="text-xs text-slate-400">הזן מצרכים שיש במקרר ונמצא מה להכין</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Ingredient Selector Box */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200">
                מצרכים זמינים ({selectedIngredients.length}):
              </label>
              <button
                onClick={importFromShoppingList}
                disabled={importingShopping}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition-colors"
                title="הוסף מצרכים מרשימת הקניות של הסופר"
              >
                {importingShopping ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={13} />}
                <span>ייבא מהסופר</span>
              </button>
            </div>

            {/* Selected Pills */}
            <div className="flex flex-wrap gap-1.5 min-h-[36px] items-center">
              {selectedIngredients.length === 0 ? (
                <span className="text-xs text-slate-500 italic">לא נבחרו מצרכים עדיין</span>
              ) : (
                selectedIngredients.map(ing => (
                  <span
                    key={ing}
                    className="inline-flex items-center gap-1.5 bg-sky-950/80 text-sky-300 border border-sky-700/50 px-2.5 py-1 rounded-xl text-xs font-medium animate-fadeIn"
                  >
                    <span>{ing}</span>
                    <button
                      onClick={() => removeIngredient(ing)}
                      className="hover:text-red-400 text-sky-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Custom Free Text Input */}
            <form onSubmit={addCustom} className="flex gap-2">
              <input
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                placeholder="הקלד מצרך נוסף (ולחץ Enter)..."
                dir="auto"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-0"
              />
              <button
                type="submit"
                disabled={!customInput.trim()}
                className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Plus size={14} /> הוסף
              </button>
            </form>

            {/* Quick Tap Chips */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 mb-1.5">הוספה מהירה בלחיצה:</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_INGREDIENTS.map(ing => {
                  const isSelected = selectedIngredients.includes(ing)
                  return (
                    <button
                      key={ing}
                      onClick={() => toggleQuick(ing)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-300 border border-slate-700/50 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {ing}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSearch}
              disabled={loading || selectedIngredients.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>שף ה-AI בודק ומחפש מתכונים...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>מצא מה לבשל!</span>
                </>
              )}
            </button>
          </div>

          {/* Results Area */}
          {results && (
            <div className="space-y-3 animate-fadeIn">
              {/* Tabs */}
              <div className="flex border-b border-slate-800">
                <button
                  onClick={() => setActiveTab('local')}
                  className={`flex-1 py-2.5 text-xs sm:text-sm font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                    activeTab === 'local'
                      ? 'text-emerald-400 border-emerald-400'
                      : 'text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  <BookOpen size={16} />
                  <span>מהספר שלך ({localCount})</span>
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`flex-1 py-2.5 text-xs sm:text-sm font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                    activeTab === 'ai'
                      ? 'text-amber-400 border-amber-400'
                      : 'text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  <Sparkles size={16} />
                  <span>הצעות AI אמיתיות ({aiCount})</span>
                </button>
              </div>

              {/* Tab 1: Local Recipes */}
              {activeTab === 'local' && (
                <div className="space-y-2.5">
                  {localCount === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-800/30 rounded-2xl p-4">
                      <ChefHat size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">לא נמצאו מתכונים תואמים בספר האישי שלך.</p>
                      <p className="text-xs mt-1 text-slate-400">
                        עבור ללשונית <strong className="text-amber-400">הצעות AI אמיתיות</strong> כדי לראות מתכונים מוכרים שתוכל להכין עכשיו!
                      </p>
                    </div>
                  ) : (
                    results.local_recipes.map(recipe => (
                      <div
                        key={recipe.id}
                        className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-3.5 space-y-2 hover:border-slate-600 transition-all shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-base text-white">{recipe.name}</h4>
                              {recipe.category && (
                                <span className="text-[10px] font-semibold bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                                  {recipe.category}
                                </span>
                              )}
                            </div>
                            {recipe.description && (
                              <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{recipe.description}</p>
                            )}
                          </div>

                          {/* Match Percent Badge */}
                          <div className="flex-shrink-0 text-left">
                            <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {recipe.match_percent}% התאמה
                            </span>
                          </div>
                        </div>

                        {/* Ingredients status */}
                        <div className="space-y-1 text-xs">
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[11px] text-emerald-400 font-semibold">יש לך:</span>
                            {recipe.matched_ingredients.map((ing, i) => (
                              <span key={i} className="bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded-md text-[11px]">
                                ✓ {ing}
                              </span>
                            ))}
                          </div>
                          {recipe.missing_ingredients?.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center pt-0.5">
                              <span className="text-[11px] text-slate-400 font-semibold">חסר:</span>
                              {recipe.missing_ingredients.slice(0, 4).map((ing, i) => (
                                <span key={i} className="bg-slate-900/60 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded-md text-[10px]">
                                  {ing}
                                </span>
                              ))}
                              {recipe.missing_ingredients.length > 4 && (
                                <span className="text-[10px] text-slate-500">+{recipe.missing_ingredients.length - 4} נוספים</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="pt-1 flex justify-end">
                          <button
                            onClick={() => {
                              onClose()
                              navigate(`/recipes/${recipe.id}`)
                            }}
                            className="text-xs font-bold px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1 transition-colors"
                          >
                            <span>פתח מתכון</span>
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 2: AI Real Recipes */}
              {activeTab === 'ai' && (
                <div className="space-y-3">
                  {aiCount === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      לא התקבלו הצעות. נסה להוסיף מצרכים נוספים.
                    </div>
                  ) : (
                    results.ai_recipes.map((recipe, idx) => {
                      const isExpanded = expandedAiRecipe === idx
                      const isSaving = savingRecipeIdx === idx
                      const savedId = savedSuccessIdx[idx]

                      return (
                        <div
                          key={idx}
                          className="bg-slate-800/90 border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-base text-white">{recipe.name}</h4>
                                <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                  מתכון אמיתי מה-AI ✨
                                </span>
                                {recipe.category && (
                                  <span className="text-[10px] font-semibold bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                                    {recipe.category}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                {recipe.description}
                              </p>
                            </div>
                          </div>

                          {/* Matching vs Missing Ingredients */}
                          <div className="bg-slate-900/60 rounded-xl p-2.5 space-y-1.5 text-xs">
                            {recipe.matching_ingredients?.length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className="text-[11px] text-emerald-400 font-semibold">מהמצרכים שלך:</span>
                                {recipe.matching_ingredients.map((ing, i) => (
                                  <span key={i} className="bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded-md text-[11px]">
                                    ✓ {ing}
                                  </span>
                                ))}
                              </div>
                            )}
                            {recipe.missing_ingredients?.length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className="text-[11px] text-amber-400 font-semibold">להשלים בבית:</span>
                                {recipe.missing_ingredients.map((ing, i) => (
                                  <span key={i} className="bg-amber-950/40 text-amber-300 border border-amber-800/30 px-2 py-0.5 rounded-md text-[11px]">
                                    + {ing}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Accordion for Full Ingredients & Steps */}
                          <div>
                            <button
                              onClick={() => setExpandedAiRecipe(isExpanded ? null : idx)}
                              className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
                            >
                              <span>{isExpanded ? 'הסתר מצרכים והוראות' : 'הצג מצרכים והוראות הכנה מלאות'}</span>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-3 text-xs animate-fadeIn">
                                <div>
                                  <h5 className="font-bold text-white mb-1.5">מצרכים:</h5>
                                  <ul className="list-disc list-inside space-y-0.5 text-slate-300 pr-1">
                                    {recipe.ingredients.map((ing, i) => (
                                      <li key={i}>
                                        <span className="font-medium text-white">{ing.name}</span>
                                        {ing.quantity && <span className="text-sky-400 mr-1.5">({ing.quantity})</span>}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div>
                                  <h5 className="font-bold text-white mb-1.5">הוראות הכנה:</h5>
                                  <ol className="list-decimal list-inside space-y-1 text-slate-300 pr-1">
                                    {recipe.steps.map((step, i) => (
                                      <li key={i} className="leading-relaxed">{step}</li>
                                    ))}
                                  </ol>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Actions: Save to Cookbook */}
                          <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-700/40">
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <Clock size={12} />
                              <span>{(recipe.prep_time || 0) + (recipe.cook_time || 0)} דק׳</span>
                              <span>•</span>
                              <Users size={12} />
                              <span>{recipe.servings || 4} מנות</span>
                            </div>

                            {savedId ? (
                              <button
                                onClick={() => {
                                  onClose()
                                  navigate(`/recipes/${savedId}`)
                                }}
                                className="text-xs font-bold px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl flex items-center gap-1.5 transition-colors"
                              >
                                <CheckCircle2 size={14} />
                                <span>נשמר בספר! פתח מתכון</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => saveAiRecipe(recipe, idx)}
                                disabled={isSaving}
                                className="text-xs font-bold px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                              >
                                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <BookmarkPlus size={14} />}
                                <span>שמור לספר המתכונים שלי</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
