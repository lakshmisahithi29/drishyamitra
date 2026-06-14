from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.photo import Photo
from models.person import Person
from models.face import Face
from models import db
from services.chat_service import get_chat_response, parse_actions

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")


def _maybe_inject_folder_action(user_message: str, ai_response: str) -> str:
    """If the user asked for a folder operation but the AI didn't emit
    the correct ACTION block, inject one so the action layer picks it up."""
    import re
    msg = user_message.lower()

    # Already has a folder action? Leave it alone.
    if '"CREATE_FOLDER"' in ai_response or '"SHOW_FOLDERS"' in ai_response:
        return ai_response

    # ── CREATE_FOLDER intent ──
    create_words = ["create a folder", "make a folder", "create folder", "make folder", "new folder"]
    if any(w in msg for w in create_words):
        # Extract folder name from quotes
        name_match = re.search(r"['\"]([^'\"]+)['\"]", user_message)
        folder_name = name_match.group(1) if name_match else "My Folder"

        # Build search filter from the rest of the message
        extra = {}
        if any(w in msg for w in ["exam", "paper"]):
            extra["search"] = "exam"
        elif any(w in msg for w in ["favorite", "starred", "star"]):
            extra["favorites"] = True
        elif any(w in msg for w in ["recent", "latest", "new"]):
            extra["relative_time"] = "last_7_days"

        # Check for tag / category / person hints
        tag_match = re.search(r"(?:tag(?:ged)?|with tag)\s+['\"]?(\w+)['\"]?", msg)
        if tag_match:
            extra["tag"] = tag_match.group(1)
        cat_match = re.search(r"(?:category|categor(?:ies|y))\s+['\"]?(\w+)['\"]?", msg)
        if cat_match:
            extra["category"] = cat_match.group(1)

        parts = [f'"action":"CREATE_FOLDER"', f'"folder_name":"{folder_name}"']
        for k, v in extra.items():
            if isinstance(v, bool):
                parts.append(f'"{k}":true')
            else:
                parts.append(f'"{k}":"{v}"')
        action_json = "{" + ", ".join(parts) + "}"

        # If the AI response doesn't already contain an action block, add one
        if "[[ACTION:" not in ai_response:
            return ai_response + f"\n\n[[ACTION: {action_json}]]"
        # If it has a wrong action, replace it
        ai_response = re.sub(
            r'\[\[ACTION:\s*\{.*?\}\s*\]\]',
            f'[[ACTION: {action_json}]]',
            ai_response,
            flags=re.DOTALL,
        )
        return ai_response

    # ── SHOW_FOLDERS intent ──
    if "folder" in msg and any(w in msg for w in ["show", "list", "my folder", "all folder", "view folder"]):
        if "[[ACTION:" not in ai_response:
            return ai_response + '\n\n[[ACTION: {"action":"SHOW_FOLDERS"}]]'

    return ai_response


def _build_photo_stats(user_id: int) -> dict:
    """Build the photo_stats context dict for the AI."""
    total_photos = Photo.query.filter_by(user_id=user_id).count()

    # People
    people_records = Person.query.filter_by(user_id=user_id).join(Face).distinct().all()
    people_stats = [
        {"name": p.name, "count": p.faces.count()}
        for p in people_records
    ]
    people_stats.sort(key=lambda x: x["count"], reverse=True)

    # Categories
    from models.associations import Category
    categories_stats = db.session.query(
        Category.name, db.func.count(Photo.id)
    ).join(Photo.categories).filter(Photo.user_id == user_id).group_by(Category.name).all()
    categories_list = [{"name": name, "count": count} for name, count in categories_stats]

    # Tags
    from models.associations import Tag
    tags_stats = db.session.query(
        Tag.name, db.func.count(Photo.id)
    ).join(Photo.tags).filter(Photo.user_id == user_id).group_by(Tag.name).limit(20).all()
    tags_list = [{"name": name, "count": count} for name, count in tags_stats]

    # Storage
    total_storage = db.session.query(
        db.func.coalesce(db.func.sum(Photo.file_size), 0)
    ).filter(Photo.user_id == user_id).scalar()
    storage_mb = total_storage / (1024 * 1024) if total_storage else 0
    storage_str = f"{storage_mb:.1f} MB" if storage_mb < 1024 else f"{storage_mb / 1024:.2f} GB"

    # Duplicates
    from services.photo_service import get_all_duplicates
    duplicates = get_all_duplicates(user_id)
    duplicates_count = sum(len(group) for group in duplicates.values())

    # Unknown faces
    unknown_faces = Face.query.join(Photo).filter(
        Photo.user_id == user_id, Face.person_id.is_(None)
    ).count()

    return {
        "totalPhotos": total_photos,
        "people": people_stats,
        "categories": categories_list,
        "tags": tags_list,
        "storageUsed": storage_str,
        "duplicates_count": duplicates_count,
        "duplicates_groups": len(duplicates),
        "unknown_faces": unknown_faces,
    }


@chat_bp.route("", methods=["POST"])
@jwt_required()
def chat():
    """Send a message to the AI chat assistant.

    Returns:
        JSON with:
          - role: "assistant"
          - content: the text response
          - action_results: list of action result dicts (may be empty)
    """
    user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data or not data.get("message", "").strip():
        return jsonify({"error": "Message is required"}), 400

    user_message = data["message"].strip()
    conversation_history = data.get("history", [])

    # Build context and call the AI
    photo_stats = _build_photo_stats(user_id)
    response_text = get_chat_response(user_message, photo_stats, conversation_history)

    # Ensure folder actions are present when the user asked for them
    response_text = _maybe_inject_folder_action(user_message, response_text)

    # Parse action blocks from the AI response
    clean_text, actions = parse_actions(response_text)

    # Execute each action
    action_results = []
    if actions:
        from services.chat_actions import execute_action
        for action in actions:
            result = execute_action(action, user_id)
            action_results.append(result)

    return jsonify({
        "role": "assistant",
        "content": clean_text,
        "action_results": action_results,
    }), 200
