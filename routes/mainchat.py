"""
Blueprint de la página MainChat.

Cascarón vacío: reusa el header/footer de base.html y deja la zona central
en blanco, a la espera del contenido real. Mismo patrón que colapsable.py
para no tocar los pipelines existentes.
"""

from pathlib import Path

from flask import Blueprint, render_template, session

from utils.auth_middleware import login_required

BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "MainChat" / "templates"
STATIC_DIR = BASE_DIR / "MainChat" / "static"

mainchat_bp = Blueprint(
    "mainchat",
    __name__,
    template_folder=str(TEMPLATES_DIR),
    static_folder=str(STATIC_DIR),
    static_url_path="/mainchat-static",
)


@mainchat_bp.route("/mainchat")
@login_required
def mainchat_view():
    """Renderiza el cascarón vacío de MainChat."""

    if "user_id" not in session:
        user = session.get("user")
        if user:
            session["user_id"] = user.get("username", "default")

    return render_template("mainchat_layout.html")
