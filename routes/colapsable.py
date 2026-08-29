"""
Blueprint for the alternate adjustable panel view.
Keeps logic separated so current pipelines remain untouched.
"""

from pathlib import Path

from flask import Blueprint, render_template, session

from routes.main import check_ollama_status
from utils.auth_middleware import login_required
from utils.chat_history import chat_history_manager

BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "Colapsable" / "templates"
STATIC_DIR = BASE_DIR / "Colapsable" / "static"

colapsable_bp = Blueprint(
    "colapsable",
    __name__,
    template_folder=str(TEMPLATES_DIR),
    static_folder=str(STATIC_DIR),
    static_url_path="/colapsable-static",
)


@colapsable_bp.route("/layout/colapsable")
@login_required
def colapsable_view():
    """Render the independent layout with the adjustable panel."""

    if "user_id" not in session:
        user = session.get("user")
        if user:
            session["user_id"] = user.get("username", "default")

    user_id = session.get("user_id")

    conversations = []
    if user_id:
        conversations = chat_history_manager.get_user_conversations(user_id, limit=10)

    current_conv_id = session.get("current_conversation_id")

    ollama_status = check_ollama_status()

    return render_template(
        "colapsable_layout.html",
        conversations=conversations,
        current_conversation_id=current_conv_id,
        ollama_status=ollama_status,
    )
