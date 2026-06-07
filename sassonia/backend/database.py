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
    with engine.connect() as conn:
        cols = [row[1] for row in conn.execute(__import__('sqlalchemy').text("PRAGMA table_info(shopping_items)"))]
        if "order" not in cols:
            conn.execute(__import__('sqlalchemy').text("ALTER TABLE shopping_items ADD COLUMN \"order\" INTEGER DEFAULT 0"))
            conn.commit()
        if "list_name" not in cols:
            conn.execute(__import__('sqlalchemy').text("ALTER TABLE shopping_items ADD COLUMN list_name TEXT DEFAULT 'סופר'"))
            conn.commit()
