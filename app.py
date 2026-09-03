"""
ECP Insights - Flask Version
Migrated from Streamlit to Flask for better control and flexibility
"""

from dotenv import load_dotenv
load_dotenv()

import gzip
import logging
import os
import platform
from datetime import datetime

from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash

from config.settings import DEFAULT_WELCOME_MESSAGE

# Import Windows-specific configuration
from config.windows_config import (
    get_windows_flask_config,
    get_windows_socketio_config,
    is_windows,
)

# Import existing utilities (reuse current code)
from utils.chat_history import chat_history_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app():
    """Flask app factory"""
    app = Flask(__name__)

    # Configuration
    app.config["SECRET_KEY"] = os.environ.get(
        "SECRET_KEY", "dev-secret-key-change-in-production"
    )
    app.config["DEBUG"] = os.environ.get("FLASK_DEBUG", "True").lower() == "true"

    # Session configuration
    app.config["SESSION_TYPE"] = "filesystem"
    app.config["SESSION_PERMANENT"] = True
    app.config["PERMANENT_SESSION_LIFETIME"] = 86400  # 24 hours
    app.config["SESSION_COOKIE_SECURE"] = False  # Set to True in production with HTTPS
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    # Enable CORS
    CORS(app)

    # Initialize SocketIO with platform-specific settings
    if is_windows():
        socketio_config = get_windows_socketio_config()
        logger.info("Using Windows-optimized SocketIO configuration")
    else:
        socketio_config = {
            "cors_allowed_origins": "*",
            "async_mode": "threading",
            "ping_timeout": 60,
            "ping_interval": 25,
        }

    socketio = SocketIO(app, **socketio_config)

    # Register blueprints
    from routes.api import api_bp
    from routes.auth import auth_bp
    from routes.chat import chat_bp
    from routes.main import main_bp
    from routes.colapsable import colapsable_bp
    from routes.mainchat import mainchat_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(chat_bp, url_prefix="/chat")
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(auth_bp)
    app.register_blueprint(colapsable_bp)
    app.register_blueprint(mainchat_bp)

    # Compresión gzip para respuestas JSON grandes
    @app.after_request
    def compress_response(response):
        if (response.status_code < 200 or response.status_code >= 300
                or 'Content-Encoding' in response.headers
                or not response.content_type
                or 'application/json' not in response.content_type):
            return response

        data = response.get_data()
        if len(data) < 1024:
            return response

        accept_encoding = request.headers.get('Accept-Encoding', '')
        if 'gzip' not in accept_encoding:
            return response

        compressed = gzip.compress(data, compresslevel=6)
        response.set_data(compressed)
        response.headers['Content-Encoding'] = 'gzip'
        response.headers['Content-Length'] = len(compressed)
        response.headers['Vary'] = 'Accept-Encoding'
        return response

    # [2026-09-03] Registro de actividad para Admin > Usuarios Uso.
    # Un solo hook en vez de instrumentar las 55 rutas de los 6 blueprints: cubre
    # todo sin tocar routes/api.py ni routes/chat.py (archivos compartidos).
    # Solo registra peticiones de negocio con sesión iniciada; los estáticos, el
    # polling de socket.io y el tráfico anónimo se descartan (serían ruido: el
    # histórico medido da 469 peticiones totales frente a 223 útiles).
    # [2026-09-03] R2: /api/consulta*/preguntar son las preguntas reales del chat de
    # /mainchat (multitab_shell.js pregunta por HTTP). El chat clásico (/) va por
    # socket.io y NO pasa por aquí (R1, límite conocido): de él solo se capta crear/abrir
    # conversación. El orden importa: prefijos más específicos ANTES que los genéricos si
    # se solaparan (aquí no se solapan, pero se mantiene el criterio).
    ACTIVIDAD_RUTAS = (
        ("/api/consulta/preguntar", "CHAT"),
        ("/api/consulta2/preguntar", "CHAT"),
        ("/new_conversation", "CHAT"),
        ("/select_conversation", "CHAT"),
        ("/api/conversation", "CHAT"),
        ("/api/generate_fixed_report", "REPORTE"),
        ("/api/ai/generate_chart", "GRAFICA"),
    )

    @app.after_request
    def registrar_actividad(response):
        try:
            if response.status_code >= 400:
                return response

            usuario = session.get("user_email")
            if not usuario:
                return response

            ruta = request.path
            for prefijo, accion in ACTIVIDAD_RUTAS:
                if ruta.startswith(prefijo):
                    from utils.auth_logger import auth_logger

                    auth_logger.log_actividad(
                        username=usuario, accion=accion, ruta=ruta
                    )
                    break
        except Exception:
            # El registro de actividad NUNCA debe tumbar una respuesta buena.
            logger.debug("No se pudo registrar la actividad", exc_info=True)

        return response

    # Login route
    @app.route("/login")
    def login():
        """Login page"""
        return render_template("login.html")

    # SocketIO event handlers
    @socketio.on("connect")
    def handle_connect():
        """Handle client connection"""
        logger.info("SocketIO client connect attempt")

        # Check authentication
        user = session.get("user")
        if not user or not user.get("authenticated"):
            logger.warning(
                "SocketIO connect rejected: no authenticated session "
                f"(session keys: {list(session.keys())})"
            )
            emit("error", {"msg": "Autenticación requerida"})
            return False

        # User is authenticated, join their room
        user_id = session.get("user_id")
        if not user_id:
            user_id = user.get("username", "default")
            session["user_id"] = user_id

        join_room(user_id)
        logger.info(f"SocketIO client connected: {user_id}")
        emit("status", {"msg": "Connected to ECP Insights"})

    @socketio.on("disconnect")
    def handle_disconnect():
        """Handle client disconnection"""
        logger.info(f"Client disconnected")
        if "user_id" in session:
            leave_room(session["user_id"])

    @socketio.on("send_message")
    def handle_message(data):
        """Handle chat message with 3-panel support"""
        try:
            # Check authentication
            user = session.get("user")
            if not user or not user.get("authenticated"):
                emit("error", {"msg": "Autenticación requerida"})
                return

            conversation_id = data.get("conversation_id")
            message_content = data.get("message", "").strip()
            report_mode = data.get("report_mode")

            if not conversation_id or not message_content:
                emit("error", {"msg": "Invalid message data"})
                return

            # Add user message to database
            chat_history_manager.add_message(conversation_id, "user", message_content)

            # Emit user message immediately
            emit(
                "new_message",
                {
                    "role": "user",
                    "content": message_content,
                    "timestamp": datetime.now().isoformat(),
                },
                to=session["user_id"],
            )

            # Emit processing stage updates with small delays for better UX
            emit(
                "processing_stage",
                {"stage": "Analizando consulta...", "progress": 10},
                to=session["user_id"],
            )

            # Small delay for visual feedback
            import time

            time.sleep(0.3)

            # Generate AI response with complete 3-panel system
            emit(
                "processing_stage",
                {"stage": "Ejecutando consulta SQL...", "progress": 30},
                to=session["user_id"],
            )
            full_response = get_ai_response_with_panels(message_content, report_mode=report_mode)

            # Small delay before next stage
            time.sleep(0.2)
            emit(
                "processing_stage",
                {"stage": "Generando sugerencias...", "progress": 70},
                to=session["user_id"],
            )

            # Add AI response to database with complete metadata for persistence
            ai_response = full_response.get("response") or "No response"

            # Safeguard: if data exists but response is fallback, use data summary instead
            panel_1_info = full_response.get("panel_1", {})
            panel_1_data_check = panel_1_info.get("data")
            if (panel_1_data_check and len(panel_1_data_check) > 0
                    and isinstance(ai_response, str)
                    and "No encontré resultados" in ai_response):
                rows_count = len(panel_1_data_check)
                ai_response = f"📊 **{message_content}** — {rows_count:,} registros"
                logger.warning("Safeguard: replaced fallback response with data summary")

            # Prepare metadata with all panel data for HTML persistence
            message_metadata = {
                "panel_data": {
                    "panel_1": full_response.get("panel_1", {}),
                    "panel_2": full_response.get("panel_2", {}),
                    "panel_3": full_response.get("panel_3", {}),
                    "original_query": message_content
                },
                "method": full_response.get("method", "unknown"),
                "agent_type": full_response.get("agent_type", "unknown"),
                "database_used": full_response.get("database_used"),
                "sql_query": full_response.get("sql_query"),
                "processing_time": full_response.get("processing_time")
            }

            chat_history_manager.add_message(
                conversation_id,
                "assistant",
                ai_response,
                metadata=message_metadata
            )

            # Get panel data for processing
            panel_2_data = full_response.get("panel_2", {})
            panel_3_data = full_response.get("panel_3", {})

            # Check if response has data for auto-triggering followup
            has_data = panel_2_data.get("success", False) or (
                full_response.get("panel_1", {}).get("data") is not None
            )

            # Emit AI response for Panel 1
            emit(
                "new_message",
                {
                    "role": "assistant",
                    "content": ai_response,
                    "timestamp": datetime.now().isoformat(),
                    "has_data": has_data,
                    "panel_data": {
                        "panel_1": full_response.get("panel_1", {}),
                        "original_query": message_content,
                    },
                },
                to=session["user_id"],
            )

            # Emit Panel 2 data if available
            if panel_2_data.get("success", False):
                # Check if this is the new chart buttons format
                if panel_2_data.get("panel_type") == "chart_buttons":
                    logger.info(f"📡 Emitting NEW PANEL 2 FORMAT - Chart buttons")
                    panel_2_emit = {
                            "chart_buttons": panel_2_data.get("chart_buttons", []),
                            "is_graphable": panel_2_data.get("is_graphable", True),
                            "data_quality": panel_2_data.get("data_quality", "good"),
                            "button_summary": panel_2_data.get("button_summary", ""),
                            "fallback_message": panel_2_data.get(
                                "fallback_message", ""
                            ),
                            "panel_type": "chart_buttons",
                            "timestamp": datetime.now().isoformat(),
                    }
                    if panel_2_data.get("categorized_buttons"):
                        panel_2_emit["categorized_buttons"] = panel_2_data["categorized_buttons"]
                    emit(
                        "panel_2_update",
                        panel_2_emit,
                        to=session["user_id"],
                    )
                else:
                    # Old format (backward compatibility)
                    logger.info(f"📡 Emitting OLD PANEL 2 FORMAT - Traditional content")
                    emit(
                        "panel_2_update",
                        {
                            "suggestions": panel_2_data.get("suggestions", []),
                            "insights": panel_2_data.get("insights", []),
                            "recommended_actions": panel_2_data.get(
                                "recommended_actions", []
                            ),
                            "timestamp": datetime.now().isoformat(),
                        },
                        to=session["user_id"],
                    )

            # Emit Panel 3 data if available
            if panel_3_data.get("success", False):
                # Include Panel 1 data for chart generation
                panel_1_data = full_response.get("panel_1", {}).get("data", [])

                # Check if this is the new charts-ready format
                if panel_3_data.get("panel_type") and panel_3_data.get(
                    "panel_type"
                ).startswith("charts_"):
                    logger.info(f"📡 Emitting NEW PANEL 3 FORMAT - Ready for charts")
                    panel_3_payload = {
                        "success": True,
                        "ready_for_charts": panel_3_data.get("ready_for_charts", True),
                        "followup_content": panel_3_data.get("followup_content", {}),
                        "panel_type": panel_3_data.get(
                            "panel_type", "charts_with_followup"
                        ),
                        "timestamp": datetime.now().isoformat(),
                    }
                else:
                    # Old format (backward compatibility)
                    logger.info(
                        f"📡 Emitting OLD PANEL 3 FORMAT - Traditional analytics"
                    )
                    panel_3_payload = {
                        "success": True,
                        "is_graphable": panel_3_data.get("is_graphable", True),
                        "data_quality": panel_3_data.get("data_quality", "good"),
                        "dynamic_buttons": panel_3_data.get("dynamic_buttons", []),
                        "chart_recommendations": panel_3_data.get(
                            "chart_recommendations", []
                        ),
                        "auto_generated_charts": panel_3_data.get(
                            "auto_generated_charts", []
                        ),
                        "query_type": panel_3_data.get("query_type", "general"),
                        "petroleum_metrics_found": panel_3_data.get(
                            "petroleum_metrics_found", []
                        ),
                        "fallback_message": panel_3_data.get("fallback_message", ""),
                        "visualization_summary": panel_3_data.get(
                            "visualization_summary", ""
                        ),
                        "source_data": panel_1_data,  # Add Panel 1 data directly
                        "timestamp": datetime.now().isoformat(),
                    }

                logger.info(
                    f"📡 Emitting panel_3_update with {len(panel_3_payload.get('dynamic_buttons', []))} dynamic buttons"
                )
                logger.info(
                    f"🔘 Buttons: {[btn.get('title', 'No title') for btn in panel_3_payload.get('dynamic_buttons', [])]}"
                )
                logger.info(
                    f"📊 Including {len(panel_1_data) if panel_1_data else 0} rows of source data"
                )

                emit("panel_3_update", panel_3_payload, to=session["user_id"])

            # Small final delay before completion
            time.sleep(0.2)

            # Final processing complete
            emit(
                "processing_stage",
                {"stage": "Procesamiento completo", "progress": 100},
                to=session["user_id"],
            )

        except Exception as e:
            logger.error(f"Error handling message: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # Emit both error toast AND a visible chat message so the user always sees feedback
            emit("error", {"msg": "Error processing message"})
            emit(
                "new_message",
                {
                    "role": "assistant",
                    "content": (
                        "Lo siento, ocurrió un error al procesar tu consulta. "
                        "Por favor intenta de nuevo o reformula tu pregunta."
                    ),
                    "timestamp": datetime.now().isoformat(),
                    "has_data": False,
                },
                to=session.get("user_id", "default"),
            )

    @socketio.on("generate_followup")
    def handle_generate_followup(data):
        """Handle automatic followup generation"""
        try:
            # Check authentication
            user = session.get("user")
            if not user or not user.get("authenticated"):
                emit("error", {"msg": "Autenticación requerida"})
                return

            conversation_id = data.get("conversation_id")
            message_data = data.get("message_data", {})
            auto_execute = data.get("auto_execute", True)

            if not conversation_id:
                emit("error", {"msg": "Invalid followup request"})
                return

            logger.info(
                f"Generating automatic followup for conversation {conversation_id}"
            )

            # Get panel data from the message
            panel_data = message_data.get("panel_data", {})
            panel_1_data = panel_data.get("panel_1", {})
            original_query = panel_data.get("original_query", "")

            # Use FollowupAgent to generate automatic analysis
            try:
                import pandas as pd

                from chatbot.agents.followup_agent import FollowupAgent

                followup_agent = FollowupAgent()

                # Convert panel data to DataFrame if needed
                results_data = pd.DataFrame()
                if panel_1_data.get("data"):
                    results_data = pd.DataFrame(panel_1_data["data"])

                # Generate followup with auto-execution
                result = followup_agent.generate_followups(
                    original_question=original_query,
                    sql_query=panel_1_data.get("sql_query", ""),
                    results_data=results_data,
                    agent_type="production",
                    context={"source": "auto_trigger", "auto_execute": auto_execute},
                )

                if result.success:
                    # Emit followup data to Panel 2
                    emit(
                        "panel_2_update",
                        {
                            "success": True,
                            "auto_executed": True,
                            "executive_analyses": result.data.get(
                                "executive_analyses", []
                            ),
                            "contextual_insights": result.data.get(
                                "contextual_insights", []
                            ),
                            "query_analysis": result.data.get("query_analysis", {}),
                            "panel_type": "executive_dashboard",
                        },
                        to=session["user_id"],
                    )
                    logger.info(f"Followup analysis sent to Panel 2")
                else:
                    emit(
                        "error",
                        {"msg": f"Error en análisis de followup: {result.error}"},
                    )

            except Exception as e:
                logger.error(f"Error in followup agent: {e}")
                emit("error", {"msg": f"Error generando análisis automático: {str(e)}"})

        except Exception as e:
            logger.error(f"Error in handle_generate_followup: {e}")
            emit("error", {"msg": f"Error en followup automático: {str(e)}"})

    def get_ai_response(prompt):
        """Generate AI response using the API endpoint - legacy single panel"""
        import requests

        try:
            response = requests.post(
                "http://localhost:5029/api/ai/generate",
                json={"prompt": prompt},
                timeout=120,
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    return data.get("response", "Sin respuesta del modelo")

        except Exception as e:
            logger.error(f"Error getting AI response: {e}")

        # Fallback response
        return f"Recibí tu mensaje: '{prompt[:50]}...' El sistema de IA está procesando tu solicitud."

    def get_ai_response_with_panels(prompt, report_mode=None):
        """Generate AI response with complete 3-panel system"""
        import requests

        try:
            response = requests.post(
                "http://localhost:5029/api/ai/generate",
                json={
                    "prompt": prompt,
                    "timestamp": datetime.now().isoformat(),
                    "report_mode": report_mode,
                },
                timeout=120,
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    return {
                        "response": data.get("response", "Sin respuesta del modelo"),
                        "panel_1": data.get("panel_1", {}),
                        "panel_2": data.get("panel_2", {}),
                        "panel_3": data.get("panel_3", {}),
                        "method": data.get("method", "unknown"),
                        "routed_agent": data.get("routed_agent", "unknown"),
                    }
                else:
                    return {
                        "response": data.get("error", "Error en el procesamiento"),
                        "panel_1": {
                            "success": False,
                            "error": data.get("error", "Unknown error"),
                        },
                        "panel_2": {"success": False, "error": "Processing failed"},
                        "panel_3": {"success": False, "error": "Processing failed"},
                    }

        except Exception as e:
            logger.error(f"Error getting AI response with panels: {e}")

        # Fallback response
        return {
            "response": f"Recibí tu mensaje: '{prompt[:50]}...' El sistema de IA está procesando tu solicitud.",
            "panel_1": {"success": False, "error": "System error"},
            "panel_2": {"success": False, "error": "System error"},
            "panel_3": {"success": False, "error": "System error"},
        }

    return app, socketio


def check_ollama_status():
    """Check Ollama status - reuse from original"""
    import os
    import requests

    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    configured_model = os.getenv("OLLAMA_MODEL", "gemma4:latest")
    try:
        response = requests.get(f"{base_url}/api/tags", timeout=2)
        if response.status_code == 200:
            models = response.json().get("models", [])
            available_models = [model["name"] for model in models]
            return {
                "running": True,
                "models": available_models,
                "has_gemma": configured_model in available_models,
            }
    except Exception as e:
        logger.debug(f"Ollama check failed: {e}")

    return {"running": False, "models": [], "has_gemma": False}


if __name__ == "__main__":
    app, socketio = create_app()

    # Platform-specific configuration
    if is_windows():
        logger.info("Running on Windows - using optimized configuration")
        logger.info(f"Platform: {platform.system()} {platform.release()}")
        # Windows-specific run configuration
        socketio.run(
            app,
            debug=True,
            host="0.0.0.0",
            port=5029,
            use_reloader=False,  # Prevent file watching issues on Windows
            allow_unsafe_werkzeug=True,  # App interna: permitir servidor Werkzeug
        )
    else:
        socketio.run(
            app,
            debug=True,
            host="0.0.0.0",
            port=5029,
            allow_unsafe_werkzeug=True,
        )
