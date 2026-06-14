from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.person_service import get_persons, get_person_photos, create_person, delete_person

persons_bp = Blueprint("persons", __name__, url_prefix="/api/persons")


@persons_bp.route("", methods=["GET"])
@jwt_required()
def list_persons():
    """Get all persons for the current user."""
    user_id = int(get_jwt_identity())
    persons = get_persons(user_id)
    return jsonify(persons), 200


@persons_bp.route("/<int:person_id>/photos", methods=["GET"])
@jwt_required()
def person_photos(person_id):
    """Get all photos for a specific person."""
    user_id = int(get_jwt_identity())
    photos = get_person_photos(person_id, user_id)
    return jsonify({"photos": photos}), 200


@persons_bp.route("", methods=["POST"])
@jwt_required()
def add_person():
    """Create a new person."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Person name is required"}), 400

    person = create_person(user_id, data["name"].strip())
    return jsonify(person), 201


@persons_bp.route("/<int:person_id>", methods=["DELETE"])
@jwt_required()
def remove_person(person_id):
    """Delete a person."""
    user_id = int(get_jwt_identity())
    success = delete_person(person_id, user_id)
    if not success:
        return jsonify({"error": "Person not found"}), 404
    return jsonify({"message": "Person deleted"}), 200
