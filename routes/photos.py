import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.photo_service import (
    save_uploaded_file, create_photo, get_photos,
    get_photo_by_id, toggle_favorite, delete_photo,
    delete_photos_batch
)
from services.face_service import detect_faces_in_image, save_detected_faces, assign_face_to_person

photos_bp = Blueprint("photos", __name__, url_prefix="/api/photos")


@photos_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_photo():
    """Upload an image with optional metadata (categories, tags, face names)."""
    user_id = int(get_jwt_identity())

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    # Parse metadata from form data
    categories = request.form.getlist("categories")
    if not categories and request.form.get("categories_json"):
        import json
        try:
            categories = json.loads(request.form.get("categories_json", "[]"))
        except (json.JSONDecodeError, TypeError):
            categories = []

    tags = request.form.getlist("tags")
    if not tags and request.form.get("tags_json"):
        import json
        try:
            tags = json.loads(request.form.get("tags_json", "[]"))
        except (json.JSONDecodeError, TypeError):
            tags = []

    face_names_raw = request.form.get("face_names_json", "[]")
    import json
    try:
        face_names = json.loads(face_names_raw)
    except (json.JSONDecodeError, TypeError):
        face_names = []

    try:
        # Save file to disk
        file_info = save_uploaded_file(file, user_id)

        # Create photo record with categories and tags
        photo = create_photo(user_id, file_info, categories=categories, tags=tags)

        # Detect faces in the uploaded image
        detected_faces = detect_faces_in_image(file_info["filepath"])

        if detected_faces:
            saved_faces = save_detected_faces(photo.id, detected_faces)
            
            # Process embeddings and auto-recognize people
            from services.face_service import process_embeddings_for_photo
            auto_matched_count = process_embeddings_for_photo(
                photo.id, 
                file_info["filepath"], 
                user_id
            )
            print(f"[DEBUG] Auto-matched {auto_matched_count} face(s)")

            # Assign names to faces if provided (manually overrides auto-recognition)
            if face_names:
                print(f"[DEBUG] Found {len(saved_faces)} faces. Names provided manually: {face_names}")
                for i, face in enumerate(saved_faces):
                    if i < len(face_names) and face_names[i].get("name", "").strip():
                        name = face_names[i]["name"].strip()
                        print(f"[DEBUG] Manually assigning face {face.id} to name: {name}")
                        assign_face_to_person(
                            face.id,
                            name,
                            user_id,
                        )

        return jsonify({
            "message": "Photo uploaded successfully",
            "photo": photo.to_dict(include_faces=True),
            "faces_detected": len(detected_faces),
            "auto_matched": auto_matched_count if detected_faces else 0
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500


@photos_bp.route("/analyze", methods=["POST"])
@jwt_required()
def analyze_photo():
    """
    Perform real-time analysis on an image before final upload.
    Checks for faces, attempts recognition, and checks for duplicates.
    """
    user_id = int(get_jwt_identity())

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    try:
        # Save file temporarily
        from services.photo_service import save_uploaded_file, check_duplicates
        file_info = save_uploaded_file(file, user_id)
        filepath = file_info["filepath"]

        # 1. Detect and recognize faces
        from services.face_service import analyze_faces_in_image
        analysis_results = analyze_faces_in_image(filepath, user_id)

        # 2. Check for duplicates
        duplicates = check_duplicates(user_id, filepath)

        # Clean up: delete the temporary file used for analysis
        if os.path.exists(filepath):
            os.remove(filepath)

        return jsonify({
            "faces": analysis_results,
            "duplicates": duplicates,
            "faces_count": len(analysis_results),
            "is_duplicate": len(duplicates) > 0
        }), 200

    except Exception as e:
        print(f"[ERROR] Photo analysis failed: {e}")
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


@photos_bp.route("", methods=["GET"])
@jwt_required()
def list_photos():
    """List photos with optional filters."""
    user_id = int(get_jwt_identity())

    category = request.args.get("category")
    tag = request.args.get("tag")
    person_id = request.args.get("person_id", type=int)
    search = request.args.get("search")
    favorites = request.args.get("favorites", "false").lower() == "true"
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)

    result = get_photos(
        user_id=user_id,
        category=category,
        tag=tag,
        person_id=person_id,
        search=search,
        favorites_only=favorites,
        page=page,
        per_page=per_page,
    )
    return jsonify(result), 200


@photos_bp.route("/<int:photo_id>", methods=["GET"])
@jwt_required()
def get_photo(photo_id):
    """Get a single photo with full details."""
    user_id = int(get_jwt_identity())
    photo = get_photo_by_id(photo_id, user_id)
    if not photo:
        return jsonify({"error": "Photo not found"}), 404
    return jsonify(photo.to_dict(include_faces=True)), 200


@photos_bp.route("/<int:photo_id>/favorite", methods=["PATCH"])
@jwt_required()
def favorite_photo(photo_id):
    """Toggle a photo's favorite status."""
    user_id = int(get_jwt_identity())
    result = toggle_favorite(photo_id, user_id)
    if result is None:
        return jsonify({"error": "Photo not found"}), 404
    return jsonify(result), 200


@photos_bp.route("/<int:photo_id>", methods=["DELETE"])
@jwt_required()
def remove_photo(photo_id):
    """Delete a photo and its file."""
    user_id = int(get_jwt_identity())
    success = delete_photo(photo_id, user_id)
    if not success:
        return jsonify({"error": "Photo not found"}), 404
    return jsonify({"message": "Photo deleted"}), 200


@photos_bp.route("/batch-delete", methods=["DELETE"])
@jwt_required()
def batch_delete_photos():
    """Delete multiple photos at once."""
    user_id = int(get_jwt_identity())
    data = request.get_json(force=True)
    if not data or "photo_ids" not in data:
        return jsonify({"error": "Missing photo_ids"}), 400

    photo_ids = data["photo_ids"]
    print(f"[DEBUG] Batch deleting photos: {photo_ids} for user {user_id}")
    if not isinstance(photo_ids, list):
        return jsonify({"error": "photo_ids must be a list"}), 400

    deleted_count = delete_photos_batch(photo_ids, user_id)
    return jsonify({
        "message": f"Successfully deleted {deleted_count} photo(s)",
        "deleted_count": deleted_count
    }), 200
