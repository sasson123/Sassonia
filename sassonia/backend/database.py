import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATA_DIR = os.environ.get("DATA_DIR", "./data")
os.makedirs(DATA_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{DATA_DIR}/sassonia.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    text = __import__('sqlalchemy').text
    with engine.connect() as conn:
        cols = [row[1] for row in conn.execute(text("PRAGMA table_info(shopping_items)"))]
        if "order" not in cols:
            conn.execute(text("ALTER TABLE shopping_items ADD COLUMN \"order\" INTEGER DEFAULT 0"))
            conn.commit()
        if "list_name" not in cols:
            conn.execute(text("ALTER TABLE shopping_items ADD COLUMN list_name TEXT DEFAULT 'סופר'"))
            conn.commit()

        recipe_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(recipes)"))]
        if "source_url" not in recipe_cols:
            conn.execute(text("ALTER TABLE recipes ADD COLUMN source_url TEXT DEFAULT ''"))
            conn.commit()

        # Create shopping_lists table if missing and seed default list
        tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))]
        if "shopping_lists" not in tables:
            conn.execute(text(
                "CREATE TABLE shopping_lists "
                "(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, position INTEGER DEFAULT 0, "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
            ))
            conn.execute(text("INSERT INTO shopping_lists (name, position) VALUES ('סופר', 0)"))
            conn.commit()
