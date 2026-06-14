"""
Face detection service using MediaPipe Tasks API.

Architecture for embedding-based recognition:

    Detection (active — MediaPipe):
        detect_faces_in_image()  → bounding boxes + confidence
        detect_faces_from_bytes()→ same, from raw bytes

    Cropping (active):
        crop_face()              → numpy array of face region

    Embedding (infrastructure ready — plug in any model):
        extract_embedding()      → numpy vector from face crop
        store_embedding()        → persist vector to Face record

    Recognition (infrastructure ready):
        find_matching_person()   → cosine similarity against stored embeddings
        compute_similarity()     → cosine similarity between two vectors

    To enable auto-recognition:
        1. pip install deepface (or your chosen library)
        2. Uncomment the DeepFace block in extract_embedding()
        3. Call process_embeddings_for_photo() after save_detected_faces()
    No route or schema changes needed.
"""

import os
import cv2
import numpy as np
from models import db
from models.face import Face
from models.person import Person

# Model path
_MODEL_PATH = os.path.abspath(os.path.normpath(os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "models",
    "blaze_face_short_range.tflite",
)))


# ──────────────────────────────────────────────────
# Detection (MediaPipe)
# ──────────────────────────────────────────────────

def _detect_faces_with_mediapipe(image_np: np.ndarray, min_confidence: float = 0.5) -> list[dict]:
    """Run MediaPipe face detection on a numpy image array (BGR)."""
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions
    from mediapipe.tasks.python.vision import (
        FaceDetector,
        FaceDetectorOptions,
        RunningMode,
    )

    if not os.path.exists(_MODEL_PATH):
        print(f"[WARN] Face detection model not found at {_MODEL_PATH}")
        return []

    image_rgb = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)

    options = FaceDetectorOptions(
        base_options=BaseOptions(model_asset_path=_MODEL_PATH),
        min_detection_confidence=min_confidence,
        running_mode=RunningMode.IMAGE,
    )

    results = []
    with FaceDetector.create_from_options(options) as detector:
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
        detection_result = detector.detect(mp_image)

        h, w = image_np.shape[:2]

        for detection in detection_result.detections:
            bbox = detection.bounding_box
            results.append({
                "x": max(0.0, bbox.origin_x / w),
                "y": max(0.0, bbox.origin_y / h),
                "width": min(1.0, bbox.width / w),
                "height": min(1.0, bbox.height / h),
                "confidence": round(detection.categories[0].score, 3)
                if detection.categories else 0.0,
            })

    return results


def detect_faces_in_image(image_path: str, min_confidence: float = 0.5) -> list[dict]:
    """
    Detect faces in an image file.

    Returns a list of dicts with bounding box (relative coords 0-1) and confidence.
    """
    image = cv2.imread(image_path)
    if image is None:
        return []
    return _detect_faces_with_mediapipe(image, min_confidence)


def detect_faces_from_bytes(image_bytes: bytes, min_confidence: float = 0.5) -> list[dict]:
    """Detect faces from raw image bytes (e.g., from an uploaded file)."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        return []
    return _detect_faces_with_mediapipe(image, min_confidence)


def analyze_faces_in_image(image_path: str, user_id: int, min_confidence: float = 0.5) -> list[dict]:
    """
    Detect faces and attempt to recognize them for analysis (not persisted).
    
    Returns a list of dicts with bbox, confidence, and matching person info.
    """
    detected_faces = detect_faces_in_image(image_path, min_confidence)
    results = []
    
    for bbox in detected_faces:
        analysis = {**bbox, "person": None}
        
        # Pull recognition logic from face_service if possible
        embedding = extract_embedding(image_path, bbox)
        if embedding is not None:
            matched_person = find_matching_person(embedding, user_id)
            if matched_person:
                analysis["person"] = {
                    "id": matched_person.id,
                    "name": matched_person.name
                }
        
        results.append(analysis)
        
    return results


# ──────────────────────────────────────────────────
# Face cropping
# ──────────────────────────────────────────────────

def crop_face(image_np: np.ndarray, bbox: dict, padding: float = 0.2) -> np.ndarray:
    """
    Crop a face region from an image using relative bounding box coordinates.

    Args:
        image_np: BGR numpy image
        bbox: dict with x, y, width, height (relative 0-1)
        padding: extra padding around the face (0.2 = 20%)

    Returns:
        Cropped face region as numpy array (BGR)
    """
    h, w = image_np.shape[:2]
    pad_w = padding * bbox["width"]
    pad_h = padding * bbox["height"]

    x1 = int(max(0.0, bbox["x"] - pad_w) * w)
    y1 = int(max(0.0, bbox["y"] - pad_h) * h)
    x2 = int(min(1.0, bbox["x"] + bbox["width"] + pad_w) * w)
    y2 = int(min(1.0, bbox["y"] + bbox["height"] + pad_h) * h)

    # Ensure valid crop dimensions
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)

    if x2 <= x1 or y2 <= y1:
        return np.zeros((1, 1, 3), dtype=np.uint8)

    return image_np[y1:y2, x1:x2].copy()


def crop_face_from_path(image_path: str, bbox: dict, padding: float = 0.2) -> np.ndarray | None:
    """Convenience: load image from path and crop face."""
    image = cv2.imread(image_path)
    if image is None:
        return None
    return crop_face(image, bbox, padding)


# ──────────────────────────────────────────────────
# Database operations
# ──────────────────────────────────────────────────

def save_detected_faces(photo_id: int, face_data: list[dict]) -> list[Face]:
    """Save detected face records to the database for a photo."""
    faces = []
    for fd in face_data:
        face = Face(
            photo_id=photo_id,
            x=fd["x"],
            y=fd["y"],
            width=fd["width"],
            height=fd["height"],
            confidence=fd.get("confidence"),
        )
        db.session.add(face)
        faces.append(face)

    db.session.commit()
    return faces


def assign_face_to_person(face_id: int, person_name: str, user_id: int) -> Face | None:
    """Assign a detected face to a person (create person if needed)."""
    face = Face.query.get(face_id)
    if not face:
        return None

    # Find or create person
    person = Person.query.filter_by(name=person_name, user_id=user_id).first()
    if not person:
        person = Person(name=person_name, user_id=user_id)
        db.session.add(person)
        db.session.flush()

    face.person_id = person.id
    db.session.commit()
    print(f"[DEBUG] Face {face_id} linked to person {person.id} ({person.name})")
    return face


# ──────────────────────────────────────────────────
# Embedding infrastructure (fully implemented)
# ──────────────────────────────────────────────────

def compute_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """
    Compute cosine similarity between two embedding vectors.

    Returns:
        Float in range [-1, 1]. Typically > 0.6 means same person.
    """
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))


def store_embedding(face: Face, embedding: np.ndarray, model_name: str = "unknown") -> None:
    """Store an embedding vector on a Face record and commit."""
    face.set_embedding(embedding, model_name)
    db.session.commit()


def get_all_embeddings_for_user(user_id: int) -> list[tuple[Face, np.ndarray]]:
    """
    Retrieve all faces with stored embeddings for a user.

    Returns:
        List of (Face, embedding_vector) tuples.
    """
    faces = (
        Face.query
        .join(Face.photo)
        .filter(Face.embedding.isnot(None))
        .filter_by(user_id=user_id)
        .all()
    )
    result = []
    for face in faces:
        emb = face.get_embedding()
        if emb is not None:
            result.append((face, emb))
    return result


def find_matching_person(
    embedding: np.ndarray,
    user_id: int,
    threshold: float = 0.6,
) -> Person | None:
    """
    Find a Person by comparing an embedding against all stored embeddings
    via cosine similarity.

    Args:
        embedding: The query face embedding vector
        user_id: Owner of the photo library
        threshold: Minimum cosine similarity to consider a match (default 0.6)

    Returns:
        Matching Person or None
    """
    best_similarity = -1.0
    best_person = None

    stored = get_all_embeddings_for_user(user_id)
    for face, stored_emb in stored:
        if face.person_id is None:
            continue
        sim = compute_similarity(embedding, stored_emb)
        if sim >= threshold and sim > best_similarity:
            best_similarity = sim
            best_person = face.person

    return best_person


def extract_embedding(image_path: str, bbox: dict, model_name: str = "facenet") -> np.ndarray | None:
    """
    Extract a face embedding vector from a cropped face region using DeepFace.
    """
    try:
        from deepface import DeepFace
        # Map the model names to what DeepFace expects
        deepface_model = model_name.capitalize() if model_name == "facenet" else "ArcFace"
        
        face_crop = crop_face_from_path(image_path, bbox)
        if face_crop is None or face_crop.size == 0:
            return None
            
        # DeepFace expects RGB for representation
        face_crop_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
        
        result = DeepFace.represent(
            face_crop_rgb,
            model_name=deepface_model,
            enforce_detection=False, # We already detected it with MediaPipe
        )
        
        if result and len(result) > 0:
            return np.array(result[0]["embedding"], dtype=np.float32)
    except Exception as e:
        print(f"[WARN] Embedding extraction failed: {e}")
    return None


def process_embeddings_for_photo(photo_id: int, image_path: str, user_id: int, model_name: str = "facenet") -> int:
    """
    Extract and store embeddings for all detected faces in a photo,
    then attempt to auto-match them to known persons.

    Call this after save_detected_faces() to enable auto-recognition.

    Returns:
        Number of faces that were auto-matched to existing persons.
    """
    faces = Face.query.filter_by(photo_id=photo_id).all()
    auto_matched = 0

    for face in faces:
        bbox = {"x": face.x, "y": face.y, "width": face.width, "height": face.height}
        embedding = extract_embedding(image_path, bbox, model_name)

        if embedding is None:
            continue

        # Store embedding
        store_embedding(face, embedding, model_name)

        # Auto-match if face hasn't been assigned yet
        if face.person_id is None:
            matched_person = find_matching_person(embedding, user_id)
            if matched_person:
                face.person_id = matched_person.id
                db.session.commit()
                auto_matched += 1

    return auto_matched
