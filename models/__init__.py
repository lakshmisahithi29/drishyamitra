from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import all models so they are registered with SQLAlchemy
from models.user import User
from models.photo import Photo
from models.face import Face
from models.person import Person
from models.folder import Folder, folder_photos
from models.associations import Category, Tag, photo_categories, photo_tags

__all__ = [
    "db",
    "User",
    "Photo",
    "Face",
    "Person",
    "Folder",
    "folder_photos",
    "Category",
    "Tag",
    "photo_categories",
    "photo_tags",
]
