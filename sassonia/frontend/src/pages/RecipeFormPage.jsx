import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Plus, Trash2, Save, Camera, Loader2, ClipboardList, Link as LinkIcon, X } from 'lucide-react'
import { recipes as recipesApi } from '../api'
import { compressImage } from '../compressImage'

function parsePastedIngredients(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)
  return lines.map(line => {
    line = line.replace(/^[-•*]\s+/, '').replace(/^\d+[.)]\s+/, '').trim()
    const match = line.match(/^([\d.,]+\s*(?:kg|g|gr|l|ml|L|x|יח|יח'|כוס|כוסות|כף|כפות|כפית|כפיות|pcs?|units?|liters?|cups?|tbsp|tsp|oz|lb|pieces?)\.?\s*[xX×]?\s*)([\p{L}].*)/u)
    if (match) return { quantity: match[1].trim(), name: match[2].trim() }
    const matchEnd = line.match(/^([\p{L}].*?)\s+([\d.,]+\s*(?:kg|g|gr|l|ml|L|יח|כוס|כף|כפית|pcs?|oz|lb)\.?)$/u)
    if (matchEnd) return { name: matchEnd[1].trim(), quantity: matchEnd[2].trim() }
    return { name: line, quantity: '' }
  }).filter(i => i.name)
}

function parsePastedSteps(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)
  return lines.map(l => l.replace(/^\d+[.)]\s+/, '').replace(/^[-•*]\s+/, '').trim()).filter(Boolean)
}

const EMPTY = {
  name: '', category: '', prep_time: 0, cook_time: 0,
  servings: 4, difficulty: 'medium', description: '',
  ingredients: [{ name: '', quantity: '' }],
  steps: [''],
  source_url: ''
}

export default function RecipeFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')

  // Bulk paste dialogs
  const [showBulkIng, setShowBulkIng] = useState(false)
  const [bulkIngText, setBulkIngText] = useState('')
  const [showBulkSteps, setShowBulkSteps] = useState(false)
  const [bulkStepsText, setBulkStepsText] = useState('')

  // Detect Hebrew content
  const isHebrew = /[\u0590-\u05FF]/.test(
    form.name + ' ' +
    form.description + ' ' +
    form.ingredients.map(i => i.name).join(' ')
  ) || true

  useEffect(() => {
    if (location.state?.prefill) {
      const p = location.state.prefill
      setForm({
        ...EMPTY, ...p,
        ingredients: p.ingredients?.length ? p.ingredients : EMPTY.ingredients,
        steps: p.steps?.length ? p.steps : EMPTY.steps,
      })
      if (p.image_url) setImagePreview(p.image_url)
      if (location.state.imageFile) {
        setImageFile(location.state.imageFile)
        setImagePreview(URL.createObjectURL(location.state.imageFile))
      }
    } else if (isEdit) {
      recipesApi.get(id).then(r => {
        setForm({
          ...r,
          ingredients: r.ingredients.length ? r.ingredients : EMPTY.ingredients,
          steps: r.steps.length ? r.steps : EMPTY.steps,
        })
        if (r.image_path) setImagePreview(r.image_path)
      })
    }
  }, [id])

  // Support pasting image from clipboard (Ctrl+V)
  useEffect(() => {
    function handlePaste(e) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            setImageFile(file)
            setImagePreview(URL.createObjectURL(file))
          }
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function setIngredient(i, key, value) {
    const ing = [...form.ingredients]
    ing[i] = { ...ing[i], [key]: value }
    setField('ingredients', ing)
  }

  function setStep(i, value) {
    const steps = [...form.steps]
    steps[i] = value
    setField('steps', steps)
  }

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function applyBulkIngredients() {
    const parsed = parsePastedIngredients(bulkIngText)
    if (parsed.length > 0) {
      const current = form.ingredients.filter(i => i.name.trim())
      setField('ingredients', [...current, ...parsed])
    }
    setBulkIngText('')
    setShowBulkIng(false)
  }

  function applyBulkSteps() {
    const parsed = parsePastedSteps(bulkStepsText)
    if (parsed.length > 0) {
      const current = form.steps.filter(s => s.trim())
      setField('steps', [...current, ...parsed])
    }
    setBulkStepsText('')
    setShowBulkSteps(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return alert('נא להזין שם למתכון')
    setSaving(true)
    const payload = {
      ...form,
      prep_time: Number(form.prep_time) || 0,
      cook_time: Number(form.cook_time) || 0,
      servings: Number(form.servings) || 4,
      ingredients: form.ingredients.filter(i => i.name.trim()),
      steps: form.steps.filter(s => s.trim()),
      source_url: form.source_url || '',
    }
    try {
      const saved = isEdit
        ? await recipesApi.update(id, payload)
        : await recipesApi.create(payload)
      if (imageFile) {
        const optimized = await compressImage(imageFile)
        await recipesApi.uploadImage(saved.id, optimized)
      }
      navigate(`/recipes/${saved.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto max-w-2xl mx-auto px-3 sm:px-4 py-4 pb-16" dir={isHebrew ? 'rtl' : 'ltr'}>
      {/* Top Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-800 text-slate-300">
          {isHebrew ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
        </button>
        <h1 className="text-xl font-bold flex-1 text-white text-right">{isEdit ? 'עריכת מתכון' : 'מתכון חדש'}</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl font-bold text-sm text-white transition-colors disabled:opacity-50 shadow-md"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          שמור
        </button>
      </div>

      <div className="space-y-5">
        {/* Photo Upload Card */}
        <label className="block cursor-pointer">
          {imagePreview ? (
            <div className="relative group rounded-3xl overflow-hidden">
              <img src={imagePreview} alt="preview" className="w-full h-52 object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-semibold gap-2">
                <Camera size={18} /> לחץ להחלפת תמונה
              </div>
            </div>
          ) : (
            <div className="w-full h-44 bg-slate-900 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-slate-700 hover:bg-slate-850 transition-all">
              <Camera size={32} className="text-slate-500" />
              <span className="text-sm font-medium">הוסף תמונה (או הדבק צילום מסך עם Ctrl+V)</span>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </label>

        {/* Recipe Name */}
        <Field label="שם המתכון *">
          <input
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            placeholder="למשל: פסטה ברוטב עגבניות וריקוטה"
            dir={isHebrew ? 'rtl' : 'ltr'}
            className="input-field text-base font-medium text-right"
          />
        </Field>

        {/* Category & Difficulty */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="קטגוריה">
            <select value={form.category} onChange={e => setField('category', e.target.value)} className="input-field text-right">
              <option value="">בחר קטגוריה...</option>
              {['עיקרית', 'קינוח', 'סלט', 'מרק', 'ארוחת בוקר', 'מאפה', 'נשנוש', 'אחר'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="רמת קושי">
            <select value={form.difficulty} onChange={e => setField('difficulty', e.target.value)} className="input-field text-right">
              <option value="easy">קל</option>
              <option value="medium">בינוני</option>
              <option value="hard">מורכב</option>
            </select>
          </Field>
        </div>

        {/* Times & Servings */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="הכנה (דק׳)">
            <input type="number" value={form.prep_time} onChange={e => setField('prep_time', e.target.value)}
              className="input-field text-center font-mono" min="0" />
          </Field>
          <Field label="בישול (דק׳)">
            <input type="number" value={form.cook_time} onChange={e => setField('cook_time', e.target.value)}
              className="input-field text-center font-mono" min="0" />
          </Field>
          <Field label="מנות">
            <input type="number" value={form.servings} onChange={e => setField('servings', e.target.value)}
              className="input-field text-center font-mono" min="1" />
          </Field>
        </div>

        {/* Description */}
        <Field label="תיאור קצר">
          <textarea
            value={form.description}
            onChange={e => setField('description', e.target.value)}
            rows={2}
            placeholder="תיאור כללי, טיפים או הערות חשובות..."
            dir={isHebrew ? 'rtl' : 'ltr'}
            className="input-field resize-none text-sm text-right"
          />
        </Field>

        {/* Source URL */}
        <Field label="קישור למקור המתכון (אופציונלי)">
          <div className="relative">
            <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={form.source_url || ''}
              onChange={e => setField('source_url', e.target.value)}
              placeholder="https://..."
              dir="ltr"
              className="input-field pl-9 font-mono text-xs"
            />
          </div>
        </Field>

        {/* Section: Ingredients */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-3 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-base font-bold text-white">מרכיבים</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowBulkIng(v => !v)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 flex items-center gap-1 transition-colors"
              >
                <ClipboardList size={14} /> הדבקה מהירה
              </button>
              <button
                type="button"
                onClick={() => setField('ingredients', [...form.ingredients, { name: '', quantity: '' }])}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1 transition-colors"
              >
                <Plus size={14} /> הוסף מצרך
              </button>
            </div>
          </div>

          {/* Bulk Paste Box */}
          {showBulkIng && (
            <div className="mb-4 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 animate-fadeIn">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-slate-300">הדבק רשימת מצרכים (שורה לכל מצרך):</span>
                <button onClick={() => setShowBulkIng(false)} className="text-slate-400 hover:text-white"><X size={14} /></button>
              </div>
              <textarea
                value={bulkIngText}
                onChange={e => setBulkIngText(e.target.value)}
                placeholder={"2 כוסות קמח\n1 כפית מלח\n100 גרם חמאה"}
                rows={4}
                dir="rtl"
                className="input-field text-xs font-mono mb-2 text-right"
                autoFocus
              />
              <button
                type="button"
                onClick={applyBulkIngredients}
                className="w-full py-2 bg-sky-600 hover:bg-sky-500 rounded-xl text-xs font-bold text-white transition-colors"
              >
                הוסף מצרכים מהטקסט
              </button>
            </div>
          )}

          <div className="space-y-2.5">
            {form.ingredients.map((ing, i) => (
              <div
                key={i}
                className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-2.5 sm:p-3 transition-all focus-within:border-sky-500/70 focus-within:bg-slate-800/90 shadow-sm"
              >
                {/* Line 1: Number + Full-width ingredient name + Delete button */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-500 w-5 flex-shrink-0 text-center">
                    {i + 1}
                  </span>
                  <input
                    value={ing.name}
                    onChange={e => setIngredient(i, 'name', e.target.value)}
                    placeholder="שם המצרך (למשל: קמח כוסמין מלא)"
                    dir={isHebrew ? 'rtl' : 'ltr'}
                    className="bg-slate-900/90 border border-slate-700/70 rounded-xl px-3 py-2 text-sm font-medium text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 flex-1 min-w-0 text-right"
                  />
                  <button
                    type="button"
                    onClick={() => setField('ingredients', form.ingredients.filter((_, j) => j !== i))}
                    className="text-slate-500 hover:text-red-400 p-2 transition-colors rounded-lg hover:bg-slate-700/50 flex-shrink-0"
                    title="מחק מצרך"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Line 2: Quantity field */}
                <div className="flex items-center gap-2 pr-7">
                  <span className="text-xs font-semibold text-slate-400 flex-shrink-0">
                    כמות:
                  </span>
                  <input
                    value={ing.quantity}
                    onChange={e => setIngredient(i, 'quantity', e.target.value)}
                    placeholder="למשל: 2 כוסות / 250 גרם (אופציונלי)"
                    dir={isHebrew ? 'rtl' : 'ltr'}
                    className="bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-1.5 text-xs font-medium text-sky-300 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 flex-1 text-right"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Steps */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-3 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-base font-bold text-white">הוראות הכנה</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowBulkSteps(v => !v)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 flex items-center gap-1 transition-colors"
              >
                <ClipboardList size={14} /> הדבקה מהירה
              </button>
              <button
                type="button"
                onClick={() => setField('steps', [...form.steps, ''])}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1 transition-colors"
              >
                <Plus size={14} /> הוסף שלב
              </button>
            </div>
          </div>

          {/* Bulk Paste Box for Steps */}
          {showBulkSteps && (
            <div className="mb-4 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 animate-fadeIn">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-slate-300">הדבק שלבי הכנה (שורה לכל שלב):</span>
                <button onClick={() => setShowBulkSteps(false)} className="text-slate-400 hover:text-white"><X size={14} /></button>
              </div>
              <textarea
                value={bulkStepsText}
                onChange={e => setBulkStepsText(e.target.value)}
                placeholder={"1. לחמם תנור ל-180 מעלות\n2. לערבב את החומרים היבשים\n3. לאפות במשך 25 דקות"}
                rows={4}
                dir="rtl"
                className="input-field text-xs font-mono mb-2 text-right"
                autoFocus
              />
              <button
                type="button"
                onClick={applyBulkSteps}
                className="w-full py-2 bg-sky-600 hover:bg-sky-500 rounded-xl text-xs font-bold text-white transition-colors"
              >
                הוסף שלבים מהטקסט
              </button>
            </div>
          )}

          <div className="space-y-3">
            {form.steps.map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="w-7 h-7 bg-sky-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-2">
                  {i + 1}
                </span>
                <textarea
                  value={step}
                  onChange={e => setStep(i, e.target.value)}
                  placeholder={`שלב ${i + 1}...`}
                  rows={2}
                  dir={isHebrew ? 'rtl' : 'ltr'}
                  className="input-field flex-1 resize-none text-sm leading-relaxed text-right"
                />
                <button
                  type="button"
                  onClick={() => setField('steps', form.steps.filter((_, j) => j !== i))}
                  className="text-slate-500 hover:text-red-400 p-2 mt-2 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-300 mb-1.5 text-right">{label}</label>
      {children}
    </div>
  )
}
