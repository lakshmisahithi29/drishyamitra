from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.face_service import detect_faces_from_bytes, assign_face_to_person

faces_bp = Blueprint("faces", __name__, url_prefix="/api/faces")


@faces_bp.route("/detect", methods=["POST"])
@jwt_required()
def detect_faces():
    """
    Detect faces in an uploaded image without saving the photo.

    Used for real-time face detection during the upload preview flow.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    try:
        image_bytes = file.read()
        faces = detect_faces_from_bytes(image_bytes)
        return jsonify({
            "faces": faces,
            "count": len(faces),
        }), 200
    except Exception as e:
        return jsonify({"error": f"Face detection failed: {str(e)}"}), 500


@faces_bp.route("/<int:face_id>/assign", methods=["PUT"])
@jwt_required()
def assign_name(face_id):
    """Assign a person name to a detected face."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Person name is required"}), 400

    face = assign_face_to_person(face_id, data["name"].strip(), user_id)
    if not face:
        return jsonify({"error": "Face not found"}), 404

    return jsonify({
        "message": "Face assigned successfully",
        "face": face.to_dict(),
    }), 200
