import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base, run_migrations
import models
from routers import recipes, shopping, tasks, gemini

Base.metadata.create_all(bind=engine)
run_migrations()

app = FastAPI(title="Sassonia API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recipes.router)
app.include_router(shopping.router)
app.include_router(tasks.router)
app.include_router(gemini.router)

DATA_DIR = os.environ.get("DATA_DIR", "./data")
IMAGES_DIR = os.path.join(DATA_DIR, "images")
os.makedirs(IMAGES_DIR, exist_ok=True)

app.mount("/api/images", StaticFiles(directory=IMAGES_DIR), name="images")

APP_VERSION = "1.3.4"

@app.get("/api/version")
async def get_version():
    return {
        "version": APP_VERSION,
        "name": "Sassonia",
    }

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(STATIC_DIR):
    NO_CACHE_HEADERS = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            filename = os.path.basename(file_path)
            if filename in ("sw.js", "manifest.json", "index.html"):
                return FileResponse(file_path, headers=NO_CACHE_HEADERS)
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"), headers=NO_CACHE_HEADERS)
