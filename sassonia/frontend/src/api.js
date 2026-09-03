import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const recipes = {
  list: () => api.get('/recipes/').then(r => r.data),
  get: (id) => api.get(`/recipes/${id}`).then(r => r.data),
  create: (data) => api.post('/recipes/', data).then(r => r.data),
  update: (id, data) => api.put(`/recipes/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/recipes/${id}`).then(r => r.data),
  uploadImage: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/recipes/${id}/image`, form).then(r => r.data)
  },
  searchByIngredients: (ingredients) =>
    api.get(`/recipes/search/by-ingredients?ingredients=${encodeURIComponent(ingredients)}`).then(r => r.data),
}

export const shopping = {
  getLists: () => api.get('/shopping/lists').then(r => r.data),
  createList: (name) => api.post('/shopping/lists', { name }).then(r => r.data),
  deleteList: (name) => api.delete(`/shopping/lists/${encodeURIComponent(name)}`).then(r => r.data),
  list: (listName) => api.get('/shopping/', { params: { list_name: listName } }).then(r => r.data),
  add: (data) => api.post('/shopping/', data).then(r => r.data),
  addBulk: (items) => api.post('/shopping/bulk', items).then(r => r.data),
  update: (id, data) => api.patch(`/shopping/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/shopping/${id}`).then(r => r.data),
  clearChecked: (listName) => api.delete('/shopping/checked/clear', { params: { list_name: listName } }).then(r => r.data),
  reorder: (order) => api.post('/shopping/reorder', { order }).then(r => r.data),
  reorderLists: (order) => api.post('/shopping/lists/reorder', { order }).then(r => r.data),
}

export const tasks = {
  list: () => api.get('/tasks/').then(r => r.data),
  create: (data) => api.post('/tasks/', data).then(r => r.data),
  update: (id, data) => api.patch(`/tasks/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/tasks/${id}`).then(r => r.data),
  clearDone: () => api.delete('/tasks/done/clear').then(r => r.data),
}

export const gemini = {
  extractRecipe: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/gemini/extract-recipe', form).then(r => r.data)
  },

  // Parse recipe from raw HTML string (browser fetched it, avoids bot-blocking)
  parseHtml: (html, source_url) =>
    api.post('/gemini/parse-html', { html, source_url }).then(r => r.data),

  // Smart URL extraction: browser fetches first, falls back to server-side fetch
  extractFromUrl: async (url) => {
    // Try browser-side fetch first (avoids Cloudflare/bot blocking on recipe sites)
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        signal: AbortSignal.timeout(15000),
        mode: 'cors',
      })
      if (resp.ok) {
        const html = await resp.text()
        if (html && html.length > 200) {
          return api.post('/gemini/parse-html', { html, source_url: url }).then(r => r.data)
        }
      }
    } catch {
      // CORS blocked or network error — fall back to server-side fetch
    }
    // Backend fallback (works for non-CORS-restricted sites)
    return api.post('/gemini/extract-from-url', { url }).then(r => r.data)
  },

  suggestRecipes: (ingredients) =>
    api.post('/gemini/suggest-recipes', { ingredients }).then(r => r.data),
}
