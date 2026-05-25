import os
import json
import base64
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import google.generativeai as genai

router = APIRouter(prefix="/api/gemini", tags=["gemini"])


def get_model():
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel("gemini-1.5-flash")


RECIPE_PROMPT = """
You are a recipe extraction assistant. Analyze this image and extract the recipe.
Return ONLY valid JSON in this exact format, no other text:
{
  "name": "Recipe name",
  "category": "Category (e.g. Dessert, Main Course, Salad, Soup, Breakfast, Snack)",
  "prep_time": 15,
  "cook_time": 30,
  "servings": 4,
  "difficulty": "easy|medium|hard",
  "description": "Short description",
  "ingredients": [
    {"name": "ingredient name", "quantity": "amount and unit"}
  ],
  "steps": [
    "Step 1 description",
    "Step 2 description"
  ]
}
If the image does not contain a recipe, return {"error": "No recipe found in image"}.
"""

INGREDIENTS_PROMPT = """
You are a recipe suggestion assistant. The user has these ingredients available:
{ingredients}

Search through the provided recipe context and suggest recipes that can be made.
If no perfect match exists, suggest a creative recipe using MOSTLY these ingredients.
Return ONLY valid JSON:
{{
  "suggestions": [
    {{
      "name": "Recipe name",
      "description": "Brief description",
      "missing_ingredients": ["ingredient1"],
      "matching_ingredients": ["ingredient2"]
    }}
  ]
}}
"""


@router.post("/extract-recipe")
async def extract_recipe_from_image(file: UploadFile = File(...)):
    model = get_model()
    contents = await file.read()
    image_data = base64.b64encode(contents).decode("utf-8")
    mime_type = file.content_type or "image/jpeg"

    response = model.generate_content([
        RECIPE_PROMPT,
        {"mime_type": mime_type, "data": image_data}
    ])

    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Could not parse recipe from image")

    if "error" in data:
        raise HTTPException(status_code=422, detail=data["error"])

    return data


class IngredientsRequest(BaseModel):
    ingredients: list[str]


@router.post("/suggest-recipes")
async def suggest_recipes(request: IngredientsRequest):
    model = get_model()
    ingredients_str = ", ".join(request.ingredients)
    prompt = INGREDIENTS_PROMPT.format(ingredients=ingredients_str)

    response = model.generate_content(prompt)
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Could not parse suggestions")

    return data
