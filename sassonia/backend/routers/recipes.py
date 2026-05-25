import json
import os
import shutil
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
import models

router = APIRouter(prefix="/api/recipes", tags=["recipes"])

DATA_DIR = os.environ.get("DATA_DIR", "./data")
IMAGES_DIR = os.path.join(DATA_DIR, "images")
os.makedirs(IMAGES_DIR, exist_ok=True)


class RecipeCreate(BaseModel):
    name: str
    category: str = ""
    prep_time: int = 0
    cook_time: int = 0
    servings: int = 4
    difficulty: str = "medium"
    description: str = ""
    ingredients: list = []
    steps: list = []


class RecipeOut(BaseModel):
    id: int
    name: str
    category: str
    prep_time: int
    cook_time: int
    servings: int
    difficulty: str
    description: str
    ingredients: list
    steps: list
    image_path: str

    class Config:
        from_attributes = True


def recipe_to_dict(r: models.Recipe) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "category": r.category,
        "prep_time": r.prep_time,
        "cook_time": r.cook_time,
        "servings": r.servings,
        "difficulty": r.difficulty,
        "description": r.description,
        "ingredients": json.loads(r.ingredients or "[]"),
        "steps": json.loads(r.steps or "[]"),
        "image_path": r.image_path,
    }


@router.get("/")
def list_recipes(db: Session = Depends(get_db)):
    recipes = db.query(models.Recipe).all()
    return [recipe_to_dict(r) for r in recipes]


@router.get("/{recipe_id}")
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    r = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe_to_dict(r)


@router.post("/")
def create_recipe(recipe: RecipeCreate, db: Session = Depends(get_db)):
    db_recipe = models.Recipe(
        name=recipe.name,
        category=recipe.category,
        prep_time=recipe.prep_time,
        cook_time=recipe.cook_time,
        servings=recipe.servings,
        difficulty=recipe.difficulty,
        description=recipe.description,
        ingredients=json.dumps(recipe.ingredients, ensure_ascii=False),
        steps=json.dumps(recipe.steps, ensure_ascii=False),
    )
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    return recipe_to_dict(db_recipe)


@router.put("/{recipe_id}")
def update_recipe(recipe_id: int, recipe: RecipeCreate, db: Session = Depends(get_db)):
    r = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recipe not found")
    r.name = recipe.name
    r.category = recipe.category
    r.prep_time = recipe.prep_time
    r.cook_time = recipe.cook_time
    r.servings = recipe.servings
    r.difficulty = recipe.difficulty
    r.description = recipe.description
    r.ingredients = json.dumps(recipe.ingredients, ensure_ascii=False)
    r.steps = json.dumps(recipe.steps, ensure_ascii=False)
    db.commit()
    return recipe_to_dict(r)


@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    r = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.delete(r)
    db.commit()
    return {"ok": True}


@router.post("/{recipe_id}/image")
async def upload_recipe_image(recipe_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    r = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recipe not found")
    ext = file.filename.split(".")[-1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(IMAGES_DIR, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    r.image_path = f"/api/images/{filename}"
    db.commit()
    return {"image_path": r.image_path}


@router.get("/search/by-ingredients")
def search_by_ingredients(ingredients: str, db: Session = Depends(get_db)):
    """Find recipes that match given ingredients (comma-separated)."""
    ingredient_list = [i.strip().lower() for i in ingredients.split(",") if i.strip()]
    recipes = db.query(models.Recipe).all()
    results = []
    for r in recipes:
        recipe_ingredients = [i.get("name", "").lower() for i in json.loads(r.ingredients or "[]")]
        matches = sum(1 for ing in ingredient_list if any(ing in ri for ri in recipe_ingredients))
        if matches > 0:
            d = recipe_to_dict(r)
            d["match_count"] = matches
            d["match_ratio"] = matches / len(ingredient_list)
            results.append(d)
    results.sort(key=lambda x: x["match_count"], reverse=True)
    return results
