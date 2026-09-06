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


def call_gemini_generate(parts: list, timeout: int = 35, temperature: float = 0.1, response_json: bool = True) -> str:
    """Calls the Google Generative Language REST API directly with automatic model fallback."""
    key = get_api_key()
    gen_config = {"temperature": temperature}
    if response_json:
        gen_config["responseMimeType"] = "application/json"

    payload = json.dumps({
        "contents": [{"parts": parts}],
        "generationConfig": gen_config,
    }).encode("utf-8")
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
    """Parses JSON from Gemini response with multi-stage syntax repair and regex fallback."""
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

    # Stage 1: Direct JSON parse
    try:
        return json.loads(text, strict=False)
    except Exception:
        pass

    # Stage 2: Fix trailing commas and Hebrew abbreviation quotes (e.g. תפו"א -> תפו״א, ק"ג -> ק״ג)
    fixed = re.sub(r'([\u0590-\u05FFa-zA-Z0-9])"([\u0590-\u05FFa-zA-Z0-9])', r'\1״\2', text)
    fixed = re.sub(r',\s*([}\]])', r'\1', fixed)
    try:
        return json.loads(fixed, strict=False)
    except Exception:
        pass

    # Stage 3: Escape internal unescaped quotes line-by-line
    lines = []
    for line in fixed.splitlines():
        # Key-value line: "key": "val with "inner" quotes",
        m = re.match(r'^(\s*"[^"]+"\s*:\s*")(.*)("[,]?\s*)$', line)
        if m:
            prefix, val, suffix = m.group(1), m.group(2), m.group(3)
            val_clean = re.sub(r'(?<!\\)"', r'\"', val)
            lines.append(prefix + val_clean + suffix)
            continue
        # Array string line: "val with "inner" quotes",
        m2 = re.match(r'^(\s*")(.*)("[,]?\s*)$', line)
        if m2 and not re.match(r'^\s*"[^"]+"\s*:', line):
            prefix, val, suffix = m2.group(1), m2.group(2), m2.group(3)
            val_clean = re.sub(r'(?<!\\)"', r'\"', val)
            lines.append(prefix + val_clean + suffix)
            continue
        lines.append(line)

    fixed_lines = '\n'.join(lines)
    fixed_lines = re.sub(r',\s*([}\]])', r'\1', fixed_lines)
    try:
        return json.loads(fixed_lines, strict=False)
    except Exception:
        pass

    # Stage 4: Fallback regex extractor for recipe schema
    res = {
        "name": "",
        "category": "עיקרית",
        "prep_time": 0,
        "cook_time": 0,
        "servings": 4,
        "difficulty": "easy",
        "description": "",
        "ingredients": [],
        "steps": []
    }

    name_m = re.search(r'"name"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', text)
    if name_m:
        res["name"] = name_m.group(1).replace('\\"', '"')

    cat_m = re.search(r'"category"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', text)
    if cat_m:
        res["category"] = cat_m.group(1)

    desc_m = re.search(r'"description"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', text)
    if desc_m:
        res["description"] = desc_m.group(1).replace('\\"', '"')

    # Extract ingredients: objects with name and quantity
    ing_matches = re.finditer(
        r'\{[^{}]*?"name"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"[^{}]*?(?:"quantity"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)")?[^{}]*?\}',
        text
    )
    for im in ing_matches:
        iname = im.group(1).replace('\\"', '"').strip()
        iqty = (im.group(2) or "").replace('\\"', '"').strip()
        if iname:
            res["ingredients"].append({"name": iname, "quantity": iqty})

    # Extract steps array strings
    steps_block = re.search(r'"steps"\s*:\s*\[([\s\S]*?)\]\s*[,}]', text)
    if steps_block:
        step_items = re.finditer(r'"([^"\\]*(?:\\.[^"\\]*)*)"', steps_block.group(1))
        for sm in step_items:
            s_text = sm.group(1).replace('\\"', '"').strip()
            if s_text:
                res["steps"].append(s_text)

    if res["ingredients"] or res["steps"] or res["name"]:
        logger.warning(
            "JSON parse failed, recovered recipe via regex fallback (name=%s, %d ingredients, %d steps)",
            res["name"], len(res["ingredients"]), len(res["steps"])
        )
        return res

    # If all recovery attempts failed, re-raise original json.loads error
    return json.loads(text)


RECIPE_PROMPT = """You are a precision OCR and recipe transcription engine.
Your task is to accurately transcribe the recipe from the provided image (photo of a cookbook, handwritten note, screenshot, or recipe card).

CRITICAL ACCURACY & FIDELITY RULES:
1. VERBATIM TRANSCRIPTION: Copy the exact recipe title, ingredients, quantities, and preparation steps exactly as they are written in the image. Do NOT invent, assume, extrapolate, or embellish anything.
2. RECIPE NAME: Use the EXACT title printed or handwritten on the recipe. If no title is written, name it strictly based on the core visible dish without flowery adjectives.
3. NO HALLUCINATIONS: Do NOT add ingredients (such as salt, pepper, oil, water) or steps unless they are explicitly written in the image.
4. QUANTITIES: Preserve exact units, fractions, and phrasing as written (e.g. '1/2 כוס', '200 גרם', 'כף').
5. LANGUAGE: If the recipe is in Hebrew, output in Hebrew. If in English, output in English. Keep the original wording verbatim without rephrasing or translating.
6. DESCRIPTION: Only include a description if one is actually printed on the image. Otherwise, return an empty string "". Do NOT invent a description.

Return ONLY a JSON object matching this schema:
{
  "name": "Exact title from image",
  "category": "עיקרית / קינוח / סלט / מרק / ארוחת בוקר / מאפה / נשנוש / אחר",
  "prep_time": 0,
  "cook_time": 0,
  "servings": 4,
  "difficulty": "easy",
  "description": "Verbatim text or empty string",
  "ingredients": [
    {"name": "ingredient name as written", "quantity": "exact quantity as written"}
  ],
  "steps": [
    "Exact step 1 as written",
    "Exact step 2 as written"
  ]
}
If no recipe or text is visible, return: {"error": "No recipe found in image"}"""

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

URL_PROMPT = """You are a precision recipe extraction engine. Extract the complete recipe faithfully from this webpage content.

CRITICAL ACCURACY & FIDELITY RULES:
1. VERBATIM TRANSCRIPTION: Extract the exact recipe title, ingredients, quantities, and instructions as published on the page. Do NOT invent or add ingredients.
2. RECIPE NAME: Use the exact title of the recipe as given by the author/website.
3. QUANTITIES: Preserve exact units and amounts as published.
4. LANGUAGE: If the webpage text is in Hebrew, output in Hebrew. If in English, output in English.
5. DESCRIPTION: Short verbatim excerpt or empty string "". Do not invent flowery marketing text.

Return ONLY a JSON object matching this schema:
{
  "name": "Recipe name",
  "category": "עיקרית / קינוח / סלט / מרק / ארוחת בוקר / מאפה / נשנוש / אחר",
  "prep_time": 0,
  "cook_time": 0,
  "servings": 4,
  "difficulty": "easy",
  "description": "Verbatim excerpt or empty string",
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


# ---------- Two-pass OCR prompts for image extraction ----------

OCR_PASS1_PROMPT = """You are a precise OCR engine.
Your ONLY task: transcribe every piece of text visible in this image, word for word, exactly as it appears.

Rules:
- Output the raw text line by line, preserving the original layout as closely as possible.
- Do NOT paraphrase, translate, summarize, or interpret anything.
- Do NOT add any words, punctuation, or structure that is not in the image.
- If some text is unclear or partially cut off, write it as best you can and mark it with [?].
- Output ONLY the transcribed text — no explanations, no commentary, no JSON."""

OCR_PASS2_PROMPT = """You are a recipe parser. Below is raw text that was transcribed verbatim from a recipe image using OCR.
Your task: parse this raw text into a structured JSON recipe object.

Rules:
- Use ONLY information found in the raw text below. Do NOT add ingredients, steps, or details not present in the text.
- Preserve the exact wording of ingredient names and quantities as they appear in the text.
- If a field (e.g. prep_time, servings) is not mentioned in the text, use 0 or a sensible default.
- If the text is in Hebrew, output all text fields in Hebrew. If in English, output in English.
- category must be ONE of: עיקרית / קינוח / סלט / מרק / ארוחת בוקר / מאפה / נשנוש / אחר
- difficulty must be ONE of: easy / medium / hard
- JSON SAFETY: Output strictly valid JSON. NEVER include unescaped double quotes inside string values. For Hebrew abbreviations (such as תפו"א, ק"ג, א"א) use gershayim (תפו״א, ק״ג) or single quotes (תפו'א) or full words. Do not add trailing commas.

Return ONLY a JSON object matching this schema — no markdown, no backticks, no explanation:
{
  "name": "Recipe title as it appears in the text",
  "category": "עיקרית",
  "prep_time": 0,
  "cook_time": 0,
  "servings": 4,
  "difficulty": "easy",
  "description": "Only if a description/intro appears in the text, else empty string",
  "ingredients": [
    {"name": "ingredient name as in text", "quantity": "exact quantity as in text"}
  ],
  "steps": [
    "Step 1 exactly as in text",
    "Step 2 exactly as in text"
  ]
}
If the text does not contain any recipe, return: {"error": "No recipe found in image"}

--- RAW OCR TEXT BELOW ---
"""


@router.post("/extract-recipe")
async def extract_recipe_from_image(file: UploadFile = File(...)):
    """Two-pass OCR: Pass 1 transcribes raw text, Pass 2 parses it into structured recipe JSON."""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    mime_type = file.content_type or "image/jpeg"
    if not mime_type.startswith("image/"):
        mime_type = "image/jpeg"

    b64_data = base64.b64encode(contents).decode("utf-8")

    # ── Pass 1: Raw OCR — transcribe every visible character, no interpretation ──
    pass1_parts = [
        {"text": OCR_PASS1_PROMPT},
        {"inline_data": {"mime_type": mime_type, "data": b64_data}},
    ]
    raw_text = call_gemini_generate(
        pass1_parts,
        timeout=40,
        temperature=0.0,   # fully deterministic OCR
        response_json=False,  # plain text, not JSON
    )
    logger.info("OCR Pass-1 raw text (%d chars): %s", len(raw_text), raw_text[:200])

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from the image")

    # ── Pass 2: Structure — parse the raw OCR text into recipe JSON ──
    pass2_parts = [{"text": OCR_PASS2_PROMPT + raw_text}]
    raw_response = call_gemini_generate(
        pass2_parts,
        timeout=35,
        temperature=0.1,
        response_json=True,
    )

    try:
        data = parse_json_response(raw_response)
    except Exception as e:
        logger.error("Could not parse Gemini JSON (Pass 2): %s\nRaw was: %s", str(e), raw_response[:300])
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
