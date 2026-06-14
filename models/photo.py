import os
from datetime import datetime, timezone
from flask import request as flask_request
from models import db
from models.associations import photo_categories, photo_tags


class Photo(db.Model):
    """Uploaded photo with metadata."""

    __tablename__ = "photos"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.String(512), nullable=False)
    mime_type = db.Column(db.String(50), nullable=True)
    file_size = db.Column(db.Integer, nullable=True)  # bytes
    is_favorite = db.Column(db.Boolean, default=False)
    uploaded_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    file_hash = db.Column(db.String(32), nullable=True, index=True)

    # Relationships
    faces = db.relationship("Face", backref="photo", lazy="dynamic", cascade="all, delete-orphan")
    categories = db.relationship("Category", secondary=photo_categories, backref=db.backref("photos", lazy="dynamic"))
    tags = db.relationship("Tag", secondary=photo_tags, backref=db.backref("photos", lazy="dynamic"))

    @property
    def url(self) -> str:
        """Generate a stable, consistent URL for this photo."""
        # Use relative path by default
        relative_path = f"/uploads/{self.user_id}/{self.filename}"
        
        # In production or cross-origin, we might need a full URL
        try:
            # Check if we have a configured backend base URL
            backend_url = os.environ.get("BACKEND_URL")
            if backend_url:
                return f"{backend_url.rstrip('/')}{relative_path}"
                
            # Fallback to request context if available
            base = flask_request.host_url.rstrip("/")
            return f"{base}{relative_path}"
        except RuntimeError:
            # Outside request context (e.g. background task), return relative path 
            # or use a default if configured
            return relative_path

    def to_dict(self, include_faces=False):
        data = {
            "id": self.id,
            "url": self.url,
            "title": self.original_filename,
            "filename": self.filename,
            "original_filename": self.original_filename,
            "mime_type": self.mime_type,
            "file_size": self.file_size,
            "is_favorite": self.is_favorite,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "date": self.uploaded_at.strftime("%m/%d/%Y") if self.uploaded_at else None,
            "categories": [c.name for c in self.categories],
            "tags": [t.name for t in self.tags],
            "faces_count": self.faces.count(),
        }
        if include_faces:
            data["faces"] = [f.to_dict() for f in self.faces]
        return data
