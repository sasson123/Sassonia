import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, CheckCircle2, BookMarked, RotateCcw, GripVertical, AlertTriangle, Loader2 } from 'lucide-react'
import { shopping as shoppingApi } from '../api'

function isHebrew(text) {
  return /[\u0590-\u05FF]/.test(text || '')
}

function BaseItemRow({ item, onDelete }) {
  const rtl = isHebrew(item.name)
  return (
    <div
      className={`flex items-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700/50 ${rtl ? 'flex-row-reverse text-right' : ''}`}
      dir={rtl ? 'rtl' : 'ltr'}
    >
      <GripVertical size={15} className="text-slate-600 flex-shrink-0" />
      <span className="flex-1 text-sm text-white">{item.name}</span>
      {item.quantity && (
        <span className="text-xs text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded-md">{item.quantity}</span>
      )}
      <button
        onClick={() => onDelete(item.id)}
        className="text-slate-600 hover:text-red-400 p-0.5 transition-colors flex-shrink-0"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

export default function BaseListModal({ isOpen, onClose, activeList, onResetDone }) {
  const [baseItems, setBaseItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [tab, setTab] = useState('list') // 'list' | 'reset'
  const inputRef = useRef()

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    shoppingApi.getBaseItems(activeList)
      .then(setBaseItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen, activeList])

  if (!isOpen) return null

  function parsePasted(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      line = line.replace(/^[-•*]\s+/, '').replace(/^\d+[.)]\s+/, '').trim()
      const match = line.match(/^([\d.,]+\s*(?:kg|g|gr|l|ml|L|x|יח|כוס|כוסות|כף|כפות|כפית|כפיות|pcs?|units?|liters?|cups?|tbsp|tsp|oz|lb|pieces?)\.?\s*)([^\d].*)$/u)
      if (match) return { quantity: match[1].trim(), name: match[2].trim() }
      const matchEnd = line.match(/^(.*?)\s+([\d.,]+\s*(?:kg|g|gr|l|ml|L|יח|כוס|כף|כפית|pcs?|oz|lb)\.?)$/u)
      if (matchEnd) return { name: matchEnd[1].trim(), quantity: matchEnd[2].trim() }
      return { name: line, quantity: '' }
    }).filter(i => i.name)
  }

  async function addItem(e) {
    e?.preventDefault()
    const name = newName.trim()
    if (!name) return
    try {
      const created = await shoppingApi.addBaseItem({ name, quantity: newQty.trim(), list_name: activeList })
      setBaseItems(prev => [...prev, created])
      setNewName('')
      setNewQty('')
      inputRef.current?.focus()
    } catch {}
  }

  async function addPasted() {
    const parsed = parsePasted(pasteText)
    if (!parsed.length) return
    try {
      const items = parsed.map(i => ({ ...i, list_name: activeList }))
      const created = await shoppingApi.addBaseItemsBulk(items)
      setBaseItems(prev => [...prev, ...created])
      setPasteText('')
      setShowPaste(false)
    } catch {}
  }

  async function deleteItem(id) {
    await shoppingApi.deleteBaseItem(id).catch(() => {})
    setBaseItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleReset() {
    setResetting(true)
    try {
      const freshItems = await shoppingApi.resetFromBase(activeList)
      if (onResetDone) onResetDone(freshItems)
      onClose()
    } catch (err) {
      console.error('Reset failed:', err)
    } finally {
      setResetting(false)
    }
  }

  async function handleAddToExisting() {
    setResetting(true)
    try {
      const freshItems = await shoppingApi.addBaseToExisting(activeList)
      if (onResetDone) onResetDone(freshItems)
      onClose()
    } catch (err) {
      console.error('Add to existing failed:', err)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-t-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <BookMarked size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">רשימת בסיס</h3>
              <p className="text-xs text-slate-400">{activeList}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 flex-shrink-0">
          <button
            onClick={() => setTab('list')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'list' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400'}`}
          >
            ניהול רשימת בסיס ({baseItems.length})
          </button>
          <button
            onClick={() => setTab('reset')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'reset' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400'}`}
          >
            איפוס / הוספה
          </button>
        </div>

        {tab === 'list' && (
          <>
            {/* Add item form */}
            <div className="px-4 pt-3 pb-2 border-b border-slate-800 flex-shrink-0 space-y-2">
              <form onSubmit={addItem} className="flex gap-2">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="שם המצרך..."
                  dir="auto"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-0"
                />
                <input
                  value={newQty}
                  onChange={e => setNewQty(e.target.value)}
                  placeholder="כמות"
                  dir="auto"
                  className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl transition-colors flex-shrink-0"
                >
                  <Plus size={18} />
                </button>
              </form>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPaste(v => !v)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors ${showPaste ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                >
                  הדבק רשימה
                </button>
                {showPaste && (
                  <span className="text-xs text-slate-500">פריט אחד לשורה</span>
                )}
              </div>
              {showPaste && (
                <div className="space-y-2">
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder={'חלב\n2 ביצים\n500 גרם קמח\nלחם'}
                    rows={4}
                    dir="auto"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-mono text-xs"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={addPasted}
                      disabled={!pasteText.trim()}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors"
                    >
                      הוסף {parsePasted(pasteText).length || ''} פריטים
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* List of base items */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-slate-500" />
                </div>
              ) : baseItems.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <BookMarked size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">רשימת הבסיס ריקה.</p>
                  <p className="text-xs mt-1 text-slate-600">הוסף מצרכים שחוזרים בכל קנייה.</p>
                </div>
              ) : (
                baseItems.map(item => (
                  <BaseItemRow key={item.id} item={item} onDelete={deleteItem} />
                ))
              )}
            </div>
          </>
        )}

        {tab === 'reset' && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              רשימת הבסיס מכילה <strong className="text-emerald-400">{baseItems.length} פריטים</strong>.
              <br/>בחר מה לעשות עם הרשימה הפעילה <strong className="text-white">{activeList}</strong>:
            </p>

            {/* Option 1: Full Reset */}
            <div className="bg-slate-800 border border-amber-500/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white">איפוס מלא</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    מוחק <strong>את כל הפריטים</strong> הקיימים ברשימה ומחליף אותם בפריטי הבסיס, כולם ללא סימון.
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                disabled={resetting || baseItems.length === 0}
                className="w-full py-3 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {resetting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                <span>איפוס מלא — החלף ברשימת הבסיס</span>
              </button>
            </div>

            {/* Option 2: Add to existing */}
            <div className="bg-slate-800 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white">הוסף לקיימת</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    שומר את כל הפריטים הקיימים ו<strong>מוסיף</strong> את פריטי הבסיס שעדיין לא נמצאים ברשימה.
                  </p>
                </div>
              </div>
              <button
                onClick={handleAddToExisting}
                disabled={resetting || baseItems.length === 0}
                className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {resetting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>הוסף פריטי בסיס לרשימה הקיימת</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
