import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Camera, Image, ChefHat, Clock, Loader2,
  Link as LinkIcon, PenTool, X, Sparkles, ExternalLink
} from 'lucide-react'
import { recipes as recipesApi, gemini } from '../api'
import WhatToCookModal from './WhatToCookModal'

const CATEGORIES = ['הכל', 'עיקרית', 'קינוח', 'סלט', 'מרק', 'ארוחת בוקר', 'מאפה', 'נשנוש', 'אחר']
const DIFFICULTY_COLOR = {
  easy: 'text-green-400 bg-green-950/60 border-green-800/40',
  medium: 'text-yellow-400 bg-yellow-950/60 border-yellow-800/40',
  hard: 'text-red-400 bg-red-950/60 border-red-800/40'
}

export default function RecipesPage() {
  const navigate = useNavigate()
  const [recipeList, setRecipeList] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('הכל')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showWhatToCook, setShowWhatToCook] = useState(false)

  // URL import state
  const [urlInput, setUrlInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractLoadingText, setExtractLoadingText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    recipesApi.list().then(setRecipeList)
  }, [])

  const filtered = recipeList.filter(r => {
    const matchSearch = (r.name || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'הכל' || r.category === category
    return matchSearch && matchCat
  })

  async function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setExtracting(true)
    setExtractLoadingText('סורק ומנתח תמונה עם Gemini AI...')
    setError('')
    try {
      const data = await gemini.extractRecipe(file)
      setShowAddModal(false)
      navigate('/recipes/new', { state: { prefill: data, imageFile: file } })
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(detail ? `הסריקה נכשלה: ${detail}` : 'לא הצלחנו לחלץ מתכון מהתמונה. נסה תמונה ברורה יותר.')
    } finally {
      setExtracting(false)
    }
  }

  async function handleUrlExtract(e) {
    e.preventDefault()
    if (!urlInput.trim()) return
    setExtracting(true)
    setExtractLoadingText('שואב ומנתח את המתכון מהקישור...')
    setError('')
    try {
      const data = await gemini.extractFromUrl(urlInput.trim())
      setShowAddModal(false)
      navigate('/recipes/new', { state: { prefill: data } })
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(detail ? `חילוץ מקישור נכשל: ${detail}` : 'לא ניתן היה לקרוא את המתכון מהקישור שהוזן.')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex-shrink-0 bg-slate-900 z-10 px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ChefHat className="text-sky-400" size={28} /> ספר מתכונים
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWhatToCook(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 rounded-xl text-xs sm:text-sm font-bold text-slate-950 transition-all shadow-md active:scale-95"
              title="הצעות מתכונים לפי מה שיש במקרר"
            >
              <Sparkles size={16} /> מה נבשל?
            </button>
            <button
              onClick={() => { setShowAddModal(true); setError('') }}
              className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 rounded-xl text-xs sm:text-sm font-bold text-white transition-colors shadow-md active:scale-95"
            >
              <Plus size={18} /> הוסף מתכון
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש מתכון..."
            dir="auto"
            className="w-full bg-slate-800 text-white rounded-xl pr-10 pl-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 border border-slate-700/60"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex-shrink-0 px-3.5 py-1 rounded-full text-xs font-semibold transition-colors
                ${category === cat ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {error && !showAddModal && <p className="text-red-400 text-xs px-4 pt-3">{error}</p>}

      {/* Catalog Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-slate-500 py-20">
            <ChefHat size={54} className="mx-auto mb-3 opacity-25" />
            <p className="text-base font-semibold text-slate-400">אין מתכונים להצגה.</p>
            <p className="text-xs mt-1 text-slate-500">הוסף מתכון חדש מקישור, צילום או הקלדה.</p>
          </div>
        )}

        {filtered.map(r => {
          const totalTime = (r.prep_time || 0) + (r.cook_time || 0)
          return (
            <button
              key={r.id}
              onClick={() => navigate(`/recipes/${r.id}`)}
              className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden text-right hover:border-slate-700 hover:bg-slate-850 transition-all flex flex-col active:scale-95 group shadow-sm"
            >
              <div className="w-full h-32 bg-slate-800 relative overflow-hidden flex items-center justify-center">
                {r.image_path ? (
                  <img src={r.image_path} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <ChefHat size={32} className="text-slate-600" />
                )}
                {r.category && (
                  <span className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-sm text-slate-200 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-700">
                    {r.category}
                  </span>
                )}
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between w-full">
                <p dir="auto" className="font-bold text-sm text-white line-clamp-1 mb-1.5">{r.name}</p>
                <div className="flex items-center justify-between text-xs mt-auto">
                  {totalTime > 0 ? (
                    <span className="text-slate-400 flex items-center gap-1 font-mono text-[11px]">
                      <Clock size={11} /> {totalTime} דק׳
                    </span>
                  ) : <span />}
                  {r.difficulty && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${DIFFICULTY_COLOR[r.difficulty] || 'text-slate-400'}`}>
                      {r.difficulty === 'easy' ? 'קל' : r.difficulty === 'medium' ? 'בינוני' : 'מורכב'}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Add Recipe Multi-Channel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !extracting && setShowAddModal(false)}>
          <div
            className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 shadow-2xl animate-slideUp sm:animate-fadeIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-amber-400" /> הוספת מתכון
              </h2>
              <button
                disabled={extracting}
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30"
              >
                <X size={20} />
              </button>
            </div>

            {extracting ? (
              <div className="py-12 text-center space-y-4">
                <Loader2 size={40} className="animate-spin mx-auto text-sky-400" />
                <p className="text-sm font-medium text-slate-200">{extractLoadingText}</p>
                <p className="text-xs text-slate-400">זה לוקח בדרך כלל כמה שניות...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {error && <p className="text-red-400 text-xs bg-red-950/40 p-2.5 rounded-xl border border-red-900/50">{error}</p>}

                {/* Option 1: URL Extract */}
                <form onSubmit={handleUrlExtract} className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                    <LinkIcon size={14} /> שאיבה מקישור באינטרנט
                  </div>
                  <input
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="הדבק כאן לינק לאתר מתכונים..."
                    className="input-field text-xs font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!urlInput.trim()}
                    className="w-full py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl text-xs font-bold text-white transition-colors"
                  >
                    שאב מתכון מהאתר ⚡
                  </button>
                </form>

                {/* Option 2: Image / Screenshot Scan */}
                <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Camera size={14} /> סריקה מצילום / צילום מסך
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="cursor-pointer py-2.5 px-3 bg-slate-700 hover:bg-slate-650 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-colors border border-slate-600">
                      <Camera size={15} /> צלם במצלמה
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                    </label>
                    <label className="cursor-pointer py-2.5 px-3 bg-slate-700 hover:bg-slate-650 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-colors border border-slate-600">
                      <Image size={15} /> בחר מגלריה
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>

                {/* Option 3: Manual Entry */}
                <button
                  onClick={() => { setShowAddModal(false); navigate('/recipes/new') }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                >
                  <PenTool size={14} /> הקלדה ידנית נקייה
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* What to Cook Modal */}
      <WhatToCookModal
        isOpen={showWhatToCook}
        onClose={() => setShowWhatToCook(false)}
      />
    </div>
  )
}
