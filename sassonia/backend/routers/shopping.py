from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from database import get_db
import models

router = APIRouter(prefix="/api/shopping", tags=["shopping"])


# ── List management ──────────────────────────────────────────────

class ShoppingListCreate(BaseModel):
    name: str


@router.get("/lists")
def get_lists(db: Session = Depends(get_db)):
    lists = db.query(models.ShoppingList).order_by(models.ShoppingList.position, models.ShoppingList.id).all()
    if not lists:
        default = models.ShoppingList(name="סופר", position=0)
        db.add(default)
        db.commit()
        db.refresh(default)
        lists = [default]
    return [{"id": l.id, "name": l.name} for l in lists]


@router.post("/lists")
def create_list(data: ShoppingListCreate, db: Session = Depends(get_db)):
    existing = db.query(models.ShoppingList).filter(models.ShoppingList.name == data.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="List already exists")
    position = db.query(models.ShoppingList).count()
    lst = models.ShoppingList(name=data.name, position=position)
    db.add(lst)
    db.commit()
    db.refresh(lst)
    return {"id": lst.id, "name": lst.name}


@router.delete("/lists/{list_name}")
def delete_list(list_name: str, db: Session = Depends(get_db)):
    count = db.query(models.ShoppingList).count()
    if count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last list")
    lst = db.query(models.ShoppingList).filter(models.ShoppingList.name == list_name).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    db.query(models.ShoppingItem).filter(models.ShoppingItem.list_name == list_name).delete()
    db.delete(lst)
    db.commit()
    return {"ok": True}


class ReorderListsRequest(BaseModel):
    order: List[int]


@router.post("/lists/reorder")
def reorder_lists(req: ReorderListsRequest, db: Session = Depends(get_db)):
    for position, list_id in enumerate(req.order):
        db.query(models.ShoppingList).filter(models.ShoppingList.id == list_id).update({"position": position})
    db.commit()
    return {"ok": True}



# ── Items ────────────────────────────────────────────────────────

class ShoppingItemCreate(BaseModel):
    name: str
    quantity: str = ""
    list_name: str = "סופר"


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
        "list_name": item.list_name or "סופר",
    }


@router.get("/")
def list_items(list_name: str = "סופר", db: Session = Depends(get_db)):
    items = (
        db.query(models.ShoppingItem)
        .filter(models.ShoppingItem.list_name == list_name)
        .order_by(models.ShoppingItem.checked, models.ShoppingItem.order, models.ShoppingItem.id)
        .all()
    )
    return [item_to_dict(i) for i in items]


@router.post("/")
def add_item(item: ShoppingItemCreate, db: Session = Depends(get_db)):
    max_order = db.query(models.ShoppingItem).filter(models.ShoppingItem.list_name == item.list_name).count()
    db_item = models.ShoppingItem(name=item.name, quantity=item.quantity, order=max_order, list_name=item.list_name)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return item_to_dict(db_item)


@router.post("/bulk")
def add_bulk_items(items: List[ShoppingItemCreate], db: Session = Depends(get_db)):
    if not items:
        return []
    list_name = items[0].list_name
    base_order = db.query(models.ShoppingItem).filter(models.ShoppingItem.list_name == list_name).count()
    created = []
    for i, item in enumerate(items):
        db_item = models.ShoppingItem(name=item.name, quantity=item.quantity, order=base_order + i, list_name=item.list_name)
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
def clear_checked(list_name: str = "סופר", db: Session = Depends(get_db)):
    db.query(models.ShoppingItem).filter(
        models.ShoppingItem.checked == True,
        models.ShoppingItem.list_name == list_name
    ).delete()
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
