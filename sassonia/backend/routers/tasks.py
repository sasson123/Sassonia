from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
import models

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    title: str


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    done: Optional[bool] = None


def task_to_dict(task: models.Task) -> dict:
    return {"id": task.id, "title": task.title, "done": task.done}


@router.get("/")
def list_tasks(db: Session = Depends(get_db)):
    tasks = db.query(models.Task).order_by(models.Task.done, models.Task.id).all()
    return [task_to_dict(t) for t in tasks]


@router.post("/")
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    db_task = models.Task(title=task.title)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return task_to_dict(db_task)


@router.patch("/{task_id}")
def update_task(task_id: int, update: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if update.title is not None:
        task.title = update.title
    if update.done is not None:
        task.done = update.done
    db.commit()
    return task_to_dict(task)


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"ok": True}


@router.delete("/done/clear")
def clear_done(db: Session = Depends(get_db)):
    db.query(models.Task).filter(models.Task.done == True).delete()
    db.commit()
    return {"ok": True}
