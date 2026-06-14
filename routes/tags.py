from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.associations import Tag

tags_bp = Blueprint("tags", __name__, url_prefix="/api/tags")


@tags_bp.route("", methods=["GET"])
@jwt_required()
def list_tags():
    """Get all tags."""
    tags = Tag.query.order_by(Tag.name).all()
    return jsonify([t.to_dict() for t in tags]), 200
