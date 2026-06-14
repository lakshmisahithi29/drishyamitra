import os
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.photo import Photo
from models.person import Person
from datetime import datetime, timezone, timedelta

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


def _format_storage(total_bytes: int) -> str:
    """Format bytes into human-readable storage string."""
    if total_bytes < 1024:
        return f"{total_bytes} B"
    elif total_bytes < 1024 ** 2:
        return f"{total_bytes / 1024:.1f} KB"
    elif total_bytes < 1024 ** 3:
        return f"{total_bytes / (1024 ** 2):.1f} MB"
    else:
        return f"{total_bytes / (1024 ** 3):.2f} GB"


@dashboard_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    """Get dashboard statistics for the current user."""
    user_id = int(get_jwt_identity())

    # Total photos
    total_photos = Photo.query.filter_by(user_id=user_id).count()

    # People detected (only those who have at least one photo)
    from models.face import Face
    people_detected = Person.query.filter_by(user_id=user_id).join(Face).distinct().count()

    # Recent activity (photos uploaded in last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_activity = Photo.query.filter(
        Photo.user_id == user_id,
        Photo.uploaded_at >= week_ago
    ).count()

    # Storage used (sum of file sizes)
    total_storage = db.session.query(
        db.func.coalesce(db.func.sum(Photo.file_size), 0)
    ).filter(Photo.user_id == user_id).scalar()

    return jsonify({
        "totalPhotos": total_photos,
        "peopleDetected": people_detected,
        "recentActivity": recent_activity,
        "storageUsed": _format_storage(total_storage),
    }), 200


@dashboard_bp.route("/data", methods=["GET"])
@jwt_required()
def get_dashboard_data():
    """Get statistics, recent photos, and favorite photos."""
    user_id = int(get_jwt_identity())
    
    # Reuse stats logic
    total_photos = Photo.query.filter_by(user_id=user_id).count()
    from models.face import Face
    people_detected = Person.query.filter_by(user_id=user_id).join(Face).distinct().count()
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_activity = Photo.query.filter(Photo.user_id == user_id, Photo.uploaded_at >= week_ago).count()
    total_storage = db.session.query(db.func.coalesce(db.func.sum(Photo.file_size), 0)).filter(Photo.user_id == user_id).scalar()

    stats = {
        "totalPhotos": total_photos,
        "peopleDetected": people_detected,
        "recentActivity": recent_activity,
        "storageUsed": _format_storage(total_storage)
    }

    # Recent photos (8)
    recent_photos = Photo.query.filter_by(user_id=user_id).order_by(Photo.uploaded_at.desc()).limit(8).all()
    
    # Favorite photos (8)
    favorite_photos = Photo.query.filter_by(user_id=user_id, is_favorite=True).order_by(Photo.uploaded_at.desc()).limit(8).all()

    return jsonify({
        "stats": stats,
        "recentPhotos": [p.to_dict() for p in recent_photos],
        "favoritePhotos": [p.to_dict() for p in favorite_photos]
    }), 200
