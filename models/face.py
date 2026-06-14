import json
import numpy as np
from models import db


class Face(db.Model):
    """
    Detected face in a photo, optionally linked to a Person.

    Embedding support:
        The `embedding` column stores a serialized numpy array (float32) as JSON.
        Use `set_embedding()` / `get_embedding()` helpers to work with numpy arrays.
        This enables future integration with DeepFace, FaceNet, ArcFace, etc.
        without schema changes — just call `set_embedding()` after extracting features.
    """

    __tablename__ = "faces"

    id = db.Column(db.Integer, primary_key=True)
    photo_id = db.Column(db.Integer, db.ForeignKey("photos.id"), nullable=False, index=True)
    person_id = db.Column(db.Integer, db.ForeignKey("persons.id"), nullable=True, index=True)

    # Bounding box (relative coordinates 0-1)
    x = db.Column(db.Float, nullable=False, default=0.0)
    y = db.Column(db.Float, nullable=False, default=0.0)
    width = db.Column(db.Float, nullable=False, default=0.0)
    height = db.Column(db.Float, nullable=False, default=0.0)

    confidence = db.Column(db.Float, nullable=True)

    # ── Embedding support ──────────────────────────
    # Stores serialized face embedding vector (JSON of float list)
    # Compatible with DeepFace (128-d), FaceNet (128/512-d), ArcFace (512-d)
    embedding = db.Column(db.Text, nullable=True)
    embedding_model = db.Column(db.String(50), nullable=True)  # e.g. "facenet", "arcface"

    # ── Helpers ────────────────────────────────────

    def set_embedding(self, vector: np.ndarray, model_name: str = "unknown") -> None:
        """Store a numpy embedding vector as serialized JSON."""
        self.embedding = json.dumps(vector.astype(float).tolist())
        self.embedding_model = model_name

    def get_embedding(self) -> np.ndarray | None:
        """Retrieve the stored embedding as a numpy array, or None."""
        if not self.embedding:
            return None
        return np.array(json.loads(self.embedding), dtype=np.float32)

    @property
    def has_embedding(self) -> bool:
        return self.embedding is not None

    def to_dict(self):
        return {
            "id": self.id,
            "photo_id": self.photo_id,
            "person_id": self.person_id,
            "person_name": self.person.name if self.person_id and self.person else None,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "confidence": self.confidence,
            "has_embedding": self.has_embedding,
            "embedding_model": self.embedding_model,
        }
