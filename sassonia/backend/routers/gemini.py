import os
import json
from google import genai
from google.genai import types
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/gemini", tags=["gemini"])

MODEL = "gemini-2.0-flash-lite"


def get_client():
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")
    return genai.Client(api_key=api_key)


def parse_json_response(text: str) -> dict:
    text = text.strip()
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:]
            part = part.strip()
            if part.startswith("{"):
                text = part
                break
    return json.loads(text)


RECIPE_PROMPT = """You are a recipe extraction assistant. Analyze this image and extract the recipe.
Return ONLY valid JSON with no markdown, no explanation, no extra text — just the raw JSON object:
{
  "name": "Recipe name",
  "category": "Category (Dessert / Main Course / Salad / Soup / Breakfast / Snack)",
  "prep_time": 15,
  "cook_time": 30,
  "servings": 4,
  "difficulty": "easy",
  "description": "Short description",
  "ingredients": [
    {"name": "ingredient name", "quantity": "amount and unit"}
  ],
  "steps": [
    "Step 1 description",
    "Step 2 description"
  ]
}
If no recipe is visible, return: {"error": "No recipe found in image"}"""

INGREDIENTS_PROMPT = """You are a recipe suggestion assistant.
The user has these ingredients: {ingredients}

Suggest 3 recipes that can be made mostly from these ingredients.
Return ONLY valid JSON with no markdown, no explanation:
{{
  "suggestions": [
    {{
      "name": "Recipe name",
      "description": "Brief description",
      "missing_ingredients": ["ingredient1"],
      "matching_ingredients": ["ingredient2"]
    }}
  ]
}}"""


@router.post("/extract-recipe")
async def extract_recipe_from_image(file: UploadFile = File(...)):
    client = get_client()
    contents = await file.read()
    mime_type = file.content_type or "image/jpeg"

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=[
                RECIPE_PROMPT,
                types.Part.from_bytes(data=contents, mime_type=mime_type),
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {str(e)}")

    try:
        data = parse_json_response(response.text)
    except (json.JSONDecodeError, ValueError, AttributeError) as e:
        raise HTTPException(status_code=422, detail=f"Could not parse Gemini response: {str(e)}")

    if "error" in data:
        raise HTTPException(status_code=422, detail=data["error"])

    return data


class IngredientsRequest(BaseModel):
    ingredients: list[str]


@router.post("/suggest-recipes")
async def suggest_recipes(request: IngredientsRequest):
    client = get_client()
    prompt = INGREDIENTS_PROMPT.format(ingredients=", ".join(request.ingredients))

    try:
        response = client.models.generate_content(model=MODEL, contents=prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {str(e)}")

    try:
        data = parse_json_response(response.text)
    except (json.JSONDecodeError, ValueError, AttributeError) as e:
        raise HTTPException(status_code=422, detail=f"Could not parse Gemini response: {str(e)}")

    return data
