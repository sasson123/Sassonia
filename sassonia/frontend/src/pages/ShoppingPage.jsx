import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, ShoppingCart, CheckCircle, Circle, GripVertical, ClipboardList, X } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragOverlay
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { shopping as shoppingApi } from '../api'

function parsePastedList(text) {
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

function SortableItem({ item, onToggle, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${item.checked ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
      <button {...attributes} {...listeners}
        className="flex-shrink-0 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none p-1">
        <GripVertical size={16} />
      </button>
      <button onClick={() => onToggle(item.id, item.checked)} className="flex-shrink-0">
        {item.checked ? <CheckCircle size={22} className="text-sky-500" /> : <Circle size={22} className="text-slate-500" />}
      </button>
      <span className={`flex-1 text-sm ${item.checked ? 'line-through text-slate-500' : 'text-white'}`}>{item.name}</span>
      {item.quantity && <span className="text-slate-400 text-sm">{item.quantity}</span>}
      <button onClick={() => onDelete(item.id)} className="text-slate-600 hover:text-red-400 p-1">
        <Trash2 size={15} />
      </button>
    </div>
  )
}

export default function ShoppingPage() {
  const [items, setItems] = useState([])
  const [newName, setNewName] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [pasteLoading, setPasteLoading] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const inputRef = useRef()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

  useEffect(() => { shoppingApi.list().then(setItems) }, [])

  async function addItem(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const item = await shoppingApi.add({ name: newName.trim(), quantity: '' })
    setItems(prev => [...prev, item])
    setNewName('')
    inputRef.current?.focus()
  }

  async function handlePaste() {
    const parsed = parsePastedList(pasteText)
    if (!parsed.length) return
    setPasteLoading(true)
    setPasteError('')
    try {
      const created = await shoppingApi.addBulk(parsed)
      setItems(prev => [...prev, ...created])
      setPasteText('')
      setShowPaste(false)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setPasteError(detail || `Failed to add items (${err?.message || 'network error'})`)
    } finally {
      setPasteLoading(false)
    }
  }

  async function toggleItem(id, checked) {
    const updated = await shoppingApi.update(id, { checked: !checked })
    setItems(prev => prev.map(i => i.id === id ? updated : i))
  }

  async function deleteItem(id) {
    await shoppingApi.delete(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function clearChecked() {
    await shoppingApi.clearChecked()
    setItems(prev => prev.filter(i => !i.checked))
  }

  function handleDragStart(event) { setActiveId(event.active.id) }

  async function handleDragEnd(event) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = unchecked.map(i => i.id)
    const oldIndex = ids.indexOf(active.id)
    const newIndex = ids.indexOf(over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newUnchecked = arrayMove(unchecked, oldIndex, newIndex)
    setItems([...newUnchecked, ...checked])
    await shoppingApi.reorder(newUnchecked.map(i => i.id))
  }

  const unchecked = items.filter(i => !i.checked)
  const checked = items.filter(i => i.checked)
  const activeItem = items.find(i => i.id === activeId)
  const previewCount = parsePastedList(pasteText).length

  return (
    <div className="max-w-2xl mx-auto">
      <header className="sticky top-0 bg-slate-900 z-10 px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="text-sky-400" size={26} /> Shopping List
          </h1>
          <div className="flex items-center gap-2">
            {checked.length > 0 && (
              <button onClick={clearChecked} className="text-sm text-red-400 hover:text-red-300">
                Clear done ({checked.length})
              </button>
            )}
            <button
              onClick={() => { setShowPaste(v => !v); setPasteText('') }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${showPaste ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              title="Paste list"
            >
              <ClipboardList size={16} /> Paste
            </button>
          </div>
        </div>

        {showPaste && (
          <div className="mb-3 bg-slate-800 rounded-2xl p-3 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-300 font-medium">Paste your shopping list</p>
              <button onClick={() => { setShowPaste(false); setPasteText('') }} className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            </div>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={"milk\n2 eggs\n500g flour\nbread"}
              rows={5}
              className="input-field resize-none mb-2 font-mono text-xs"
              autoFocus
            />
            {pasteError && <p className="text-red-400 text-xs mb-2">{pasteError}</p>}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {previewCount > 0 ? `${previewCount} items detected` : 'One item per line'}
              </p>
              <button
                onClick={handlePaste}
                disabled={previewCount === 0 || pasteLoading}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors"
              >
                {pasteLoading ? 'Adding...' : `Add ${previewCount > 0 ? previewCount : ''} items`}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={addItem} className="flex gap-2">
          <input ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Add item..." className="input-field flex-1 min-w-0" />
          <button type="submit" className="p-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl transition-colors">
            <Plus size={18} />
          </button>
        </form>
      </header>

      <div className="px-4 py-4 space-y-1">
        {items.length === 0 && (
          <div className="text-center text-slate-500 py-16">
            <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
            <p>Your list is empty.</p>
            <p className="text-sm mt-1">Add items or paste a list.</p>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={unchecked.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {unchecked.map(item => (
                <SortableItem key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeItem && (
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-700 shadow-xl">
                <GripVertical size={16} className="text-slate-400" />
                <span className="text-sm text-white">{activeItem.name}</span>
                {activeItem.quantity && <span className="text-slate-400 text-sm">{activeItem.quantity}</span>}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {checked.length > 0 && (
          <>
            <p className="text-xs text-slate-500 pt-3 pb-1 px-1">Done</p>
            <div className="space-y-1">
              {checked.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-800/50">
                  <div className="w-6" />
                  <button onClick={() => toggleItem(item.id, item.checked)} className="flex-shrink-0">
                    <CheckCircle size={22} className="text-sky-500" />
                  </button>
                  <span className="flex-1 text-sm line-through text-slate-500">{item.name}</span>
                  {item.quantity && <span className="text-slate-500 text-sm">{item.quantity}</span>}
                  <button onClick={() => deleteItem(item.id)} className="text-slate-600 hover:text-red-400 p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
