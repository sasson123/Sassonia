import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Save, Camera, Loader2 } from 'lucide-react'
import { recipes as recipesApi } from '../api'

const EMPTY = {
  name: '', category: '', prep_time: 0, cook_time: 0,
  servings: 4, difficulty: 'medium', description: '',
  ingredients: [{ name: '', quantity: '' }],
  steps: ['']
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

  useEffect(() => {
    if (location.state?.prefill) {
      const p = location.state.prefill
      setForm({
        ...EMPTY, ...p,
        ingredients: p.ingredients?.length ? p.ingredients : EMPTY.ingredients,
        steps: p.steps?.length ? p.steps : EMPTY.steps,
      })
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

  async function handleSave() {
    if (!form.name.trim()) return alert('Recipe name is required')
    setSaving(true)
    const payload = {
      ...form,
      prep_time: Number(form.prep_time) || 0,
      cook_time: Number(form.cook_time) || 0,
      servings: Number(form.servings) || 4,
      ingredients: form.ingredients.filter(i => i.name.trim()),
      steps: form.steps.filter(s => s.trim()),
    }
    try {
      const saved = isEdit
        ? await recipesApi.update(id, payload)
        : await recipesApi.create(payload)
      if (imageFile) {
        await recipesApi.uploadImage(saved.id, imageFile)
      }
      navigate(`/recipes/${saved.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto max-w-2xl mx-auto px-4 py-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-800">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold flex-1">{isEdit ? 'Edit Recipe' : 'New Recipe'}</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save
        </button>
      </div>

      <div className="space-y-5">
        {/* Image */}
        <label className="block cursor-pointer">
          {imagePreview ? (
            <img src={imagePreview} alt="preview" className="w-full h-44 object-cover rounded-2xl" />
          ) : (
            <div className="w-full h-44 bg-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:bg-slate-700 transition-colors">
              <Camera size={32} />
              <span className="text-sm">Add photo</span>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </label>

        {/* Name */}
        <Field label="Recipe Name *">
          <input value={form.name} onChange={e => setField('name', e.target.value)}
            placeholder="e.g. Pasta Carbonara"
            className="input-field" />
        </Field>

        {/* Category + Difficulty */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={form.category} onChange={e => setField('category', e.target.value)} className="input-field">
              <option value="">Select...</option>
              {['Main Course','Dessert','Salad','Soup','Breakfast','Snack','Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Difficulty">
            <select value={form.difficulty} onChange={e => setField('difficulty', e.target.value)} className="input-field">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </Field>
        </div>

        {/* Times + Servings */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Prep (min)">
            <input type="number" value={form.prep_time} onChange={e => setField('prep_time', e.target.value)}
              className="input-field" min="0" />
          </Field>
          <Field label="Cook (min)">
            <input type="number" value={form.cook_time} onChange={e => setField('cook_time', e.target.value)}
              className="input-field" min="0" />
          </Field>
          <Field label="Servings">
            <input type="number" value={form.servings} onChange={e => setField('servings', e.target.value)}
              className="input-field" min="1" />
          </Field>
        </div>

        {/* Description */}
        <Field label="Description">
          <textarea value={form.description} onChange={e => setField('description', e.target.value)}
            rows={2} placeholder="Short description..."
            className="input-field resize-none" />
        </Field>

        {/* Ingredients */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">Ingredients</label>
            <button onClick={() => setField('ingredients', [...form.ingredients, { name: '', quantity: '' }])}
              className="text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {form.ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2">
                <input value={ing.name} onChange={e => setIngredient(i, 'name', e.target.value)}
                  placeholder="Ingredient" className="input-field flex-1" />
                <input value={ing.quantity} onChange={e => setIngredient(i, 'quantity', e.target.value)}
                  placeholder="Amount" className="input-field w-24" />
                <button onClick={() => setField('ingredients', form.ingredients.filter((_, j) => j !== i))}
                  className="text-slate-500 hover:text-red-400 p-2">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">Instructions</label>
            <button onClick={() => setField('steps', [...form.steps, ''])}
              className="text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1">
              <Plus size={14} /> Add step
            </button>
          </div>
          <div className="space-y-2">
            {form.steps.map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="w-6 h-6 bg-sky-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-2.5">
                  {i + 1}
                </span>
                <textarea value={step} onChange={e => setStep(i, e.target.value)}
                  placeholder={`Step ${i + 1}...`} rows={2}
                  className="input-field flex-1 resize-none" />
                <button onClick={() => setField('steps', form.steps.filter((_, j) => j !== i))}
                  className="text-slate-500 hover:text-red-400 p-2 mt-2">
                  <Trash2 size={14} />
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
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
