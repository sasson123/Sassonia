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


class UrlExtractRequest(BaseModel):
    url: str


def fetch_url_content(url: str) -> str:
    import urllib.request
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=12) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        raw_bytes = resp.read()
        try:
            return raw_bytes.decode(charset, errors="replace")
        except Exception:
            return raw_bytes.decode("utf-8", errors="replace")


def clean_html(html_text: str) -> str:
    import re
    matches = re.findall(r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>', html_text, re.DOTALL | re.IGNORECASE)
    for m in matches:
        try:
            parsed = json.loads(m.strip())
            items = []
            if isinstance(parsed, list):
                items = parsed
            elif isinstance(parsed, dict):
                if "@graph" in parsed and isinstance(parsed["@graph"], list):
                    items = parsed["@graph"]
                else:
                    items = [parsed]
            for item in items:
                types = item.get("@type")
                if types == "Recipe" or (isinstance(types, list) and "Recipe" in types):
                    return f"SCHEMA_RECIPE_JSON: {json.dumps(item, ensure_ascii=False)}"
        except Exception:
            pass

    clean = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', html_text, flags=re.DOTALL | re.IGNORECASE)
    clean = re.sub(r'<[^>]+>', ' ', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean[:40000]


@router.post("/extract-from-url")
async def extract_recipe_from_url(request: UrlExtractRequest):
    url = request.url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    try:
        html_content = fetch_url_content(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch webpage: {str(e)}")

    extracted_text = clean_html(html_content)
    if not extracted_text:
        raise HTTPException(status_code=422, detail="No readable content found at this URL")

    prompt = (
        "You are a recipe extraction assistant. Extract the recipe from this webpage content.\n"
        "If the text is in Hebrew, output in Hebrew. If in English, output in English.\n"
        "Return ONLY valid JSON with no markdown, no explanation, no backticks:\n"
        "{\n"
        '  "name": "Recipe name",\n'
        '  "category": "Category (Dessert / Main Course / Salad / Soup / Breakfast / Snack / Other)",\n'
        '  "prep_time": 15,\n'
        '  "cook_time": 30,\n'
        '  "servings": 4,\n'
        '  "difficulty": "easy",\n'
        '  "description": "Short description",\n'
        '  "ingredients": [\n'
        '    {"name": "ingredient name", "quantity": "amount and unit"}\n'
        '  ],\n'
        '  "steps": [\n'
        '    "Step 1 description",\n'
        '    "Step 2 description"\n'
        '  ]\n'
        "}\n"
        'If no recipe is found, return: {"error": "No recipe found on this webpage"}\n\n'
        f"Webpage content:\n{extracted_text}"
    )

    client = get_client()
    try:
        response = client.models.generate_content(model=MODEL, contents=prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {str(e)}")

    try:
        data = parse_json_response(response.text)
    except (json.JSONDecodeError, ValueError, AttributeError) as e:
        raise HTTPException(status_code=422, detail=f"Could not parse Gemini response: {str(e)}")

    if "error" in data:
        raise HTTPException(status_code=422, detail=data["error"])

    data["source_url"] = url
    return data


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

