"""
Main routes - Home page and core functionality
"""

from flask import Blueprint, render_template, session, request, jsonify
from utils.auth_middleware import login_required
from utils.chat_history import chat_history_manager

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
@login_required
def index():
    """Main page with 3-panel layout - requires authentication"""

    # User ID should already be set from login
    if "user_id" not in session:
        # Fallback - use username from user object
        user = session.get("user")
        if user:
            session["user_id"] = user.get("username", "default")

    # Get user conversations
    conversations = chat_history_manager.get_user_conversations(
        session["user_id"], limit=10
    )

    # Get current conversation
    current_conv_id = session.get("current_conversation_id")
    current_messages = []

    if current_conv_id:
        current_messages = chat_history_manager.get_conversation_messages(
            current_conv_id
        )

    # Get system status
    ollama_status = check_ollama_status()

    return render_template(
        "main.html",
        conversations=conversations,
        current_conversation_id=current_conv_id,
        current_messages=current_messages,
        ollama_status=ollama_status,
    )


@main_bp.route("/new_conversation", methods=["POST"])
@login_required
def new_conversation():
    """Create a new conversation"""
    try:
        from datetime import datetime

        # Create conversation title with timestamp
        timestamp = datetime.now().strftime("%d/%m %H:%M")
        conv_title = f"Chat {timestamp}"

        # Create conversation in database
        conv_id = chat_history_manager.create_conversation(
            conv_title, session["user_id"]
        )

        # Set as current conversation
        session["current_conversation_id"] = conv_id

        return jsonify(
            {"success": True, "conversation_id": conv_id, "title": conv_title}
        )

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@main_bp.route("/select_conversation/<conversation_id>")
@login_required
def select_conversation(conversation_id):
    """Select a conversation as current"""
    session["current_conversation_id"] = conversation_id
    return jsonify({"success": True})


@main_bp.route("/delete_conversation/<conversation_id>", methods=["DELETE"])
@login_required
def delete_conversation(conversation_id):
    """Delete a conversation"""
    try:
        # Delete from database
        chat_history_manager.delete_conversation(conversation_id)

        # If this was the current conversation, clear it
        if session.get("current_conversation_id") == conversation_id:
            session.pop("current_conversation_id", None)

            # Get remaining conversations to set a new current one
            remaining = chat_history_manager.get_user_conversations(
                session["user_id"], limit=1
            )
            if remaining:
                session["current_conversation_id"] = remaining[0]["id"]

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def check_ollama_status():
    """Check Ollama status"""
    import os
    import requests

    configured_model = os.getenv("OLLAMA_MODEL", "gemma4:latest")
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    try:
        response = requests.get(f"{base_url}/api/tags", timeout=2)
        if response.status_code == 200:
            models = response.json().get("models", [])
            available_models = [model["name"] for model in models]
            return {
                "running": True,
                "models": available_models,
                "has_gemma": configured_model in available_models,
                "model": configured_model,
            }
    except Exception:
        pass

    return {"running": False, "models": [], "has_gemma": False, "model": configured_model}
