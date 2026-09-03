import os
import re
import json
import base64
import logging
import traceback
from google import genai
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

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


def clean_html_for_gemini(html_text: str) -> str:
    """Extract Schema.org Recipe JSON-LD or clean HTML down to readable text."""
    # First try structured data (most reliable)
    matches = re.findall(
        r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>',
        html_text, re.DOTALL | re.IGNORECASE
    )
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
                t = item.get("@type")
                if t == "Recipe" or (isinstance(t, list) and "Recipe" in t):
                    return f"SCHEMA_RECIPE_JSON: {json.dumps(item, ensure_ascii=False)}"
        except Exception:
            pass

    # Strip scripts/styles then tags
    clean = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', html_text, flags=re.DOTALL | re.IGNORECASE)
    clean = re.sub(r'<[^>]+>', ' ', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean[:40000]


EXTRACT_PROMPT = """\
You are a recipe extraction assistant. Extract the recipe from this content.
If the text is in Hebrew, output in Hebrew. If English, output in English.
Return ONLY valid JSON with no markdown, no explanation, no backticks:
{
  "name": "Recipe name",
  "category": "Category (עיקרית / קינוח / סלט / מרק / ארוחת בוקר / מאפה / נשנוש / Other)",
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
If no recipe is found, return: {"error": "No recipe found"}

Content:
"""


@router.post("/extract-recipe")
async def extract_recipe_from_image(file: UploadFile = File(...)):
    """Extract recipe from an uploaded image using Gemini vision."""
    client = get_client()
    contents = await file.read()
    mime_type = file.content_type or "image/jpeg"
    if not mime_type.startswith("image/"):
        mime_type = "image/jpeg"

    # Build contents list using the stable google-genai API
    # Pass image as inline base64 part
    image_part = {
        "inline_data": {
            "mime_type": mime_type,
            "data": base64.b64encode(contents).decode("utf-8"),
        }
    }

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=[{"parts": [{"text": RECIPE_PROMPT}, image_part]}],
        )
    except Exception as e:
        logger.error("Gemini extract-recipe FAILED: %s\n%s", str(e), traceback.format_exc())
        raise HTTPException(status_code=502, detail=f"Gemini API error: {str(e)}")

    try:
        data = parse_json_response(response.text)
    except (json.JSONDecodeError, ValueError, AttributeError) as e:
        raise HTTPException(status_code=422, detail=f"Could not parse Gemini response: {str(e)}")

    if "error" in data:
        raise HTTPException(status_code=422, detail=data["error"])

    return data


class HtmlParseRequest(BaseModel):
    """Frontend fetches the URL and sends us the raw HTML/text to parse."""
    html: str
    source_url: str = ""


@router.post("/parse-html")
async def parse_recipe_from_html(request: HtmlParseRequest):
    """Parse a recipe from raw HTML (fetched by the browser, avoids bot-blocking)."""
    extracted_text = clean_html_for_gemini(request.html)
    if not extracted_text.strip():
        raise HTTPException(status_code=422, detail="No readable content provided")

    prompt = EXTRACT_PROMPT + extracted_text

    client = get_client()
    try:
        response = client.models.generate_content(model=MODEL, contents=prompt)
    except Exception as e:
        logger.error("Gemini parse-html FAILED: %s\n%s", str(e), traceback.format_exc())
        raise HTTPException(status_code=502, detail=f"Gemini API error: {str(e)}")

    try:
        data = parse_json_response(response.text)
    except (json.JSONDecodeError, ValueError, AttributeError) as e:
        raise HTTPException(status_code=422, detail=f"Could not parse Gemini response: {str(e)}")

    if "error" in data:
        raise HTTPException(status_code=422, detail=data["error"])

    if request.source_url:
        data["source_url"] = request.source_url

    return data


class UrlExtractRequest(BaseModel):
    url: str


@router.post("/extract-from-url")
async def extract_recipe_from_url(request: UrlExtractRequest):
    """Backend-side URL fetch (fallback). Prefer /parse-html where possible."""
    import urllib.request as ureq
    url = request.url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    try:
        req = ureq.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Encoding": "gzip, deflate",
            },
        )
        with ureq.urlopen(req, timeout=15) as resp:
            charset = resp.headers.get_content_charset() or "utf-8"
            raw = resp.read()
            try:
                html_content = raw.decode(charset, errors="replace")
            except Exception:
                html_content = raw.decode("utf-8", errors="replace")
    except Exception as e:
        logger.error("fetch_url_content FAILED for %s: %s\n%s", url, str(e), traceback.format_exc())
        raise HTTPException(status_code=502, detail=f"Failed to fetch webpage: {str(e)}")

    extracted_text = clean_html_for_gemini(html_content)
    if not extracted_text.strip():
        raise HTTPException(status_code=422, detail="No readable content found at this URL")

    prompt = EXTRACT_PROMPT + extracted_text
    client = get_client()
    try:
        response = client.models.generate_content(model=MODEL, contents=prompt)
    except Exception as e:
        logger.error("Gemini extract-from-url FAILED: %s\n%s", str(e), traceback.format_exc())
        raise HTTPException(status_code=502, detail=f"Gemini API error: {str(e)}")

    try:
        data = parse_json_response(response.text)
    except (json.JSONDecodeError, ValueError, AttributeError) as e:
        raise HTTPException(status_code=422, detail=f"Could not parse Gemini response: {str(e)}")

    if "error" in data:
        raise HTTPException(status_code=422, detail=data["error"])

    data["source_url"] = url
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
