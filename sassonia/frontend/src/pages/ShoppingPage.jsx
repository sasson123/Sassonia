import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, ShoppingCart, CheckCircle, Circle, GripVertical, ClipboardList, X, Loader2 } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragOverlay
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy,
  useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { shopping as shoppingApi } from '../api'
import { getCachedItems, cacheItems, removeCachedItems, enqueue, getQueueLength, flush } from '../offlineSync'

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

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-slate-800 rounded-2xl p-5 w-full max-w-xs shadow-xl border border-slate-700"
        onClick={e => e.stopPropagation()}>
        <p dir="auto" className="text-white text-sm text-center mb-5">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
            ביטול
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors">
            מחק
          </button>
        </div>
      </div>
    </div>
  )
}

function SortableTab({ list, isActive, isOnly, onSelect, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: list.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex-shrink-0 flex items-center gap-1 select-none touch-pan-x cursor-grab active:cursor-grabbing"
    >
      <button
        onClick={() => onSelect(list.name)}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer
          ${isActive ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
      >
        {list.name}
      </button>
      {!isOnly && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(list.name)
          }}
          className="text-slate-600 hover:text-red-400 transition-colors p-0.5"
          title={`Delete "${list.name}"`}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
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
      <span dir="auto" className={`flex-1 text-sm ${item.checked ? 'line-through text-slate-500' : 'text-white'}`}>{item.name}</span>
      {item.quantity && <span className="text-slate-400 text-sm">{item.quantity}</span>}
      <button onClick={() => onDelete(item.id, item.checked)} className="text-slate-600 hover:text-red-400 p-1">
        <Trash2 size={15} />
      </button>
    </div>
  )
}

const CACHE_KEY = 'sassonia_lists_cache'
const ACTIVE_KEY = 'sassonia_active_list'
const FALLBACK = [{ id: 0, name: 'סופר' }]

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || FALLBACK } catch { return FALLBACK }
}

// Counter for temporary offline IDs (negative to avoid collisions with server IDs)
let tempIdCounter = -1

export default function ShoppingPage() {
  const [lists, setLists] = useState(readCache)
  const [activeList, setActiveList] = useState(
    () => localStorage.getItem(ACTIVE_KEY) || readCache()[0].name
  )
  const [items, setItems] = useState(() => getCachedItems(localStorage.getItem(ACTIVE_KEY) || readCache()[0].name) || [])
  const [newName, setNewName] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [pasteLoading, setPasteLoading] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [showNewList, setShowNewList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [confirm, setConfirm] = useState(null) // { message, onConfirm }
  const [syncing, setSyncing] = useState(() => getQueueLength() > 0)
  const [activeTabId, setActiveTabId] = useState(null)
  const inputRef = useRef()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

  const tabSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  )

  const activeTab = lists.find(l => l.id === activeTabId)

  // Track sync queue status
  useEffect(() => {
    const check = () => setSyncing(getQueueLength() > 0)
    check()
    const interval = setInterval(check, 2_000)
    return () => clearInterval(interval)
  }, [])

  // Helper: update items state AND persist to cache
  const setItemsCached = useCallback((updater) => {
    setItems(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      cacheItems(activeList, next)
      return next
    })
  }, [activeList])

  // Sync lists from server, update cache
  useEffect(() => {
    shoppingApi.getLists().then(data => {
      if (!data.length) return
      setLists(data)
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
      setActiveList(prev => {
        const valid = data.find(l => l.name === prev)
        return valid ? prev : data[0].name
      })
    }).catch(() => {})
  }, [])

  // Load items: stale-while-revalidate
  useEffect(() => {
    if (!activeList) return
    // 1. Load from cache immediately (synchronous, instant)
    const cached = getCachedItems(activeList)
    if (cached) setItems(cached)
    // 2. Refresh from server in background
    shoppingApi.list(activeList)
      .then(serverItems => {
        setItems(serverItems)
        cacheItems(activeList, serverItems)
      })
      .catch(() => {
        // Offline — cache is already displayed, nothing to do
      })
  }, [activeList])

  // ── Optimistic mutations ──────────────────────────────────────

  function addItem(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const name = newName.trim()
    // Optimistic: add with temp ID immediately
    const tempItem = { id: tempIdCounter--, name, quantity: '', checked: false, order: items.length, list_name: activeList }
    setItemsCached(prev => [...prev, tempItem])
    setNewName('')
    inputRef.current?.focus()
    // Sync to server
    const payload = { name, quantity: '', list_name: activeList }
    shoppingApi.add(payload)
      .then(serverItem => {
        // Replace temp item with server item (which has a real ID)
        setItemsCached(prev => prev.map(i => i.id === tempItem.id ? serverItem : i))
      })
      .catch(() => enqueue({ type: 'add', payload }))
  }

  async function handlePaste() {
    const parsed = parsePastedList(pasteText)
    if (!parsed.length) return
    setPasteLoading(true)
    setPasteError('')
    try {
      const withList = parsed.map(i => ({ ...i, list_name: activeList }))
      const created = await shoppingApi.addBulk(withList)
      setItemsCached(prev => [...prev, ...created])
      setPasteText('')
      setShowPaste(false)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setPasteError(detail || `Failed to add items (${err?.message || 'network error'})`)
    } finally {
      setPasteLoading(false)
    }
  }

  function toggleItem(id, checked) {
    // 1. Update UI + cache immediately
    setItemsCached(prev => prev.map(i => i.id === id ? { ...i, checked: !checked } : i))
    // 2. Sync to server in background
    shoppingApi.update(id, { checked: !checked })
      .catch(() => enqueue({ type: 'toggle', payload: { id, checked: !checked } }))
  }

  function doDeleteItem(id) {
    // 1. Update UI + cache immediately
    setItemsCached(prev => prev.filter(i => i.id !== id))
    // 2. Sync to server (skip for temp items that never reached the server)
    if (id > 0) {
      shoppingApi.delete(id)
        .catch(() => enqueue({ type: 'delete', payload: { id } }))
    }
  }

  function deleteItem(id, isChecked) {
    if (isChecked) { doDeleteItem(id); return }
    const item = items.find(i => i.id === id)
    setConfirm({
      message: `למחוק את "${item?.name}"?`,
      onConfirm: () => { setConfirm(null); doDeleteItem(id) },
    })
  }

  function clearChecked() {
    // 1. Update UI + cache immediately
    setItemsCached(prev => prev.filter(i => !i.checked))
    // 2. Sync to server
    shoppingApi.clearChecked(activeList)
      .catch(() => enqueue({ type: 'clearChecked', payload: { listName: activeList } }))
  }

  function handleDragStart(event) { setActiveId(event.active.id) }

  function handleDragEnd(event) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = unchecked.map(i => i.id)
    const oldIndex = ids.indexOf(active.id)
    const newIndex = ids.indexOf(over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newUnchecked = arrayMove(unchecked, oldIndex, newIndex)
    // 1. Update UI + cache immediately
    setItemsCached([...newUnchecked, ...checked])
    // 2. Sync to server
    const order = newUnchecked.map(i => i.id)
    shoppingApi.reorder(order)
      .catch(() => enqueue({ type: 'reorder', payload: { order } }))
  }

  function handleTabDragStart(event) { setActiveTabId(event.active.id) }

  function handleTabDragEnd(event) {
    setActiveTabId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = lists.findIndex(l => l.id === active.id)
    const newIndex = lists.findIndex(l => l.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newLists = arrayMove(lists, oldIndex, newIndex)
    setLists(newLists)
    localStorage.setItem(CACHE_KEY, JSON.stringify(newLists))
    const order = newLists.map(l => l.id)
    shoppingApi.reorderLists(order)
      .catch(() => enqueue({ type: 'reorderLists', payload: { order } }))
  }

  function switchList(name) {
    setActiveList(name)
    localStorage.setItem(ACTIVE_KEY, name)
  }

  async function addNewList() {
    const name = newListName.trim()
    if (!name) return
    const optimistic = [...lists, { id: Date.now(), name }]
    setLists(optimistic)
    localStorage.setItem(CACHE_KEY, JSON.stringify(optimistic))
    switchList(name)
    setNewListName('')
    setShowNewList(false)
    try {
      const created = await shoppingApi.createList(name)
      setLists(prev => prev.map(l => l.name === name ? created : l))
    } catch {
      // already exists on server — that's fine
    }
  }

  function deleteList(name) {
    if (lists.length <= 1) return
    const count = items.length
    setConfirm({
      message: `למחוק את הרשימה "${name}"${count > 0 ? ` ואת ${count} הפריטים בה` : ''}?`,
      onConfirm: async () => {
        setConfirm(null)
        const updated = lists.filter(l => l.name !== name)
        setLists(updated)
        localStorage.setItem(CACHE_KEY, JSON.stringify(updated))
        removeCachedItems(name)
        if (activeList === name) switchList(updated[0].name)
        await shoppingApi.deleteList(name).catch(() => {})
      },
    })
  }

  const unchecked = items.filter(i => !i.checked)
  const checked = items.filter(i => i.checked)
  const activeItem = items.find(i => i.id === activeId)
  const previewCount = parsePastedList(pasteText).length

  return (
    <div className="flex flex-col h-full">
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      <header className="flex-shrink-0 bg-slate-900 z-10 px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="text-sky-400" size={26} /> Shopping List
            {syncing && (
              <span className="flex items-center gap-1 text-xs font-normal text-amber-400 animate-pulse" title="Syncing pending changes...">
                <Loader2 size={12} className="animate-spin" />
              </span>
            )}
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

        {/* List tabs */}
        <DndContext
          sensors={tabSensors}
          collisionDetection={closestCenter}
          onDragStart={handleTabDragStart}
          onDragEnd={handleTabDragEnd}
        >
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-center">
            <SortableContext items={lists.map(l => l.id)} strategy={horizontalListSortingStrategy}>
              {lists.map(list => (
                <SortableTab
                  key={list.id}
                  list={list}
                  isActive={activeList === list.name}
                  isOnly={lists.length <= 1}
                  onSelect={switchList}
                  onDelete={deleteList}
                />
              ))}
            </SortableContext>

            {showNewList ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <input
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addNewList(); if (e.key === 'Escape') { setShowNewList(false); setNewListName('') } }}
                  placeholder="שם הרשימה"
                  dir="auto"
                  className="bg-slate-800 text-white text-xs rounded-full px-3 py-1 w-28 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  autoFocus
                />
                <button onClick={addNewList} className="text-sky-400 hover:text-sky-300 transition-colors">
                  <CheckCircle size={16} />
                </button>
                <button onClick={() => { setShowNewList(false); setNewListName('') }} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewList(true)}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <Plus size={13} /> רשימה חדשה
              </button>
            )}
          </div>
          <DragOverlay>
            {activeTab && (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-sky-600 text-white shadow-xl scale-105 border border-sky-400/50">
                {activeTab.name}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {showPaste && (
          <div className="mt-3 bg-slate-800 rounded-2xl p-3 border border-slate-700">
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

        <form onSubmit={addItem} className="flex gap-2 mt-3">
          <input ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
            placeholder={`הוסף פריט ל${activeList}...`} dir="auto" className="input-field flex-1 min-w-0" />
          <button type="submit" className="p-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl transition-colors">
            <Plus size={18} />
          </button>
        </form>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {items.length === 0 && (
          <div className="text-center text-slate-500 py-16">
            <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
            <p>הרשימה ריקה.</p>
            <p className="text-sm mt-1">הוסף פריטים או הדבק רשימה.</p>
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
                <span dir="auto" className="text-sm text-white">{activeItem.name}</span>
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
                  <span dir="auto" className="flex-1 text-sm line-through text-slate-500">{item.name}</span>
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
