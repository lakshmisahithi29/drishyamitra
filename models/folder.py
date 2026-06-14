from datetime import datetime, timezone
from models import db

# Many‑to‑many association
folder_photos = db.Table(
    "folder_photos",
    db.Column("folder_id", db.Integer, db.ForeignKey("folders.id"), primary_key=True),
    db.Column("photo_id", db.Integer, db.ForeignKey("photos.id"), primary_key=True),
)


class Folder(db.Model):
    """User‑created folder that groups photos."""

    __tablename__ = "folders"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    photos = db.relationship("Photo", secondary=folder_photos, backref=db.backref("folders", lazy="dynamic"))

    def to_dict(self, include_photos=False):
        d = {
            "id": self.id,
            "name": self.name,
            "photo_count": len(self.photos),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_photos:
            d["photos"] = [p.to_dict() for p in self.photos]
        return d
