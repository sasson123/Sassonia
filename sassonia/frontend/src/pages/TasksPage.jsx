import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, CheckSquare, CheckCircle, Circle } from 'lucide-react'
import { tasks as tasksApi } from '../api'

export default function TasksPage() {
  const [taskList, setTaskList] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef()

  useEffect(() => {
    tasksApi.list().then(setTaskList)
  }, [])

  async function addTask(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const task = await tasksApi.create({ title: newTitle.trim() })
    setTaskList(prev => [...prev, task])
    setNewTitle('')
    inputRef.current?.focus()
  }

  async function toggleTask(id, done) {
    const updated = await tasksApi.update(id, { done: !done })
    setTaskList(prev => prev.map(t => t.id === id ? updated : t))
  }

  async function deleteTask(id) {
    await tasksApi.delete(id)
    setTaskList(prev => prev.filter(t => t.id !== id))
  }

  async function clearDone() {
    await tasksApi.clearDone()
    setTaskList(prev => prev.filter(t => !t.done))
  }

  const pending = taskList.filter(t => !t.done)
  const done = taskList.filter(t => t.done)

  return (
    <div className="flex flex-col h-full">
      <header className="flex-shrink-0 bg-slate-900 z-10 px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckSquare className="text-sky-400" size={26} /> Tasks
          </h1>
          {done.length > 0 && (
            <button onClick={clearDone} className="text-sm text-red-400 hover:text-red-300">
              Clear done ({done.length})
            </button>
          )}
        </div>
        <form onSubmit={addTask} className="flex gap-2">
          <input ref={inputRef} value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Add task..." className="input-field flex-1" />
          <button type="submit" className="p-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl transition-colors">
            <Plus size={18} />
          </button>
        </form>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {taskList.length === 0 && (
          <div className="text-center text-slate-500 py-16">
            <CheckSquare size={48} className="mx-auto mb-3 opacity-30" />
            <p>No tasks yet.</p>
          </div>
        )}
        {pending.map(task => (
          <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
        ))}
        {done.length > 0 && (
          <>
            <p className="text-xs text-slate-500 pt-3 pb-1 px-1">Done</p>
            {done.map(task => (
              <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task, onToggle, onDelete }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${task.done ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
      <button onClick={() => onToggle(task.id, task.done)} className="flex-shrink-0">
        {task.done
          ? <CheckCircle size={22} className="text-sky-500" />
          : <Circle size={22} className="text-slate-500" />}
      </button>
      <span className={`flex-1 text-sm ${task.done ? 'line-through text-slate-500' : 'text-white'}`}>
        {task.title}
      </span>
      <button onClick={() => onDelete(task.id)} className="text-slate-600 hover:text-red-400 p-1">
        <Trash2 size={15} />
      </button>
    </div>
  )
}
