"""
Authentication middleware and decorators
"""

import logging
from functools import wraps

from flask import redirect, session, url_for, request, jsonify

logger = logging.getLogger(__name__)


def login_required(f):
    """
    Decorator to require authentication for routes

    Usage:
        @app.route('/protected')
        @login_required
        def protected_route():
            return "This is protected"
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = session.get("user")

        if not user or not user.get("authenticated"):
            # If it's an AJAX request, return JSON
            if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({
                    "success": False,
                    "message": "Autenticación requerida",
                    "redirect": url_for("login")
                }), 401

            # Otherwise redirect to login page
            logger.warning(
                f"Intento de acceso no autorizado a {request.path} - redirigiendo a login"
            )
            return redirect(url_for("login"))

        return f(*args, **kwargs)

    return decorated_function


def get_current_user():
    """
    Get the current authenticated user from session

    Returns:
        dict: User information or None if not authenticated
    """
    user = session.get("user")

    if user and user.get("authenticated"):
        return user

    return None


def is_authenticated():
    """
    Check if the current user is authenticated

    Returns:
        bool: True if authenticated, False otherwise
    """
    user = session.get("user")
    return user is not None and user.get("authenticated", False)
