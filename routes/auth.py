"""
Authentication routes - Login/Logout functionality
"""

import logging
import os
from datetime import datetime

import requests as http_requests
from flask import Blueprint, current_app, jsonify, request, session

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

LAUNCHER_VERIFY_URL = os.getenv(
    "LAUNCHER_VERIFY_URL",
    "http://10.100.26.139:5010/api/auth/verify",  # default DEV; PROD: cambiar el .env a :5001
)

# =====================================================================
# CONFIGURACIÓN POR ENTORNO (env-driven, default SEGURO para producción)
# ---------------------------------------------------------------------
# El MISMO código de Git sirve para dev y prod; la diferencia la marca
# el .env. Sin variables definidas => comportamiento seguro (LDAP activo,
# sin bypass), apto para producción.
#
#   DEVELOPMENT_MODE=true   -> salta verificación DNS/LDAP (solo dev)
#   LOGIN_BYPASS_EMAILS=a@x.co,b@y.co  -> esos correos entran SIN LDAP ni
#                                          lista blanca (solo dev)
# =====================================================================

# Modo desarrollo: si True, se salta la verificación DNS/LDAP (mantiene
# la validación de lista blanca). Default FALSE => producción segura.
DEVELOPMENT_MODE = os.getenv("DEVELOPMENT_MODE", "false").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

# Excepción de login (bypass): los correos aquí pueden ingresar SIN pasar
# por LDAP NI por la lista blanca, con cualquier contraseña. Default VACÍO
# => sin bypass (producción segura). Se activa solo poniendo la variable.
LOGIN_BYPASS_EMAILS = {
    e.strip().lower()
    for e in os.getenv("LOGIN_BYPASS_EMAILS", "").split(",")
    if e.strip()
}


def get_auth_service():
    """Obtiene o crea una instancia del servicio de autenticación"""
    if not hasattr(current_app, "auth_service"):
        from utils.auth_service import AuthService

        current_app.auth_service = AuthService()
    return current_app.auth_service


@auth_bp.route("/token-login", methods=["POST"])
def token_login():
    """
    Login SSO vía JWT del launcher de Ecopetrol.

    Recibe {"token": "<JWT>"}, lo valida contra LAUNCHER_VERIFY_URL,
    y si OK crea una sesión Flask con EL MISMO SHAPE que /auth/login.
    No consulta la whitelist local: confía en que el launcher ya autorizó.
    """
    try:
        from utils.auth_logger import auth_logger

        data = request.get_json() or {}
        token = (data.get("token") or "").strip()
        if not token:
            return jsonify({
                "success": False,
                "message": "Token requerido",
                "user_info": None,
            }), 400

        # Validar token contra el launcher
        try:
            r = http_requests.get(
                LAUNCHER_VERIFY_URL,
                headers={"Authorization": f"Bearer {token}"},
                timeout=5,
            )
        except Exception as e:
            logger.error(f"Error contactando launcher en {LAUNCHER_VERIFY_URL}: {e}")
            return jsonify({
                "success": False,
                "message": "Error contactando launcher",
                "user_info": None,
            }), 503

        if r.status_code != 200:
            logger.warning(
                f"Token rechazado por launcher (status {r.status_code}): {r.text[:200]}"
            )
            return jsonify({
                "success": False,
                "message": "Token inválido o expirado",
                "user_info": None,
            }), 401

        user_data = r.json().get("data", {}) or {}
        user_email = (user_data.get("email") or "").strip().lower()
        if not user_email:
            return jsonify({
                "success": False,
                "message": "Respuesta del launcher sin email",
                "user_info": None,
            }), 502

        # Derivar first_name, last_name, full_name del email — mismo cómputo que /auth/login
        local_part = user_email.split("@")[0]
        name_parts = local_part.split(".")
        first_name = (
            " ".join(p.capitalize() for p in name_parts[:-1])
            if len(name_parts) > 1
            else name_parts[0].capitalize()
        )
        last_name = name_parts[-1].capitalize() if len(name_parts) > 1 else ""

        # Shape de sesión IDÉNTICO al de /auth/login — no quitar campos ni cambiar claves.
        # Lección de Eficiencias (bug #11 documentado en la guia de Landing): si el shape difiere,
        # código downstream (queries, SocketIO, UI) falla en silencio.
        session["user"] = {
            "username": user_email,        # email completo, mismo formato que login normal
            "domain": "ECOPETROL",
            "email": user_email,
            "authenticated": True,
            "first_name": first_name,
            "last_name": last_name,
            "full_name": f"{first_name} {last_name}".strip(),
        }
        session["user_id"] = user_email     # usado por SocketIO (app.py:129)
        session["user_email"] = user_email  # usado por la UI

        auth_logger.log_login_success(username=user_email, domain="ECOPETROL")
        logger.info(f"LOGIN EXITOSO (SSO) - Usuario: {user_email}")

        return jsonify({
            "success": True,
            "message": "Acceso via launcher autorizado",
            "user_info": {
                "username": user_email,
                "domain": "ECOPETROL",
                "email": user_email,
            },
        }), 200

    except Exception as e:
        logger.error(f"Error en endpoint /auth/token-login: {e}")
        return jsonify({
            "success": False,
            "message": f"Error interno del servidor: {str(e)}",
            "user_info": None,
        }), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Autenticar usuario con credenciales LDAP de Ecopetrol

    Autentica un usuario contra el Active Directory de Ecopetrol
    usando el protocolo LDAP seguro.
    """
    try:
        from utils.auth_logger import auth_logger

        data = request.get_json()
        username = data.get("username", "").strip()
        password = data.get("password", "")

        # Validar que se proporcionen ambos campos
        if not username or not password:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": "Usuario y contraseña son requeridos",
                        "user_info": None,
                    }
                ),
                400,
            )

        # Obtener servicio de autenticación
        auth_service = get_auth_service()

        # =============================================================
        # EXCEPCIÓN DE LOGIN (BYPASS) — SOLO DESARROLLO
        # Salta LDAP y lista blanca para los correos en LOGIN_BYPASS_EMAILS.
        # Ver definición y notas para desactivarlo arriba de este archivo.
        # =============================================================
        bypass_email = auth_service.get_user_email(username).lower()
        if bypass_email in LOGIN_BYPASS_EMAILS:
            local_part = bypass_email.split("@")[0]
            name_parts = local_part.split(".")
            first_name = (
                " ".join(p.capitalize() for p in name_parts[:-1])
                if len(name_parts) > 1
                else name_parts[0].capitalize()
            )
            last_name = name_parts[-1].capitalize() if len(name_parts) > 1 else ""

            session["user"] = {
                "username": username,
                "domain": "ECOPETROL",
                "email": bypass_email,
                "authenticated": True,
                "first_name": first_name,
                "last_name": last_name,
                "full_name": f"{first_name} {last_name}".strip(),
            }
            session["user_id"] = username
            session["user_email"] = bypass_email

            auth_logger.log_login_success(username=username, domain="ECOPETROL")
            logger.warning(
                f"LOGIN BYPASS (sin LDAP/lista blanca) - Usuario: {bypass_email}"
            )

            return (
                jsonify(
                    {
                        "success": True,
                        "message": "Acceso concedido (bypass de desarrollo)",
                        "user_info": {
                            "username": username,
                            "domain": "ECOPETROL",
                            "email": bypass_email,
                        },
                    }
                ),
                200,
            )

        # Validar formato de usuario
        is_valid_format, format_message = auth_service.validate_user_format(username)
        if not is_valid_format:
            return (
                jsonify({"success": False, "message": format_message, "user_info": None}),
                400,
            )

        # VERIFICAR LISTA BLANCA PRIMERO (SIEMPRE ACTIVA)
        user_email = auth_service.get_user_email(username)
        if not auth_service.is_email_authorized(user_email):
            # Registrar acceso denegado por lista blanca
            auth_logger.log_login_failure(
                username=username,
                reason="Acceso no autorizado - Email no en lista blanca",
            )

            logger.warning(
                f"Acceso denegado para usuario: {username} - Email: {user_email}"
            )

            return (
                jsonify(
                    {
                        "success": False,
                        "message": "ACCESS_DENIED",
                        "access_denied": True,
                        "user_email": user_email,
                        "user_info": None,
                    }
                ),
                403,
            )

        # MODO DESARROLLO: usa la constante DEVELOPMENT_MODE (env-driven) definida
        # al inicio del módulo. Salta DNS/LDAP pero mantiene la lista blanca.
        if DEVELOPMENT_MODE:
            # En desarrollo: Solo validar lista blanca, no DNS/LDAP
            success = True
            message = "Autenticación exitosa (modo desarrollo - lista blanca validada)"
            user_info = {
                "username": username,
                "domain": "ECOPETROL",
                "email": user_email,
                "authenticated_at": datetime.now().isoformat(),
            }
        else:
            # En producción: Validar DNS/LDAP después de lista blanca
            success, message, user_info = auth_service.authenticate_user(
                username, password
            )

        if success and user_info:
            # Extraer nombre y apellido del email corporativo
            local_part = user_email.split("@")[0]  # ej: "javier.guerrero"
            name_parts = local_part.split(".")     # ej: ["javier", "guerrero"]
            first_name = (
                " ".join(p.capitalize() for p in name_parts[:-1])
                if len(name_parts) > 1
                else name_parts[0].capitalize()
            )
            last_name = name_parts[-1].capitalize() if len(name_parts) > 1 else ""

            # Guardar información del usuario en la sesión
            session["user"] = {
                "username": user_info["username"],
                "domain": user_info["domain"],
                "email": user_email,
                "authenticated": True,
                "first_name": first_name,
                "last_name": last_name,
                "full_name": f"{first_name} {last_name}".strip(),
            }
            session["user_id"] = username  # Para compatibilidad con el sistema de chat
            session["user_email"] = user_email  # Para mostrar en la UI

            # Registrar login exitoso en el log de autenticación
            auth_logger.log_login_success(
                username=user_info["username"], domain=user_info["domain"]
            )

            logger.info(f"Login exitoso para usuario: {username}")

            return (
                jsonify(
                    {
                        "success": True,
                        "message": message,
                        "user_info": {
                            "username": user_info["username"],
                            "domain": user_info["domain"],
                            "email": user_email,
                        },
                    }
                ),
                200,
            )
        else:
            # Verificar si es un caso de acceso denegado por lista blanca
            if message == "ACCESS_DENIED":
                # Registrar login fallido por acceso denegado
                auth_logger.log_login_failure(
                    username=username,
                    reason="Acceso no autorizado - Email no en lista blanca",
                )

                logger.warning(
                    f"Acceso denegado para usuario: {username} - Email: {user_email}"
                )

                return (
                    jsonify(
                        {
                            "success": False,
                            "message": "ACCESS_DENIED",
                            "access_denied": True,
                            "user_email": user_email,
                            "user_info": None,
                        }
                    ),
                    403,
                )

            # Registrar login fallido en el log de autenticación
            auth_logger.log_login_failure(username=username, reason=message)

            logger.warning(f"Login fallido para usuario: {username} - {message}")

            return (
                jsonify({"success": False, "message": message, "user_info": None}),
                401,
            )

    except Exception as e:
        logger.error(f"Error en endpoint de login: {str(e)}")
        return (
            jsonify(
                {
                    "success": False,
                    "message": f"Error interno del servidor: {str(e)}",
                    "user_info": None,
                }
            ),
            500,
        )


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """
    Cerrar sesión del usuario

    Limpia la información de sesión del usuario autenticado.
    """
    try:
        from utils.auth_logger import auth_logger

        # Obtener información del usuario de la sesión
        user = session.get("user")
        username = (
            user.get("username", "usuario desconocido")
            if user
            else "usuario desconocido"
        )
        domain = user.get("domain") if user else None

        # Registrar logout en el log de autenticación
        if user and user.get("authenticated"):
            auth_logger.log_logout(username=username, domain=domain)

        # Limpiar la sesión
        session.clear()

        logger.info(f"Logout exitoso para usuario: {username}")

        return jsonify({"success": True, "message": "Sesión cerrada exitosamente"}), 200

    except Exception as e:
        logger.error(f"Error en endpoint de logout: {str(e)}")
        return (
            jsonify(
                {
                    "success": False,
                    "message": f"Error interno del servidor: {str(e)}",
                }
            ),
            500,
        )


@auth_bp.route("/status", methods=["GET"])
def auth_status():
    """
    Verificar el estado de autenticación del usuario actual

    Retorna información sobre si el usuario está autenticado.
    """
    try:
        user = session.get("user")

        if user and user.get("authenticated"):
            return (
                jsonify(
                    {
                        "authenticated": True,
                        "user": {
                            "username": user.get("username"),
                            "domain": user.get("domain"),
                            "email": user.get("email"),
                        },
                    }
                ),
                200,
            )
        else:
            return jsonify({"authenticated": False, "user": None}), 200

    except Exception as e:
        logger.error(f"Error en endpoint de estado de auth: {str(e)}")
        return jsonify({"authenticated": False, "user": None, "error": str(e)}), 500


@auth_bp.route("/health", methods=["GET"])
def auth_health():
    """
    Verificar el estado del servicio de autenticación

    Retorna información sobre la disponibilidad del servicio de autenticación.
    """
    try:
        auth_service = get_auth_service()

        return (
            jsonify(
                {
                    "service": "auth",
                    "status": "online",
                    "domain": auth_service.AD_DOMAIN,
                    "message": "Servicio de autenticación disponible",
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error en health check de auth: {str(e)}")
        return (
            jsonify(
                {
                    "service": "auth",
                    "status": "error",
                    "message": f"Error en servicio de autenticación: {str(e)}",
                }
            ),
            500,
        )


@auth_bp.route("/dns-status", methods=["GET"])
def dns_status():
    """
    Verificar el estado de la conexión DNS/LDAP

    Retorna información sobre si la aplicación puede conectarse al DNS/LDAP
    y si está en modo desarrollo.
    """
    try:
        auth_service = get_auth_service()

        # MODO DESARROLLO: misma constante env-driven que en login (definida arriba).
        if DEVELOPMENT_MODE:
            return (
                jsonify(
                    {
                        "success": True,
                        "development_mode": True,
                        "dns_available": True,  # En desarrollo asumimos que está disponible
                        "message": "Modo desarrollo activo - DNS no requerido",
                        "can_use_hierarchy": True,
                    }
                ),
                200,
            )
        else:
            # En producción: Verificar conectividad real con DNS/LDAP
            try:
                # Intentar una conexión simple para verificar DNS
                dns_available = auth_service.test_dns_connection()

                if dns_available:
                    return (
                        jsonify(
                            {
                                "success": True,
                                "development_mode": False,
                                "dns_available": True,
                                "message": "Conexión DNS/LDAP disponible",
                                "can_use_hierarchy": True,
                            }
                        ),
                        200,
                    )
                else:
                    return (
                        jsonify(
                            {
                                "success": False,
                                "development_mode": False,
                                "dns_available": False,
                                "message": "Conexión DNS/LDAP no disponible",
                                "can_use_hierarchy": False,
                            }
                        ),
                        503,
                    )  # Service Unavailable

            except Exception as dns_error:
                logger.error(f"Error verificando DNS: {str(dns_error)}")
                return (
                    jsonify(
                        {
                            "success": False,
                            "development_mode": False,
                            "dns_available": False,
                            "message": f"Error de conexión DNS/LDAP: {str(dns_error)}",
                            "can_use_hierarchy": False,
                        }
                    ),
                    503,
                )

    except Exception as e:
        logger.error(f"Error en verificación de estado DNS: {str(e)}")
        return (
            jsonify(
                {
                    "success": False,
                    "development_mode": None,
                    "dns_available": False,
                    "message": f"Error interno del servidor: {str(e)}",
                    "can_use_hierarchy": False,
                }
            ),
            500,
        )


@auth_bp.route("/request-access", methods=["POST"])
def request_access():
    """
    Solicitar acceso al sistema

    Registra una solicitud de acceso para un usuario no autorizado.
    """
    try:
        from utils.access_request_service import AccessRequestService

        data = request.get_json()
        user_email = data.get("user_email", "").strip()
        username = data.get("username", "").strip()
        reason = data.get("reason", "").strip()

        if not user_email or not username or not reason:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": "Todos los campos son requeridos",
                    }
                ),
                400,
            )

        # Usar el servicio de solicitudes de acceso
        access_request_service = AccessRequestService()
        success, result_message = access_request_service.submit_access_request(
            username=username, message=reason, user_email=user_email
        )

        if success:
            return (
                jsonify(
                    {
                        "success": True,
                        "message": result_message,
                        "details": {
                            "username": username,
                            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        },
                    }
                ),
                200,
            )
        else:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": result_message,
                        "error_code": "REQUEST_PROCESSING_ERROR",
                    }
                ),
                400,
            )

    except Exception as e:
        logger.error(f"Error en solicitud de acceso: {str(e)}")
        return (
            jsonify(
                {
                    "success": False,
                    "message": f"Error interno del servidor: {str(e)}",
                }
            ),
            500,
        )


@auth_bp.route("/authorized-emails", methods=["GET"])
def get_authorized_emails():
    """
    Obtener la lista de correos autorizados (solo para administradores)

    Retorna la lista actual de correos electrónicos autorizados.
    """
    try:
        auth_service = get_auth_service()
        authorized_emails = auth_service.get_authorized_emails()

        return (
            jsonify(
                {
                    "success": True,
                    "authorized_emails": list(authorized_emails),
                    "total_count": len(authorized_emails),
                    "filter_enabled": auth_service.EMAIL_FILTER_ENABLED,
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error obteniendo correos autorizados: {str(e)}")
        return (
            jsonify(
                {
                    "success": False,
                    "message": f"Error interno del servidor: {str(e)}",
                }
            ),
            500,
        )


@auth_bp.route("/reload-authorized-emails", methods=["POST"])
def reload_authorized_emails():
    """
    Recargar la lista de correos autorizados desde el archivo

    Útil cuando se actualiza el archivo authorized_emails.txt sin reiniciar el servidor.
    """
    try:
        auth_service = get_auth_service()
        authorized_emails = auth_service.reload_authorized_emails()

        logger.info(
            f"Lista de correos autorizados recargada: {len(authorized_emails)} correos"
        )

        return (
            jsonify(
                {
                    "success": True,
                    "message": f"Lista de correos recargada exitosamente. {len(authorized_emails)} correos autorizados.",
                    "total_count": len(authorized_emails),
                    "filter_enabled": auth_service.EMAIL_FILTER_ENABLED,
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error recargando correos autorizados: {str(e)}")
        return (
            jsonify(
                {
                    "success": False,
                    "message": f"Error interno del servidor: {str(e)}",
                }
            ),
            500,
        )
