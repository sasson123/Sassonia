import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models
from routers import recipes, shopping, tasks, gemini

Base.metadata.create_all(bind=engine)

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

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        index = os.path.join(STATIC_DIR, "index.html")
        return FileResponse(index)
