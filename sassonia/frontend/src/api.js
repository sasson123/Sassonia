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
  list: (listName) => api.get('/shopping/', { params: { list_name: listName } }).then(r => r.data),
  add: (data) => api.post('/shopping/', data).then(r => r.data),
  addBulk: (items) => api.post('/shopping/bulk', items).then(r => r.data),
  update: (id, data) => api.patch(`/shopping/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/shopping/${id}`).then(r => r.data),
  clearChecked: (listName) => api.delete('/shopping/checked/clear', { params: { list_name: listName } }).then(r => r.data),
  reorder: (order) => api.post('/shopping/reorder', { order }).then(r => r.data),
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
  suggestRecipes: (ingredients) =>
    api.post('/gemini/suggest-recipes', { ingredients }).then(r => r.data),
}
