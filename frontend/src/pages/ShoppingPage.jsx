import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, ShoppingCart, CheckCircle, Circle } from 'lucide-react'
import { shopping as shoppingApi } from '../api'

export default function ShoppingPage() {
  const [items, setItems] = useState([])
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const inputRef = useRef()

  useEffect(() => {
    shoppingApi.list().then(setItems)
  }, [])

  async function addItem(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const item = await shoppingApi.add({ name: newName.trim(), quantity: newQty.trim() })
    setItems(prev => [...prev, item])
    setNewName('')
    setNewQty('')
    inputRef.current?.focus()
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

  const unchecked = items.filter(i => !i.checked)
  const checked = items.filter(i => i.checked)

  return (
    <div className="max-w-2xl mx-auto">
      <header className="sticky top-0 bg-slate-900 z-10 px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="text-sky-400" size={26} /> Shopping List
          </h1>
          {checked.length > 0 && (
            <button onClick={clearChecked} className="text-sm text-red-400 hover:text-red-300">
              Clear done ({checked.length})
            </button>
          )}
        </div>
        <form onSubmit={addItem} className="flex gap-2">
          <input ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Add item..." className="input-field flex-1" />
          <input value={newQty} onChange={e => setNewQty(e.target.value)}
            placeholder="Qty" className="input-field w-20" />
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
          </div>
        )}
        {unchecked.map(item => (
          <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
        ))}
        {checked.length > 0 && (
          <>
            <p className="text-xs text-slate-500 pt-3 pb-1 px-1">Done</p>
            {checked.map(item => (
              <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function ItemRow({ item, onToggle, onDelete }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${item.checked ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
      <button onClick={() => onToggle(item.id, item.checked)} className="flex-shrink-0">
        {item.checked
          ? <CheckCircle size={22} className="text-sky-500" />
          : <Circle size={22} className="text-slate-500" />}
      </button>
      <span className={`flex-1 text-sm ${item.checked ? 'line-through text-slate-500' : 'text-white'}`}>
        {item.name}
      </span>
      {item.quantity && (
        <span className="text-slate-400 text-sm">{item.quantity}</span>
      )}
      <button onClick={() => onDelete(item.id)} className="text-slate-600 hover:text-red-400 p-1">
        <Trash2 size={15} />
      </button>
    </div>
  )
}
