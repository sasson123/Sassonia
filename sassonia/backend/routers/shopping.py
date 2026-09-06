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


# ── Base List ─────────────────────────────────────────────────────

def base_item_to_dict(item: models.BaseListItem) -> dict:
    return {
        "id": item.id,
        "list_name": item.list_name,
        "name": item.name,
        "quantity": item.quantity,
        "order": item.order,
    }


class BaseItemCreate(BaseModel):
    list_name: str = "סופר"
    name: str
    quantity: str = ""


@router.get("/base-items")
def get_base_items(list_name: str = "סופר", db: Session = Depends(get_db)):
    items = (
        db.query(models.BaseListItem)
        .filter(models.BaseListItem.list_name == list_name)
        .order_by(models.BaseListItem.order, models.BaseListItem.id)
        .all()
    )
    return [base_item_to_dict(i) for i in items]


@router.post("/base-items")
def add_base_item(item: BaseItemCreate, db: Session = Depends(get_db)):
    count = db.query(models.BaseListItem).filter(models.BaseListItem.list_name == item.list_name).count()
    db_item = models.BaseListItem(list_name=item.list_name, name=item.name, quantity=item.quantity, order=count)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return base_item_to_dict(db_item)


@router.post("/base-items/bulk")
def add_base_items_bulk(items: List[BaseItemCreate], db: Session = Depends(get_db)):
    if not items:
        return []
    list_name = items[0].list_name
    base_order = db.query(models.BaseListItem).filter(models.BaseListItem.list_name == list_name).count()
    created = []
    for i, item in enumerate(items):
        db_item = models.BaseListItem(list_name=item.list_name, name=item.name, quantity=item.quantity, order=base_order + i)
        db.add(db_item)
        created.append(db_item)
    db.commit()
    return [base_item_to_dict(i) for i in created]


@router.delete("/base-items/{item_id}")
def delete_base_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.BaseListItem).filter(models.BaseListItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Base item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


class ResetFromBaseRequest(BaseModel):
    list_name: str = "סופר"


@router.post("/reset-from-base")
def reset_from_base(req: ResetFromBaseRequest, db: Session = Depends(get_db)):
    """Delete ALL current items in the list and replace with base items (all unchecked)."""
    list_name = req.list_name
    base_items = (
        db.query(models.BaseListItem)
        .filter(models.BaseListItem.list_name == list_name)
        .order_by(models.BaseListItem.order, models.BaseListItem.id)
        .all()
    )
    # Delete existing
    db.query(models.ShoppingItem).filter(models.ShoppingItem.list_name == list_name).delete()
    # Insert base items as fresh, unchecked
    created = []
    for i, base in enumerate(base_items):
        db_item = models.ShoppingItem(name=base.name, quantity=base.quantity, checked=False, order=i, list_name=list_name)
        db.add(db_item)
        created.append(db_item)
    db.commit()
    return [item_to_dict(i) for i in created]


@router.post("/add-base-to-existing")
def add_base_to_existing(req: ResetFromBaseRequest, db: Session = Depends(get_db)):
    """Add base items that don't already exist (by name) to the current list."""
    list_name = req.list_name
    base_items = (
        db.query(models.BaseListItem)
        .filter(models.BaseListItem.list_name == list_name)
        .order_by(models.BaseListItem.order, models.BaseListItem.id)
        .all()
    )
    existing_names = {
        i.name.strip().lower()
        for i in db.query(models.ShoppingItem).filter(models.ShoppingItem.list_name == list_name).all()
    }
    start_order = db.query(models.ShoppingItem).filter(models.ShoppingItem.list_name == list_name).count()
    added = 0
    for base in base_items:
        if base.name.strip().lower() not in existing_names:
            db_item = models.ShoppingItem(name=base.name, quantity=base.quantity, checked=False, order=start_order + added, list_name=list_name)
            db.add(db_item)
            added += 1
    db.commit()
    all_items = (
        db.query(models.ShoppingItem)
        .filter(models.ShoppingItem.list_name == list_name)
        .order_by(models.ShoppingItem.checked, models.ShoppingItem.order, models.ShoppingItem.id)
        .all()
    )
    return [item_to_dict(i) for i in all_items]
