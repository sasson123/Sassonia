import os
import re
import json
import base64
import gzip
import zlib
import logging
import traceback
import urllib.request
import urllib.error
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gemini", tags=["gemini"])

# Candidate models in priority order. If one is deprecated/unavailable, automatically fallback.
MODELS = ["gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest"]


def get_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")
    return key


def call_gemini_generate(parts: list, timeout: int = 35) -> str:
    """Calls the Google Generative Language REST API directly with automatic model fallback."""
    key = get_api_key()
    payload = json.dumps({"contents": [{"parts": parts}]}).encode("utf-8")
    last_error = None

    for model_name in MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if not candidates:
                    raise ValueError("No candidates returned from Gemini")
                text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                return text
        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            logger.warning("Gemini model %s returned HTTP %s: %s", model_name, e.code, err_body)
            last_error = f"HTTP {e.code}: {err_body}"
            # If 404 (model not found/deprecated), try next model
            if e.code == 404:
                continue
            # For 429 (rate limit) or 503 (service unavailable), also try next model
            if e.code in (429, 503):
                continue
            # For 400 or other client errors, don't retry if invalid argument
            raise HTTPException(status_code=502, detail=f"Gemini API error: {last_error}")
        except Exception as e:
            logger.warning("Gemini model %s failed: %s", model_name, str(e))
            last_error = str(e)
            continue

    logger.error("All Gemini candidate models failed. Last error: %s", last_error)
    raise HTTPException(status_code=502, detail=f"Gemini API unavailable: {last_error}")


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


RECIPE_PROMPT = """You are an expert recipe extraction assistant.
Analyze this recipe image (photo of a cookbook, handwritten recipe, dish with recipe card, or screenshot).
Extract the recipe details. If the text is in Hebrew, output in Hebrew. If in English, output in English.

Return ONLY valid JSON with no markdown formatting, no explanations, no code blocks:
{
  "name": "Recipe name",
  "category": "Category (עיקרית / קינוח / סלט / מרק / ארוחת בוקר / מאפה / נשנוש / אחר)",
  "prep_time": 15,
  "cook_time": 30,
  "servings": 4,
  "difficulty": "easy",
  "description": "Short appetizing description",
  "ingredients": [
    {"name": "ingredient name", "quantity": "amount and unit"}
  ],
  "steps": [
    "Step 1 description",
    "Step 2 description"
  ]
}
If no recipe is visible in the image, return: {"error": "No recipe found in image"}"""

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

URL_PROMPT = """You are an expert recipe extraction assistant. Extract the complete recipe from this webpage content.
If the webpage text is in Hebrew, output in Hebrew. If in English, output in English.

Return ONLY valid JSON with no markdown formatting, no explanations, no backticks:
{
  "name": "Recipe name",
  "category": "Category (עיקרית / קינוח / סלט / מרק / ארוחת בוקר / מאפה / נשנוש / אחר)",
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
If no recipe is found on this page, return: {"error": "No recipe found"}

Webpage content:
"""


def clean_html_for_gemini(html_text: str) -> str:
    # 1. First priority: Check for Schema.org JSON-LD Recipe (highest accuracy)
    matches = re.findall(
        r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>',
        html_text,
        re.DOTALL | re.IGNORECASE,
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

    # 2. Strip scripts and stylesheets
    clean = re.sub(r'<(script|style|svg|noscript)[^>]*>.*?</\1>', ' ', html_text, flags=re.DOTALL | re.IGNORECASE)
    # 3. Strip HTML tags
    clean = re.sub(r'<[^>]+>', ' ', clean)
    # 4. Collapse whitespace
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean[:40000]


def fetch_url(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate",
            "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        content_encoding = resp.headers.get("Content-Encoding", "").lower()
        raw = resp.read()
        if content_encoding == "gzip":
            try:
                raw = gzip.decompress(raw)
            except Exception:
                pass
        elif content_encoding == "deflate":
            try:
                raw = zlib.decompress(raw)
            except Exception:
                pass

        charset = resp.headers.get_content_charset() or "utf-8"
        try:
            return raw.decode(charset, errors="replace")
        except Exception:
            return raw.decode("utf-8", errors="replace")


@router.post("/extract-recipe")
async def extract_recipe_from_image(file: UploadFile = File(...)):
    """Extracts a recipe from an uploaded photo or screenshot."""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    mime_type = file.content_type or "image/jpeg"
    if not mime_type.startswith("image/"):
        mime_type = "image/jpeg"

    b64_data = base64.b64encode(contents).decode("utf-8")
    parts = [
        {"text": RECIPE_PROMPT},
        {"inline_data": {"mime_type": mime_type, "data": b64_data}},
    ]

    raw_response = call_gemini_generate(parts, timeout=40)

    try:
        data = parse_json_response(raw_response)
    except Exception as e:
        logger.error("Could not parse Gemini JSON: %s\nRaw was: %s", str(e), raw_response[:300])
        raise HTTPException(status_code=422, detail=f"Could not parse Gemini response: {str(e)}")

    if "error" in data:
        raise HTTPException(status_code=422, detail=data["error"])

    return data


class UrlExtractRequest(BaseModel):
    url: str


@router.post("/extract-from-url")
async def extract_recipe_from_url(request: UrlExtractRequest):
    """Fetches a webpage URL, extracts the recipe, and formats it."""
    url = request.url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    try:
        html_content = fetch_url(url)
    except Exception as e:
        logger.error("fetch_url failed for %s: %s\n%s", url, str(e), traceback.format_exc())
        raise HTTPException(status_code=502, detail=f"Failed to fetch webpage: {str(e)}")

    cleaned = clean_html_for_gemini(html_content)
    if not cleaned.strip():
        raise HTTPException(status_code=422, detail="No readable content found at this URL")

    prompt = URL_PROMPT + cleaned
    raw_response = call_gemini_generate([{"text": prompt}], timeout=35)

    try:
        data = parse_json_response(raw_response)
    except Exception as e:
        logger.error("Could not parse Gemini JSON from URL extract: %s", str(e))
        raise HTTPException(status_code=422, detail=f"Could not parse Gemini response: {str(e)}")

    if "error" in data:
        raise HTTPException(status_code=422, detail=data["error"])

    data["source_url"] = url
    return data


class HtmlParseRequest(BaseModel):
    html: str
    source_url: str = ""


@router.post("/parse-html")
async def parse_recipe_from_html(request: HtmlParseRequest):
    """Parses recipe from raw HTML."""
    cleaned = clean_html_for_gemini(request.html)
    if not cleaned.strip():
        raise HTTPException(status_code=422, detail="No readable content provided")

    prompt = URL_PROMPT + cleaned
    raw_response = call_gemini_generate([{"text": prompt}], timeout=35)

    try:
        data = parse_json_response(raw_response)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse Gemini response: {str(e)}")

    if "error" in data:
        raise HTTPException(status_code=422, detail=data["error"])

    if request.source_url:
        data["source_url"] = request.source_url

    return data


class IngredientsRequest(BaseModel):
    ingredients: list[str]


@router.post("/suggest-recipes")
async def suggest_recipes(request: IngredientsRequest):
    prompt = INGREDIENTS_PROMPT.format(ingredients=", ".join(request.ingredients))
    raw_response = call_gemini_generate([{"text": prompt}], timeout=25)

    try:
        data = parse_json_response(raw_response)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse Gemini response: {str(e)}")

    return data
