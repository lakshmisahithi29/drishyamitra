"""
Chat Actions — command executor for the AI chat assistant.

Converts parsed [[ACTION:...]] JSON blocks into real backend operations.
Each action returns a dict with 'type' and 'data' for the frontend to render.

Supported action types:
    SEARCH_PHOTOS  — search / filter photos
    DELETE_PHOTOS  — batch delete (requires confirmation on frontend)
    SHOW_DUPLICATES — find duplicate groups
    SHOW_STATS     — library analytics
    SHOW_PERSONS   — list people
    SHOW_PERSON_PHOTOS — photos of a specific person
"""

import os
from datetime import datetime, timedelta, timezone
from models import db
from models.photo import Photo
from models.face import Face
from models.person import Person
from models.folder import Folder
from models.associations import Category, Tag


# ──────────────────────────────────────────────────
# Action dispatcher
# ──────────────────────────────────────────────────

def execute_action(action: dict, user_id: int) -> dict:
    """
    Execute a parsed action dict and return structured results.

    Args:
        action: dict with 'action' key and filter params
        user_id: authenticated user id

    Returns:
        dict with 'type', 'data', and optionally 'requires_confirmation'
    """
    action_type = action.get("action", "").upper()

    dispatch = {
        "SEARCH_PHOTOS": _action_search_photos,
        "SHOW_RECENT": _action_recent_photos,
        "SHOW_FAVORITES": _action_favorites,
        "DELETE_PHOTOS": _action_delete_photos,
        "SHOW_DUPLICATES": _action_show_duplicates,
        "DELETE_DUPLICATES": _action_delete_duplicates,
        "SHOW_STATS": _action_show_stats,
        "SHOW_PERSONS": _action_show_persons,
        "SHOW_PERSON_PHOTOS": _action_show_person_photos,
        "COUNT_PHOTOS": _action_count_photos,
        "SHOW_UNKNOWN_FACES": _action_unknown_faces,
        "CREATE_FOLDER": _action_create_folder,
        "SHOW_FOLDERS": _action_show_folders,
    }

    handler = dispatch.get(action_type)
    if not handler:
        return {"type": "error", "data": {"message": f"Unknown action: {action_type}"}}

    try:
        return handler(action, user_id)
    except Exception as e:
        print(f"[ERROR] Action {action_type} failed: {e}")
        return {"type": "error", "data": {"message": f"Action failed: {str(e)}"}}


# ──────────────────────────────────────────────────
# Photo search / filter
# ──────────────────────────────────────────────────

def _build_photo_query(action: dict, user_id: int):
    """Build a SQLAlchemy query from action filters."""
    query = Photo.query.filter_by(user_id=user_id)

    # Person filter
    person_name = action.get("person_name")
    if person_name:
        person = Person.query.filter(
            Person.user_id == user_id,
            Person.name.ilike(f"%{person_name}%")
        ).first()
        if person:
            query = query.join(Photo.faces).filter(Face.person_id == person.id)
        else:
            # No matching person — return empty
            query = query.filter(Photo.id < 0)

    # Category filter
    category = action.get("category")
    if category:
        query = query.join(Photo.categories).filter(Category.name.ilike(f"%{category}%"))

    # Tag filter
    tag = action.get("tag")
    if tag:
        query = query.join(Photo.tags).filter(Tag.name.ilike(f"%{tag}%"))

    # Date filters
    date_from = action.get("date_from")
    date_to = action.get("date_to")
    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            query = query.filter(Photo.uploaded_at >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
            query = query.filter(Photo.uploaded_at <= dt_to)
        except ValueError:
            pass

    # Relative time filter (e.g. "last_7_days", "last_month", "last_year")
    relative_time = action.get("relative_time")
    if relative_time:
        now = datetime.now(timezone.utc)
        deltas = {
            "today": timedelta(days=1),
            "yesterday": timedelta(days=2),
            "last_3_days": timedelta(days=3),
            "last_7_days": timedelta(days=7),
            "last_week": timedelta(days=7),
            "last_2_weeks": timedelta(days=14),
            "last_month": timedelta(days=30),
            "last_3_months": timedelta(days=90),
            "last_6_months": timedelta(days=180),
            "last_year": timedelta(days=365),
        }
        delta = deltas.get(relative_time.lower())
        if delta:
            query = query.filter(Photo.uploaded_at >= now - delta)

    # Year filter
    year = action.get("year")
    if year:
        try:
            y = int(year)
            start = datetime(y, 1, 1, tzinfo=timezone.utc)
            end = datetime(y, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
            query = query.filter(Photo.uploaded_at.between(start, end))
        except (ValueError, TypeError):
            pass

    # Favorites filter
    if action.get("favorites"):
        query = query.filter(Photo.is_favorite == True)

    # Search keyword — searches across filenames, tags, categories, and person names
    search = action.get("search")
    if search:
        from sqlalchemy import or_
        query = query.outerjoin(Photo.tags).outerjoin(Photo.categories).outerjoin(Photo.faces).outerjoin(Face.person)
        query = query.filter(or_(
            Photo.original_filename.ilike(f"%{search}%"),
            Tag.name.ilike(f"%{search}%"),
            Category.name.ilike(f"%{search}%"),
            Person.name.ilike(f"%{search}%"),
        )).distinct()

    return query.order_by(Photo.uploaded_at.desc())


def _action_search_photos(action: dict, user_id: int) -> dict:
    """Search photos with optional filters."""
    limit = min(int(action.get("limit", 20)), 50)
    query = _build_photo_query(action, user_id)
    photos = query.limit(limit).all()

    return {
        "type": "photos",
        "data": {
            "photos": [p.to_dict() for p in photos],
            "total": query.count(),
            "showing": len(photos),
        }
    }


def _action_recent_photos(action: dict, user_id: int) -> dict:
    """Show most recent photos."""
    limit = min(int(action.get("limit", 10)), 50)
    photos = (
        Photo.query.filter_by(user_id=user_id)
        .order_by(Photo.uploaded_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "type": "photos",
        "data": {
            "photos": [p.to_dict() for p in photos],
            "total": Photo.query.filter_by(user_id=user_id).count(),
            "showing": len(photos),
        }
    }


def _action_favorites(action: dict, user_id: int) -> dict:
    """Show favorite photos."""
    limit = min(int(action.get("limit", 20)), 50)
    photos = (
        Photo.query.filter_by(user_id=user_id, is_favorite=True)
        .order_by(Photo.uploaded_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "type": "photos",
        "data": {
            "photos": [p.to_dict() for p in photos],
            "total": Photo.query.filter_by(user_id=user_id, is_favorite=True).count(),
            "showing": len(photos),
        }
    }


# ──────────────────────────────────────────────────
# Deletion
# ──────────────────────────────────────────────────

def _action_delete_photos(action: dict, user_id: int) -> dict:
    """Stage photos for deletion — requires frontend confirmation."""
    limit = int(action.get("limit", 999999))
    query = _build_photo_query(action, user_id)
    photos = query.limit(limit).all()

    if not photos:
        return {
            "type": "info",
            "data": {"message": "No photos matched the deletion criteria."}
        }

    description_parts = []
    if action.get("person_name"):
        description_parts.append(f"person: {action['person_name']}")
    if action.get("category"):
        description_parts.append(f"category: {action['category']}")
    if action.get("tag"):
        description_parts.append(f"tag: {action['tag']}")
    if action.get("search"):
        description_parts.append(f"search: {action['search']}")

    return {
        "type": "delete_confirmation",
        "requires_confirmation": True,
        "data": {
            "photo_ids": [p.id for p in photos],
            "count": len(photos),
            "description": ", ".join(description_parts) if description_parts else "selected photos",
            "preview": [p.to_dict() for p in photos[:6]],
        }
    }


# ──────────────────────────────────────────────────
# Duplicates
# ──────────────────────────────────────────────────

def _action_show_duplicates(action: dict, user_id: int) -> dict:
    """Find and show all duplicate photos grouped by hash."""
    from services.photo_service import get_all_duplicates
    groups = get_all_duplicates(user_id)

    if not groups:
        return {
            "type": "info",
            "data": {"message": "No duplicate photos found in your library."}
        }

    total_dupes = sum(len(g) for g in groups.values())
    # Flatten for display, group info included
    all_photos = []
    for group_hash, group_photos in groups.items():
        for p in group_photos:
            p["_duplicate_group"] = group_hash[:8]
        all_photos.extend(group_photos)

    return {
        "type": "duplicates",
        "data": {
            "photos": all_photos[:30],
            "groups": len(groups),
            "total_duplicates": total_dupes,
        }
    }


def _action_delete_duplicates(action: dict, user_id: int) -> dict:
    """Stage duplicate photos for deletion — keeps one per group."""
    from services.photo_service import get_all_duplicates
    groups = get_all_duplicates(user_id)

    if not groups:
        return {"type": "info", "data": {"message": "No duplicate photos to delete."}}

    to_delete = []
    for group_photos in groups.values():
        # Keep the first (oldest), stage the rest for deletion
        sorted_photos = sorted(group_photos, key=lambda p: p.get("uploaded_at", ""))
        for p in sorted_photos[1:]:
            to_delete.append(p["id"])

    return {
        "type": "delete_confirmation",
        "requires_confirmation": True,
        "data": {
            "photo_ids": to_delete,
            "count": len(to_delete),
            "description": f"duplicate photos ({len(groups)} groups, keeping oldest)",
            "preview": [],
        }
    }


# ──────────────────────────────────────────────────
# Analytics
# ──────────────────────────────────────────────────

def _action_show_stats(action: dict, user_id: int) -> dict:
    """Show library analytics."""
    total = Photo.query.filter_by(user_id=user_id).count()
    favorites = Photo.query.filter_by(user_id=user_id, is_favorite=True).count()
    people_count = Person.query.filter_by(user_id=user_id).count()

    total_size = db.session.query(
        db.func.coalesce(db.func.sum(Photo.file_size), 0)
    ).filter(Photo.user_id == user_id).scalar()
    size_mb = total_size / (1024 * 1024) if total_size else 0

    # Category breakdown
    cats = db.session.query(
        Category.name, db.func.count(Photo.id)
    ).join(Photo.categories).filter(Photo.user_id == user_id).group_by(Category.name).all()

    # Tag breakdown
    tags = db.session.query(
        Tag.name, db.func.count(Photo.id)
    ).join(Photo.tags).filter(Photo.user_id == user_id).group_by(Tag.name).order_by(db.func.count(Photo.id).desc()).limit(10).all()

    # People breakdown
    people = Person.query.filter_by(user_id=user_id).all()
    people_stats = [
        {"name": p.name, "count": p.faces.count()} for p in people if p.faces.count() > 0
    ]
    people_stats.sort(key=lambda x: x["count"], reverse=True)

    from services.photo_service import get_all_duplicates
    dup_groups = get_all_duplicates(user_id)

    unknown_faces = Face.query.join(Photo).filter(
        Photo.user_id == user_id, Face.person_id.is_(None)
    ).count()

    return {
        "type": "stats",
        "data": {
            "total_photos": total,
            "favorites": favorites,
            "people_detected": people_count,
            "storage_mb": round(size_mb, 2),
            "storage_str": f"{size_mb:.1f} MB" if size_mb < 1024 else f"{size_mb / 1024:.2f} GB",
            "categories": [{"name": n, "count": c} for n, c in cats],
            "top_tags": [{"name": n, "count": c} for n, c in tags],
            "people": people_stats,
            "duplicate_groups": len(dup_groups),
            "duplicate_photos": sum(len(g) for g in dup_groups.values()),
            "unknown_faces": unknown_faces,
        }
    }


def _action_count_photos(action: dict, user_id: int) -> dict:
    """Count photos matching filters."""
    query = _build_photo_query(action, user_id)
    count = query.count()

    context_parts = []
    if action.get("person_name"):
        context_parts.append(f"of {action['person_name']}")
    if action.get("category"):
        context_parts.append(f"in {action['category']}")
    if action.get("tag"):
        context_parts.append(f"tagged {action['tag']}")
    context = " ".join(context_parts) if context_parts else "total"

    return {
        "type": "count",
        "data": {
            "count": count,
            "context": context,
        }
    }


# ──────────────────────────────────────────────────
# Persons
# ──────────────────────────────────────────────────

def _action_show_persons(action: dict, user_id: int) -> dict:
    """List all detected people."""
    people = Person.query.filter_by(user_id=user_id).all()
    people_list = []
    for p in people:
        fc = p.faces.count()
        if fc > 0:
            people_list.append({"id": p.id, "name": p.name, "photo_count": fc})
    people_list.sort(key=lambda x: x["photo_count"], reverse=True)

    return {
        "type": "persons",
        "data": {
            "persons": people_list,
            "total": len(people_list),
        }
    }


def _action_show_person_photos(action: dict, user_id: int) -> dict:
    """Show photos of a specific person."""
    person_name = action.get("person_name", "")
    person = Person.query.filter(
        Person.user_id == user_id,
        Person.name.ilike(f"%{person_name}%")
    ).first()

    if not person:
        return {"type": "info", "data": {"message": f"No person named '{person_name}' found."}}

    limit = min(int(action.get("limit", 20)), 50)
    photo_ids = db.session.query(Face.photo_id).filter(Face.person_id == person.id).distinct().all()
    photo_ids = [pid[0] for pid in photo_ids]

    photos = Photo.query.filter(
        Photo.id.in_(photo_ids)
    ).order_by(Photo.uploaded_at.desc()).limit(limit).all()

    return {
        "type": "photos",
        "data": {
            "photos": [p.to_dict() for p in photos],
            "total": len(photo_ids),
            "showing": len(photos),
            "person_name": person.name,
        }
    }


def _action_unknown_faces(action: dict, user_id: int) -> dict:
    """Show photos with unidentified faces."""
    limit = min(int(action.get("limit", 20)), 50)
    
    photo_ids = db.session.query(Face.photo_id).join(Photo).filter(
        Photo.user_id == user_id,
        Face.person_id.is_(None)
    ).distinct().all()
    photo_ids = [pid[0] for pid in photo_ids]

    photos = Photo.query.filter(
        Photo.id.in_(photo_ids)
    ).order_by(Photo.uploaded_at.desc()).limit(limit).all()

    return {
        "type": "photos",
        "data": {
            "photos": [p.to_dict() for p in photos],
            "total": len(photo_ids),
            "showing": len(photos),
            "context": "photos with unknown faces",
        }
    }


# ──────────────────────────────────────────────────
# Folders
# ──────────────────────────────────────────────────

def _action_create_folder(action: dict, user_id: int) -> dict:
    """Create a folder and populate it with photos matching the given filters."""
    folder_name = action.get("folder_name", "").strip()
    if not folder_name:
        return {"type": "error", "data": {"message": "Folder name is required."}}

    # Build query from the same filters used for search
    query = _build_photo_query(action, user_id)
    photos = query.all()

    folder = Folder(name=folder_name, user_id=user_id)
    if photos:
        folder.photos = photos
    db.session.add(folder)
    db.session.commit()

    return {
        "type": "folder_created",
        "data": {
            "folder_id": folder.id,
            "folder_name": folder.name,
            "photo_count": len(photos),
            "photos": [p.to_dict() for p in photos[:12]],
        }
    }


def _action_show_folders(action: dict, user_id: int) -> dict:
    """List all folders for the user."""
    folders = Folder.query.filter_by(user_id=user_id).order_by(Folder.created_at.desc()).all()
    if not folders:
        return {"type": "info", "data": {"message": "No folders created yet. Ask me to create one!"}}

    return {
        "type": "folders",
        "data": {
            "folders": [f.to_dict() for f in folders],
            "total": len(folders),
        }
    }
