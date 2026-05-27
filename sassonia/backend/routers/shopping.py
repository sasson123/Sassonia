from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from database import get_db
import models

router = APIRouter(prefix="/api/shopping", tags=["shopping"])


class ShoppingItemCreate(BaseModel):
    name: str
    quantity: str = ""


class ShoppingItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[str] = None
    checked: Optional[bool] = None


class ReorderRequest(BaseModel):
    order: List[int]


def item_to_dict(item: models.ShoppingItem) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "quantity": item.quantity,
        "checked": item.checked,
        "order": item.order,
    }


@router.get("/")
def list_items(db: Session = Depends(get_db)):
    items = (
        db.query(models.ShoppingItem)
        .order_by(models.ShoppingItem.checked, models.ShoppingItem.order, models.ShoppingItem.id)
        .all()
    )
    return [item_to_dict(i) for i in items]


@router.post("/")
def add_item(item: ShoppingItemCreate, db: Session = Depends(get_db)):
    max_order = db.query(models.ShoppingItem).count()
    db_item = models.ShoppingItem(name=item.name, quantity=item.quantity, order=max_order)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return item_to_dict(db_item)


@router.post("/bulk")
def add_bulk_items(items: List[ShoppingItemCreate], db: Session = Depends(get_db)):
    base_order = db.query(models.ShoppingItem).count()
    created = []
    for i, item in enumerate(items):
        db_item = models.ShoppingItem(name=item.name, quantity=item.quantity, order=base_order + i)
        db.add(db_item)
        created.append(db_item)
    db.commit()
    return [item_to_dict(i) for i in created]


@router.post("/reorder")
def reorder_items(req: ReorderRequest, db: Session = Depends(get_db)):
    for position, item_id in enumerate(req.order):
        db.query(models.ShoppingItem).filter(models.ShoppingItem.id == item_id).update({"order": position})
    db.commit()
    return {"ok": True}


@router.patch("/{item_id}")
def update_item(item_id: int, update: ShoppingItemUpdate, db: Session = Depends(get_db)):
    item = db.query(models.ShoppingItem).filter(models.ShoppingItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if update.name is not None:
        item.name = update.name
    if update.quantity is not None:
        item.quantity = update.quantity
    if update.checked is not None:
        item.checked = update.checked
    db.commit()
    return item_to_dict(item)


@router.delete("/checked/clear")
def clear_checked(db: Session = Depends(get_db)):
    db.query(models.ShoppingItem).filter(models.ShoppingItem.checked == True).delete()
    db.commit()
    return {"ok": True}


@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.ShoppingItem).filter(models.ShoppingItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}
