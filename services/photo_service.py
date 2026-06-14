import os
import uuid
import hashlib
from werkzeug.utils import secure_filename
from flask import current_app
from models import db
from models.photo import Photo
from models.associations import Category, Tag
from models.folder import folder_photos


ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif", "bmp"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_uploaded_file(file, user_id: int) -> dict:
    """Save an uploaded file to disk and return file metadata."""
    if not file or not file.filename:
        raise ValueError("No file provided")

    if not allowed_file(file.filename):
        raise ValueError(f"File type not allowed. Supported: {', '.join(ALLOWED_EXTENSIONS)}")

    original_filename = secure_filename(file.filename)
    ext = original_filename.rsplit(".", 1)[1].lower() if "." in original_filename else "jpg"
    unique_filename = f"{uuid.uuid4().hex}.{ext}"

    user_dir = os.path.abspath(os.path.join(current_app.config["UPLOAD_FOLDER"], str(user_id)))
    os.makedirs(user_dir, exist_ok=True)

    filepath = os.path.normpath(os.path.join(user_dir, unique_filename))
    file.save(filepath)

    file_size = os.path.getsize(filepath)

    return {
        "filename": unique_filename,
        "original_filename": original_filename,
        "filepath": filepath,
        "mime_type": file.content_type or f"image/{ext}",
        "file_size": file_size,
    }


def create_photo(user_id: int, file_info: dict, categories: list[str] = None, tags: list[str] = None) -> Photo:
    """Create a Photo record with associated categories and tags."""
    photo = Photo(
        user_id=user_id,
        filename=file_info["filename"],
        original_filename=file_info["original_filename"],
        filepath=file_info["filepath"],
        mime_type=file_info["mime_type"],
        file_size=file_info["file_size"],
        file_hash=get_image_hash(file_info["filepath"]),
    )
    db.session.add(photo)

    # Link categories
    if categories:
        for cat_name in categories:
            category = Category.query.filter_by(name=cat_name).first()
            if category:
                photo.categories.append(category)

    # Link tags (create if not exists)
    if tags:
        for tag_name in tags:
            tag_name = tag_name.strip()
            if not tag_name:
                continue
            tag = Tag.query.filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.session.add(tag)
            photo.tags.append(tag)

    db.session.commit()
    return photo


def get_photos(user_id: int, category: str = None, tag: str = None,
               person_id: int = None, search: str = None,
               favorites_only: bool = False, page: int = 1,
               per_page: int = 50) -> dict:
    """Query photos with optional filters, returns paginated result."""
    query = Photo.query.filter_by(user_id=user_id)

    if favorites_only:
        query = query.filter_by(is_favorite=True)

    if search:
        from sqlalchemy import or_
        from models.face import Face
        from models.person import Person
        
        if search.lower() == "duplicate":
            # Filter for photos that have a hash that appears more than once
            from sqlalchemy import func
            subquery = (
                db.session.query(Photo.file_hash)
                .filter(Photo.user_id == user_id, Photo.file_hash.isnot(None))
                .group_by(Photo.file_hash)
                .having(func.count(Photo.file_hash) > 1)
            )
            query = query.filter(Photo.file_hash.in_(subquery))
        else:
            query = query.outerjoin(Photo.tags).outerjoin(Photo.categories).outerjoin(Photo.faces).outerjoin(Face.person)
            query = query.filter(or_(
                Photo.original_filename.ilike(f"%{search}%"),
                Tag.name.ilike(f"%{search}%"),
                Category.name.ilike(f"%{search}%"),
                Person.name.ilike(f"%{search}%")
            )).distinct()

    if category:
        query = query.join(Photo.categories).filter(Category.name == category)

    if tag:
        query = query.join(Photo.tags).filter(Tag.name == tag)

    if person_id:
        from models.face import Face
        query = query.join(Photo.faces).filter(Face.person_id == person_id)

    query = query.order_by(Photo.uploaded_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return {
        "photos": [p.to_dict() for p in pagination.items],
        "total": pagination.total,
        "page": pagination.page,
        "pages": pagination.pages,
        "has_next": pagination.has_next,
    }


def get_photo_by_id(photo_id: int, user_id: int) -> Photo | None:
    return Photo.query.filter_by(id=photo_id, user_id=user_id).first()


def toggle_favorite(photo_id: int, user_id: int) -> dict | None:
    photo = get_photo_by_id(photo_id, user_id)
    if not photo:
        return None
    photo.is_favorite = not photo.is_favorite
    db.session.commit()
    return photo.to_dict()


def delete_photo(photo_id: int, user_id: int) -> bool:
    photo = get_photo_by_id(photo_id, user_id)
    if not photo:
        return False

    # Identify people whose face counts might drop to zero
    person_ids = {face.person_id for face in photo.faces if face.person_id}

    # Delete file from disk
    if os.path.exists(photo.filepath):
        try:
            os.remove(photo.filepath)
        except OSError:
            pass # File might be missing or locked, proceed with DB deletion

    # Clear many-to-many associations before deleting
    photo.categories.clear()
    photo.tags.clear()
    db.session.execute(folder_photos.delete().where(folder_photos.c.photo_id == photo.id))

    db.session.delete(photo)
    db.session.commit()

    # Cleanup orphan people (those with 0 photos left)
    if person_ids:
        from models.person import Person
        for pid in person_ids:
            person = Person.query.get(pid)
            if person and person.faces.count() == 0:
                db.session.delete(person)
        db.session.commit()

    return True

def delete_photos_batch(photo_ids: list[int], user_id: int) -> int:
    """Delete multiple photos and their files. Returns the number deleted."""
    photos = Photo.query.filter(Photo.id.in_(photo_ids), Photo.user_id == user_id).all()
    if not photos:
        return 0

    person_ids = set()
    deleted_count = 0

    for photo in photos:
        # Collect people to cleanup
        for face in photo.faces:
            if face.person_id:
                person_ids.add(face.person_id)

        # Delete file from disk
        if os.path.exists(photo.filepath):
            try:
                os.remove(photo.filepath)
            except OSError:
                pass

        # Clear many-to-many associations before deleting
        photo.categories.clear()
        photo.tags.clear()
        db.session.execute(folder_photos.delete().where(folder_photos.c.photo_id == photo.id))

        db.session.delete(photo)
        deleted_count += 1

    db.session.commit()

    # Cleanup orphan people
    if person_ids:
        from models.person import Person
        for pid in person_ids:
            person = Person.query.get(pid)
            if person and person.faces.count() == 0:
                db.session.delete(person)
        db.session.commit()

    return deleted_count

def get_image_hash(filepath: str) -> str:
    """Calculate the MD5 hash of a file."""
    hasher = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def check_duplicates(user_id: int, filepath: str) -> list[dict]:
    """Check if any photos for the user have the same hash."""
    file_hash = get_image_hash(filepath)
    duplicates = Photo.query.filter_by(user_id=user_id, file_hash=file_hash).all()
    return [d.to_dict() for d in duplicates]


def get_all_duplicates(user_id: int) -> dict:
    """Find all groups of duplicate photos in the library."""
    from sqlalchemy import func
    
    # Query for hashes that appear more than once for this user
    duplicate_hashes = (
        db.session.query(Photo.file_hash)
        .filter(Photo.user_id == user_id, Photo.file_hash.isnot(None))
        .group_by(Photo.file_hash)
        .having(func.count(Photo.file_hash) > 1)
        .all()
    )
    
    result = {}
    for (fhash,) in duplicate_hashes:
        duplicates = Photo.query.filter_by(user_id=user_id, file_hash=fhash).all()
        result[fhash] = [d.to_dict() for d in duplicates]
        
    return result
