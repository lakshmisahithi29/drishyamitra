from models import db


# Junction tables for many-to-many relationships
photo_categories = db.Table(
    "photo_categories",
    db.Column("photo_id", db.Integer, db.ForeignKey("photos.id"), primary_key=True),
    db.Column("category_id", db.Integer, db.ForeignKey("categories.id"), primary_key=True),
)

photo_tags = db.Table(
    "photo_tags",
    db.Column("photo_id", db.Integer, db.ForeignKey("photos.id"), primary_key=True),
    db.Column("tag_id", db.Integer, db.ForeignKey("tags.id"), primary_key=True),
)


class Category(db.Model):
    """Photo category (People, Nature, Animals, etc.)."""

    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

    def to_dict(self):
        return {"id": self.id, "name": self.name}


class Tag(db.Model):
    """Custom tag for a photo."""

    __tablename__ = "tags"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)

    def to_dict(self):
        return {"id": self.id, "name": self.name}


# Default categories matching the frontend
DEFAULT_CATEGORIES = [
    "People", "Nature", "Animals", "Objects",
    "Travel", "Food", "Documents", "Other",
]
