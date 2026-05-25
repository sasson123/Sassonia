from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float
from sqlalchemy.sql import func
from database import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, default="")
    prep_time = Column(Integer, default=0)
    cook_time = Column(Integer, default=0)
    servings = Column(Integer, default=4)
    difficulty = Column(String, default="medium")
    description = Column(Text, default="")
    ingredients = Column(Text, default="[]")   # JSON string
    steps = Column(Text, default="[]")          # JSON string
    image_path = Column(String, default="")
    created_at = Column(DateTime, server_default=func.now())


class ShoppingItem(Base):
    __tablename__ = "shopping_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    quantity = Column(String, default="")
    checked = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    done = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
