"""
AI Chat service with modular provider support and structured action output.

Current provider: Groq (LLaMA 3.1)
Fallback: keyword-based responses when no API key is configured.

The system prompt teaches the LLM to emit [[ACTION: {...}]] blocks
that the route layer parses and executes via chat_actions.py.
"""

import os
import re
import json
from abc import ABC, abstractmethod


# ──────────────────────────────────────────────────
# Provider abstraction
# ──────────────────────────────────────────────────

class ChatProvider(ABC):
    """Abstract base class for chat AI providers."""

    @abstractmethod
    def get_response(
        self,
        user_message: str,
        system_context: str,
        conversation_history: list | None = None,
    ) -> str:
        """Generate an AI response given a user message and context."""
        ...


class GroqChatProvider(ChatProvider):
    """Chat provider using Groq API (LLaMA, Mixtral, etc.)."""

    def __init__(self, api_key: str, model: str = "llama-3.1-8b-instant"):
        from groq import Groq
        self._client = Groq(api_key=api_key)
        self._model = model

    def get_response(
        self,
        user_message: str,
        system_context: str,
        conversation_history: list | None = None,
    ) -> str:
        messages = [{"role": "system", "content": system_context}]

        if conversation_history:
            for msg in conversation_history[-10:]:
                role = msg.get("role", "user")
                if role not in ("user", "assistant"):
                    role = "user"
                messages.append({"role": role, "content": msg.get("content", "")})

        messages.append({"role": "user", "content": user_message})

        completion = self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        return completion.choices[0].message.content.strip()


class FallbackChatProvider(ChatProvider):
    """Keyword-based fallback when no AI provider is configured."""

    def get_response(
        self,
        user_message: str,
        system_context: str,
        conversation_history: list | None = None,
    ) -> str:
        return _get_fallback_response(user_message, {})


# ──────────────────────────────────────────────────
# Provider factory
# ──────────────────────────────────────────────────

_provider_instance: ChatProvider | None = None


def _get_provider() -> ChatProvider:
    """Lazy-initialize and return the active chat provider."""
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    groq_key = os.environ.get("GROQ_API_KEY", "")
    groq_model = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")

    if groq_key:
        try:
            _provider_instance = GroqChatProvider(api_key=groq_key, model=groq_model)
            return _provider_instance
        except Exception:
            pass

    _provider_instance = FallbackChatProvider()
    return _provider_instance


# ──────────────────────────────────────────────────
# System prompt — teaches the LLM to emit actions
# ──────────────────────────────────────────────────

def build_system_context(photo_stats: dict) -> str:
    """Build a detailed system context with structured action support."""
    people_desc = ""
    if photo_stats.get("people"):
        people_list = [f"{p['name']} ({p['count']} photos)" for p in photo_stats["people"]]
        people_desc = f"\nDetected people: {', '.join(people_list)}."

    category_desc = ""
    if photo_stats.get("categories"):
        cat_list = [f"{c['name']} ({c['count']})" for c in photo_stats["categories"]]
        category_desc = f"\nPhotos by category: {', '.join(cat_list)}."

    tag_desc = ""
    if photo_stats.get("tags"):
        tag_list = [t["name"] for t in photo_stats["tags"]]
        tag_desc = f"\nTop tags: {', '.join(tag_list)}."

    duplicate_desc = ""
    if photo_stats.get("duplicates_count", 0) > 0:
        duplicate_desc = f"\nDuplicates: {photo_stats['duplicates_count']} duplicate photos across {photo_stats['duplicates_groups']} groups."

    unknown_desc = ""
    if photo_stats.get("unknown_faces", 0) > 0:
        unknown_desc = f"\nUnidentified faces: {photo_stats['unknown_faces']} faces without a name."

    return (
        "You are Drishyamitra AI, an intelligent photo management assistant that can EXECUTE real actions.\n"
        f"Library: {photo_stats.get('totalPhotos', 0)} photos, {photo_stats.get('storageUsed', '0 B')} storage."
        f"{people_desc}{category_desc}{tag_desc}{duplicate_desc}{unknown_desc}\n\n"

        "CRITICAL INSTRUCTIONS — ACTION BLOCKS:\n"
        "When the user asks you to search, show, count, delete, or analyze photos, you MUST include an action block "
        "in your response. This is how the system executes real operations.\n\n"

        "Format: Write your friendly response first, then on a new line add:\n"
        "[[ACTION: {json_object}]]\n\n"

        "Available actions and their parameters:\n"
        "1. SEARCH_PHOTOS — Find photos by filters\n"
        '   {"action":"SEARCH_PHOTOS", "person_name":"...", "category":"...", "tag":"...", '
        '"date_from":"YYYY-MM-DD", "date_to":"YYYY-MM-DD", "relative_time":"last_7_days|last_month|last_year|today", '
        '"year":"2024", "search":"keyword", "favorites":true, "limit":20}\n\n'

        "2. SHOW_RECENT — Show recent uploads\n"
        '   {"action":"SHOW_RECENT", "limit":10}\n\n'

        "3. SHOW_FAVORITES — Show favorite photos\n"
        '   {"action":"SHOW_FAVORITES", "limit":20}\n\n'

        "4. DELETE_PHOTOS — Delete photos matching filters (system will ask for confirmation)\n"
        '   {"action":"DELETE_PHOTOS", "person_name":"...", "category":"...", "tag":"...", "limit":5}\n\n'

        "5. SHOW_DUPLICATES — Find duplicate photos\n"
        '   {"action":"SHOW_DUPLICATES"}\n\n'

        "6. DELETE_DUPLICATES — Delete duplicates (keeps oldest in each group)\n"
        '   {"action":"DELETE_DUPLICATES"}\n\n'

        "7. SHOW_STATS — Show full library analytics\n"
        '   {"action":"SHOW_STATS"}\n\n'

        "8. COUNT_PHOTOS — Count photos matching criteria\n"
        '   {"action":"COUNT_PHOTOS", "person_name":"...", "category":"...", "tag":"..."}\n\n'

        "9. SHOW_PERSONS — List all detected people\n"
        '   {"action":"SHOW_PERSONS"}\n\n'

        "10. SHOW_PERSON_PHOTOS — Show photos of a person\n"
        '    {"action":"SHOW_PERSON_PHOTOS", "person_name":"...", "limit":20}\n\n'

        "11. SHOW_UNKNOWN_FACES — Show photos with unidentified faces\n"
        '    {"action":"SHOW_UNKNOWN_FACES", "limit":20}\n\n'

        "12. CREATE_FOLDER — Create a folder with photos matching filters\n"
        '    {"action":"CREATE_FOLDER", "folder_name":"...", "tag":"...", "category":"...", '
        '"person_name":"...", "search":"...", "date_from":"YYYY-MM-DD", "date_to":"YYYY-MM-DD"}\n\n'

        "13. SHOW_FOLDERS — List all user folders\n"
        '    {"action":"SHOW_FOLDERS"}\n\n'

        "RULES:\n"
        "- Only include keys that are relevant. Do NOT include empty or null keys.\n"
        "- For ANY request involving photos (show, find, search, display, get), ALWAYS use an ACTION block.\n"
        "- For deletion requests, ALWAYS use DELETE_PHOTOS or DELETE_DUPLICATES.\n"
        "- For folder creation, use CREATE_FOLDER with a folder_name and search filters.\n"
        "- For follow-up like 'delete those' or 'show more', infer context from conversation.\n"
        "- When the user says 'show similar' or 'more like this', use the same filters with higher limit.\n"
        "- Keep your text response concise (1-3 sentences). The action will display the actual data.\n"
        "- ALWAYS include exactly one [[ACTION: ...]] block when an action is appropriate.\n"
        "- For casual conversation (greetings, thanks, etc), just reply naturally without an action block.\n"
    )


# ──────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────

def get_chat_response(user_message: str, photo_stats: dict, conversation_history: list = None) -> str:
    """
    Get an AI response to a user's message about their photo library.

    The response may contain [[ACTION: {...}]] blocks that the route parses.
    """
    provider = _get_provider()
    system_context = build_system_context(photo_stats)

    try:
        response = provider.get_response(user_message, system_context, conversation_history)
        return response
    except Exception:
        return _get_fallback_response(user_message, photo_stats)


def parse_actions(response_text: str) -> tuple[str, list[dict]]:
    """
    Parse [[ACTION: {...}]] blocks from an AI response.

    Returns:
        (clean_text, list_of_action_dicts)
    """
    actions = []
    pattern = r'\[\[ACTION:\s*(\{.*?\})\s*\]\]'

    for match in re.finditer(pattern, response_text, re.DOTALL):
        try:
            action = json.loads(match.group(1))
            actions.append(action)
        except json.JSONDecodeError:
            pass

    # Also support legacy [[DELETE_ACTION: ...]] format
    legacy_pattern = r'\[\[DELETE_ACTION:\s*(\{.*?\})\s*\]\]'
    for match in re.finditer(legacy_pattern, response_text, re.DOTALL):
        try:
            action_data = json.loads(match.group(1))
            actions.append({"action": "DELETE_PHOTOS", **action_data})
        except json.JSONDecodeError:
            pass

    # Clean the text by removing action blocks
    clean = re.sub(r'\[\[(ACTION|DELETE_ACTION):\s*\{.*?\}\s*\]\]', '', response_text, flags=re.DOTALL).strip()
    return clean, actions


# ──────────────────────────────────────────────────
# Fallback responses (with action blocks)
# ──────────────────────────────────────────────────

def _get_fallback_response(user_message: str, photo_stats: dict) -> str:
    """Provide fallback responses with action blocks when AI is unavailable."""
    msg = user_message.lower()
    people = photo_stats.get("people", [])

    if any(w in msg for w in ["how many", "count", "total"]):
        total = photo_stats.get("totalPhotos", 0)
        storage = photo_stats.get("storageUsed", "0 B")
        return (
            f"Your library has **{total}** photos using **{storage}** of storage.\n\n"
            '[[ACTION: {"action":"SHOW_STATS"}]]'
        )

    elif any(w in msg for w in ["who", "person", "people", "appears most"]):
        if not people:
            return "No people have been identified yet. Upload photos and assign names to faces!"
        return (
            f"Here are the people in your library:\n\n"
            '[[ACTION: {"action":"SHOW_PERSONS"}]]'
        )

    elif any(w in msg for w in ["recent", "latest", "new"]):
        return (
            "Here are your most recent photos:\n\n"
            '[[ACTION: {"action":"SHOW_RECENT", "limit":12}]]'
        )

    elif any(w in msg for w in ["favorite", "favourit", "liked", "starred"]):
        return (
            "Here are your favorite photos:\n\n"
            '[[ACTION: {"action":"SHOW_FAVORITES", "limit":12}]]'
        )

    elif any(w in msg for w in ["duplicate", "same", "copy", "redundant"]):
        return (
            "Let me check for duplicate photos in your library:\n\n"
            '[[ACTION: {"action":"SHOW_DUPLICATES"}]]'
        )

    elif any(w in msg for w in ["unknown", "unidentified", "unnamed"]):
        return (
            "Here are photos with unidentified faces:\n\n"
            '[[ACTION: {"action":"SHOW_UNKNOWN_FACES"}]]'
        )

    elif any(w in msg for w in ["stat", "analytic", "overview", "summary", "storage"]):
        return (
            "Here's an overview of your library:\n\n"
            '[[ACTION: {"action":"SHOW_STATS"}]]'
        )

    elif any(w in msg for w in ["search", "find", "show", "where", "display", "get"]):
        # Try to extract a person name
        for p in people:
            if p["name"].lower() in msg:
                return (
                    f'Searching for photos of **{p["name"]}**:\n\n'
                    '[[ACTION: {"action":"SHOW_PERSON_PHOTOS", "person_name":"' + p["name"] + '"}]]'
                )
        return (
            "Here are your recent photos:\n\n"
            '[[ACTION: {"action":"SHOW_RECENT", "limit":12}]]'
        )

    elif any(w in msg for w in ["delete", "remove", "clear", "trash"]):
        for p in people:
            if p["name"].lower() in msg:
                return (
                    f'I\'ll prepare to delete photos of **{p["name"]}**. Please confirm in the dialog.\n\n'
                    '[[ACTION: {"action":"DELETE_PHOTOS", "person_name":"' + p["name"] + '"}]]'
                )
        return "Which photos would you like to delete? You can specify by person, category, tag, or date."

    elif any(w in msg for w in ["folder", "create folder", "make folder", "new folder"]):
        # Try to extract folder name from quotes
        import re as _re
        name_match = _re.search(r"['\"]([^'\"]+)['\"]", user_message)
        folder_name = name_match.group(1) if name_match else "My Folder"
        # Detect filter keywords
        action_json = '{"action":"CREATE_FOLDER", "folder_name":"' + folder_name + '"}'
        if any(w in msg for w in ["exam", "paper"]):
            action_json = '{"action":"CREATE_FOLDER", "folder_name":"' + folder_name + '", "search":"exam"}'
        elif any(w in msg for w in ["favorite", "starred"]):
            action_json = '{"action":"CREATE_FOLDER", "folder_name":"' + folder_name + '", "favorites":true}'
        return (
            f"Creating folder **{folder_name}** for you!\n\n"
            f"[[ACTION: {action_json}]]"
        )

    elif "show" in msg and "folder" in msg:
        return (
            "Here are your folders:\n\n"
            '[[ACTION: {"action":"SHOW_FOLDERS"}]]'
        )

    elif any(w in msg for w in ["upload", "add"]):
        return "To upload new photos, go to the **Upload** page. The system will detect faces automatically!"

    elif any(w in msg for w in ["organize", "album", "category", "tag"]):
        return (
            "Here's an overview of your library organization:\n\n"
            '[[ACTION: {"action":"SHOW_STATS"}]]'
        )

    else:
        return (
            "I'm your **Drishyamitra AI** assistant! I can:\n\n"
            "📸 **Search** — Find photos by person, date, category, or tag\n"
            "🗑️ **Delete** — Remove photos by filter or clean up duplicates\n"
            "👥 **People** — See who appears in your library\n"
            "📊 **Stats** — Get library analytics and storage info\n"
            "🔍 **Duplicates** — Detect and remove duplicate photos\n\n"
            "Just tell me what you'd like to do!"
        )
