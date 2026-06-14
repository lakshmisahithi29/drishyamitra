import os
from datetime import datetime, timezone
from models import db


class Person(db.Model):
    """A named person identified across photos."""

    __tablename__ = "persons"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    avatar_path = db.Column(db.String(512), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    faces = db.relationship("Face", backref="person", lazy="dynamic")

    def to_dict(self):
        photo_count = self.faces.count()
        avatar = None
        
        # Determine base URL for relative paths
        backend_url = os.environ.get("BACKEND_URL", "").rstrip("/")
        
        if self.avatar_path:
            avatar = f"{backend_url}{self.avatar_path}" if backend_url else self.avatar_path
        elif photo_count > 0:
            # Use the first photo that has this person's face as a fallback avatar
            first_face = self.faces.first()
            if first_face and first_face.photo:
                path = f"/uploads/{self.user_id}/{first_face.photo.filename}"
                avatar = f"{backend_url}{path}" if backend_url else path
        return {
            "id": self.id,
            "name": self.name,
            "avatar": avatar or "",
            "photoCount": photo_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
