// offlineSync.js — localStorage cache + offline mutation queue for shopping lists

import { shopping as shoppingApi } from './api'

// ── Items Cache (per-list) ──────────────────────────────────────

const ITEMS_PREFIX = 'sassonia_items_'

export function getCachedItems(listName) {
  try {
    const raw = localStorage.getItem(ITEMS_PREFIX + listName)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function cacheItems(listName, items) {
  try {
    localStorage.setItem(ITEMS_PREFIX + listName, JSON.stringify(items))
  } catch {
    // localStorage full — silently ignore
  }
}

export function removeCachedItems(listName) {
  try {
    localStorage.removeItem(ITEMS_PREFIX + listName)
  } catch {}
}

// ── Mutation Queue ──────────────────────────────────────────────

const QUEUE_KEY = 'sassonia_sync_queue'

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []
  } catch {
    return []
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {}
}

export function enqueue(mutation) {
  const queue = readQueue()

  // Deduplicate: if there's already a toggle for the same item, replace it
  if (mutation.type === 'toggle') {
    const idx = queue.findIndex(m => m.type === 'toggle' && m.payload.id === mutation.payload.id)
    if (idx !== -1) {
      queue[idx] = mutation
      writeQueue(queue)
      return
    }
  }

  queue.push(mutation)
  writeQueue(queue)
}

export function getQueueLength() {
  return readQueue().length
}

// Execute one mutation against the server
async function executeMutation(m) {
  switch (m.type) {
    case 'toggle':
      await shoppingApi.update(m.payload.id, { checked: m.payload.checked })
      break
    case 'add':
      await shoppingApi.add(m.payload)
      break
    case 'delete':
      await shoppingApi.delete(m.payload.id)
      break
    case 'clearChecked':
      await shoppingApi.clearChecked(m.payload.listName)
      break
    case 'reorder':
      await shoppingApi.reorder(m.payload.order)
      break
  }
}

let flushing = false

export async function flush() {
  if (flushing) return
  flushing = true
  try {
    let queue = readQueue()
    if (!queue.length) return

    let processed = 0
    for (const m of queue) {
      try {
        await executeMutation(m)
        processed++
      } catch {
        break // stop at first failure — still offline
      }
    }

    if (processed > 0) {
      writeQueue(queue.slice(processed))
    }
  } finally {
    flushing = false
  }
}

// ── Auto-flush triggers ─────────────────────────────────────────

if (typeof window !== 'undefined') {
  // When device comes back online
  window.addEventListener('online', () => flush())

  // When user returns to the app/tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush()
  })

  // Safety net: periodic flush every 30 seconds
  setInterval(() => flush(), 30_000)
}
