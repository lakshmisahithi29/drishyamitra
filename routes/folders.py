from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.folder import Folder, folder_photos
from models.photo import Photo

folders_bp = Blueprint("folders", __name__, url_prefix="/api/folders")


@folders_bp.route("", methods=["GET"])
@jwt_required()
def list_folders():
    """List all folders for the current user."""
    user_id = int(get_jwt_identity())
    folders = Folder.query.filter_by(user_id=user_id).order_by(Folder.created_at.desc()).all()
    return jsonify([f.to_dict() for f in folders]), 200


@folders_bp.route("", methods=["POST"])
@jwt_required()
def create_folder():
    """Create a new folder, optionally with photo IDs."""
    user_id = int(get_jwt_identity())
    data = request.get_json()

    name = (data or {}).get("name", "").strip()
    if not name:
        return jsonify({"error": "Folder name is required"}), 400

    folder = Folder(name=name, user_id=user_id)

    # Optionally attach photos
    photo_ids = (data or {}).get("photo_ids", [])
    if photo_ids:
        photos = Photo.query.filter(Photo.id.in_(photo_ids), Photo.user_id == user_id).all()
        folder.photos = photos

    db.session.add(folder)
    db.session.commit()

    return jsonify(folder.to_dict(include_photos=True)), 201


@folders_bp.route("/<int:folder_id>", methods=["GET"])
@jwt_required()
def get_folder(folder_id):
    """Get a folder with its photos."""
    user_id = int(get_jwt_identity())
    folder = Folder.query.filter_by(id=folder_id, user_id=user_id).first_or_404()
    return jsonify(folder.to_dict(include_photos=True)), 200


@folders_bp.route("/<int:folder_id>", methods=["DELETE"])
@jwt_required()
def delete_folder(folder_id):
    """Delete a folder (does not delete photos)."""
    user_id = int(get_jwt_identity())
    folder = Folder.query.filter_by(id=folder_id, user_id=user_id).first_or_404()
    db.session.delete(folder)
    db.session.commit()
    return jsonify({"message": "Folder deleted"}), 200


@folders_bp.route("/<int:folder_id>/photos", methods=["PUT"])
@jwt_required()
def add_photos_to_folder(folder_id):
    """Add photos to an existing folder."""
    user_id = int(get_jwt_identity())
    folder = Folder.query.filter_by(id=folder_id, user_id=user_id).first_or_404()
    data = request.get_json() or {}
    photo_ids = data.get("photo_ids", [])

    photos = Photo.query.filter(Photo.id.in_(photo_ids), Photo.user_id == user_id).all()
    existing_ids = {p.id for p in folder.photos}
    for p in photos:
        if p.id not in existing_ids:
            folder.photos.append(p)
    db.session.commit()
    return jsonify(folder.to_dict()), 200
