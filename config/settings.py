"""
Configuración general de la aplicación
"""

import os
from pathlib import Path

# Rutas de la aplicación
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
EXPORTS_DIR = DATA_DIR / "exports"
CHAT_HISTORY_DIR = DATA_DIR / "chat_history"
ASSETS_DIR = BASE_DIR / "assets"

# Configuración de la base de datos
DATABASE_URL = "sqlite:///./data/ecp_insights.db"

# Configuración de Streamlit
STREAMLIT_CONFIG = {
    "page_title": "ECP Insights - Plataforma de Análisis",
    "page_icon": "🧠",
    "layout": "wide",
    "initial_sidebar_state": "expanded",
}

# Configuración de archivos
MAX_FILE_SIZE_MB = 200
ALLOWED_FILE_TYPES = {
    "images": [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg"],
    "documents": [".pdf", ".doc", ".docx", ".txt", ".md"],
    "data": [".csv", ".xlsx", ".xls", ".json", ".xml"],
    "code": [".py", ".js", ".html", ".css", ".sql"],
}

# Configuración de API (OpenAI, etc.)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = "gpt-4"
MAX_TOKENS = 4000

# Configuración de SQL
SQL_TIMEOUT = 30  # segundos
MAX_ROWS_DISPLAY = 1000

# Configuración de gráficos
DEFAULT_CHART_HEIGHT = 400
DEFAULT_CHART_WIDTH = 600

# Mensajes predeterminados
DEFAULT_WELCOME_MESSAGE = """
¡Bienvenido a ECP Insights! 🧠

Soy tu asistente de análisis de datos. Puedo ayudarte con:

- 💬 **Conversaciones inteligentes** sobre tus datos
- 📊 **Análisis SQL** y consultas de base de datos  
- 📈 **Visualizaciones** automáticas de resultados
- 📁 **Procesamiento de archivos** (CSV, Excel, PDF, imágenes)

¿En qué puedo ayudarte hoy?
"""

# Configuración de sesión
SESSION_TIMEOUT_MINUTES = 60
MAX_CHAT_HISTORY = 100

# Crear directorios si no existen
for directory in [DATA_DIR, UPLOADS_DIR, EXPORTS_DIR, CHAT_HISTORY_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
