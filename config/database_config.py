"""
Database configuration management
Handles credentials, connection settings, and environment variables
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Optional, Any
from utils.streamlit_stub import st  # Temporary stub for Flask version
from dotenv import load_dotenv

# Configure logging
logger = logging.getLogger(__name__)

class DatabaseCredentialsManager:
    """Manages database credentials securely"""
    
    def __init__(self):
        self.credentials_file = Path("credentials.json")
        self.env_file = Path(".env")
        self._load_environment()
    
    def _load_environment(self):
        """Load environment variables from .env file"""
        if self.env_file.exists():
            load_dotenv(self.env_file)
    
    def get_credentials(self) -> Dict[str, str]:
        """Get database credentials from various sources"""
        credentials = {}
        
        # Priority order: 1. Environment variables, 2. credentials.json, 3. Streamlit secrets
        
        # 1. Environment variables
        env_credentials = {
            'DB_HOST': os.getenv('DB_HOST'),
            'DB_PORT': os.getenv('DB_PORT', '1433'),
            'DB_NAME': os.getenv('DB_NAME'),
            'DB_USER': os.getenv('DB_USER'),
            'DB_PASSWORD': os.getenv('DB_PASSWORD')
        }
        
        # Remove None values
        env_credentials = {k: v for k, v in env_credentials.items() if v is not None}
        credentials.update(env_credentials)
        
        # 2. credentials.json file
        if self.credentials_file.exists():
            try:
                with open(self.credentials_file, 'r') as f:
                    file_credentials = json.load(f)
                    # Only use file credentials if env vars are not set
                    for key, value in file_credentials.items():
                        if key not in credentials and value:
                            credentials[key] = value
            except Exception as e:
                logger.warning(f"Could not load credentials file: {str(e)}")
        
        # 3. Streamlit secrets
        try:
            if hasattr(st, 'secrets') and 'database' in st.secrets:
                secrets_credentials = st.secrets['database']
                for key, value in secrets_credentials.items():
                    if key not in credentials and value:
                        credentials[key] = value
        except Exception as e:
            logger.warning(f"Could not load Streamlit secrets: {str(e)}")
        
        return credentials
    
    def save_credentials(self, credentials: Dict[str, str], save_to_file: bool = False):
        """Save credentials to environment or file"""
        
        if save_to_file:
            # Save to credentials.json
            try:
                with open(self.credentials_file, 'w') as f:
                    json.dump(credentials, f, indent=2)
                logger.info("Credentials saved to file")
                return True
            except Exception as e:
                logger.error(f"Failed to save credentials to file: {str(e)}")
                return False
        else:
            # Save to session state only
            if 'database_credentials' not in st.session_state:
                st.session_state.database_credentials = {}
            st.session_state.database_credentials.update(credentials)
            return True
    
    def validate_credentials(self, credentials: Dict[str, str]) -> Dict[str, Any]:
        """Validate database credentials"""
        
        required_fields = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']
        validation_result = {
            'valid': True,
            'missing_fields': [],
            'warnings': []
        }
        
        # Check required fields
        for field in required_fields:
            if not credentials.get(field):
                validation_result['missing_fields'].append(field)
                validation_result['valid'] = False
        
        # Validate port
        port = credentials.get('DB_PORT', '1433')
        try:
            port_int = int(port)
            if port_int < 1 or port_int > 65535:
                validation_result['warnings'].append("Puerto fuera del rango válido (1-65535)")
        except ValueError:
            validation_result['warnings'].append("Puerto debe ser un número")
        
        # Check for common issues
        if credentials.get('DB_HOST') in ['localhost', '127.0.0.1']:
            validation_result['warnings'].append("Usando host local - asegúrate de que SQL Server esté ejecutándose")
        
        return validation_result
    
    def create_env_template(self) -> str:
        """Create .env file template"""
        template = """# Database Configuration
# SQL Server connection settings

# Database server host (IP or hostname)
DB_HOST=your_server_host

# Database server port (default: 1433)
DB_PORT=1433

# Database name
DB_NAME=your_database_name

# Database user
DB_USER=your_username

# Database password
DB_PASSWORD=your_password

# Optional: LLM Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:latest
LLM_TEMPERATURE=0.1

# Optional: Performance settings
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=5
DB_QUERY_TIMEOUT=60
DB_MAX_ROWS=5000
"""
        return template
    
    def create_credentials_template(self) -> Dict[str, str]:
        """Create credentials.json template"""
        return {
            "DB_HOST": "your_server_host",
            "DB_PORT": "1433", 
            "DB_NAME": "your_database_name",
            "DB_USER": "your_username",
            "DB_PASSWORD": "your_password"
        }

def render_database_configuration():
    """Render database configuration interface in Streamlit"""
    
    st.markdown("### 🔧 Configuración de Base de Datos")
    
    # Create credentials manager
    cred_manager = DatabaseCredentialsManager()
    
    # Get current credentials
    current_credentials = cred_manager.get_credentials()
    
    # Configuration tabs
    tab1, tab2, tab3 = st.tabs(["⚙️ Configurar", "📄 Plantillas", "✅ Validar"])
    
    with tab1:
        st.markdown("#### Credenciales de Conexión")
        
        # Form for credentials
        with st.form("database_credentials"):
            col1, col2 = st.columns(2)
            
            with col1:
                db_host = st.text_input(
                    "Servidor (Host)",
                    value=current_credentials.get('DB_HOST', ''),
                    placeholder="ej: servidor.empresa.com"
                )
                
                db_name = st.text_input(
                    "Base de Datos", 
                    value=current_credentials.get('DB_NAME', ''),
                    placeholder="ej: ProductionDB"
                )
            
            with col2:
                db_port = st.text_input(
                    "Puerto",
                    value=current_credentials.get('DB_PORT', '1433'),
                    placeholder="1433"
                )
                
                db_user = st.text_input(
                    "Usuario",
                    value=current_credentials.get('DB_USER', ''),
                    placeholder="ej: readonly_user"
                )
            
            db_password = st.text_input(
                "Contraseña",
                type="password",
                value=current_credentials.get('DB_PASSWORD', ''),
                placeholder="Contraseña del usuario"
            )
            
            # Save options
            st.markdown("#### Opciones de Guardado")
            
            col1, col2 = st.columns(2)
            with col1:
                save_to_file = st.checkbox(
                    "💾 Guardar en credentials.json",
                    help="Guarda las credenciales en un archivo local (no recomendado para producción)"
                )
            
            with col2:
                save_to_env = st.checkbox(
                    "📝 Mostrar variables de entorno",
                    help="Muestra las variables de entorno para configurar manualmente"
                )
            
            # Submit button
            if st.form_submit_button("💾 Guardar Configuración", type="primary"):
                new_credentials = {
                    'DB_HOST': db_host,
                    'DB_PORT': db_port,
                    'DB_NAME': db_name,
                    'DB_USER': db_user,
                    'DB_PASSWORD': db_password
                }
                
                # Validate credentials
                validation = cred_manager.validate_credentials(new_credentials)
                
                if validation['valid']:
                    # Save credentials
                    success = cred_manager.save_credentials(new_credentials, save_to_file)
                    
                    if success:
                        st.success("✅ Credenciales guardadas correctamente")
                        
                        # Show warnings if any
                        for warning in validation['warnings']:
                            st.warning(f"⚠️ {warning}")
                        
                        # Show environment variables if requested
                        if save_to_env:
                            st.markdown("#### 📝 Variables de Entorno")
                            st.code(f"""
export DB_HOST="{db_host}"
export DB_PORT="{db_port}"
export DB_NAME="{db_name}"
export DB_USER="{db_user}"
export DB_PASSWORD="{db_password}"
                            """, language="bash")
                    else:
                        st.error("❌ Error al guardar las credenciales")
                else:
                    st.error("❌ Credenciales incompletas:")
                    for field in validation['missing_fields']:
                        st.error(f"• {field} es requerido")
    
    with tab2:
        st.markdown("#### 📄 Plantillas de Configuración")
        
        # .env template
        st.markdown("##### Archivo .env")
        st.markdown("Crea un archivo `.env` en la raíz del proyecto:")
        
        env_template = cred_manager.create_env_template()
        st.code(env_template, language="bash")
        
        if st.button("📥 Descargar plantilla .env"):
            st.download_button(
                label="💾 Descargar .env",
                data=env_template,
                file_name=".env",
                mime="text/plain"
            )
        
        st.markdown("---")
        
        # credentials.json template
        st.markdown("##### Archivo credentials.json")
        st.markdown("Alternativa: crear un archivo `credentials.json`:")
        
        cred_template = cred_manager.create_credentials_template()
        st.code(json.dumps(cred_template, indent=2), language="json")
        
        if st.button("📥 Descargar plantilla credentials.json"):
            st.download_button(
                label="💾 Descargar credentials.json",
                data=json.dumps(cred_template, indent=2),
                file_name="credentials.json",
                mime="application/json"
            )
        
        st.markdown("---")
        
        # Streamlit secrets
        st.markdown("##### Streamlit Secrets")
        st.markdown("Para aplicaciones en Streamlit Cloud, agrega a `.streamlit/secrets.toml`:")
        
        secrets_template = f"""[database]
DB_HOST = "your_server_host"
DB_PORT = "1433"
DB_NAME = "your_database_name" 
DB_USER = "your_username"
DB_PASSWORD = "your_password"
"""
        st.code(secrets_template, language="toml")
    
    with tab3:
        st.markdown("#### ✅ Validar Configuración")
        
        if st.button("🔍 Probar Conexión", type="primary"):
            with st.spinner("Probando conexión..."):
                try:
                    from utils.database import db_manager
                    
                    # Test database connection
                    success = db_manager.test_connection()
                    
                    if success:
                        st.success("✅ Conexión exitosa a la base de datos")
                        
                        # Show database info
                        from utils.database import get_database_info
                        db_info = get_database_info()
                        
                        if db_info.get('connected'):
                            st.info(f"📊 Tablas disponibles: {db_info.get('total_tables', 0)}")
                            
                            # Show connection details
                            config = db_info.get('connection_config', {})
                            col1, col2 = st.columns(2)
                            
                            with col1:
                                st.metric("Host", config.get('host', 'N/A'))
                                st.metric("Base de Datos", config.get('database', 'N/A'))
                            
                            with col2:
                                st.metric("Max Filas", config.get('max_rows', 'N/A'))
                                st.metric("Timeout (s)", config.get('query_timeout', 'N/A'))
                    else:
                        st.error("❌ Error de conexión a la base de datos")
                        st.info("Verifica las credenciales y que el servidor esté accesible")
                        
                except Exception as e:
                    st.error(f"❌ Error al probar conexión: {str(e)}")
        
        # Show current configuration status
        st.markdown("#### 📋 Estado Actual")
        
        validation = cred_manager.validate_credentials(current_credentials)
        
        if validation['valid']:
            st.success("✅ Configuración válida")
        else:
            st.error("❌ Configuración incompleta")
            for field in validation['missing_fields']:
                st.error(f"• Falta: {field}")
        
        # Show warnings
        for warning in validation['warnings']:
            st.warning(f"⚠️ {warning}")
        
        # Show loaded credentials (masked passwords)
        if current_credentials:
            st.markdown("##### 🔍 Credenciales Cargadas")
            
            display_creds = current_credentials.copy()
            if 'DB_PASSWORD' in display_creds:
                display_creds['DB_PASSWORD'] = '*' * len(display_creds['DB_PASSWORD'])
            
            st.json(display_creds)

# Global credentials manager instance
credentials_manager = DatabaseCredentialsManager()


def get_db_connection():
    """
    Get database connection for local SQLite database (ECP_PROD.db)
    Returns a sqlite3 connection object
    """
    try:
        import sqlite3
        from pathlib import Path

        # Path to local SQLite database
        db_path = Path("data/ECP_PROD.db")

        if not db_path.exists():
            logger.error(f"SQLite database not found at: {db_path}")
            return None

        # Create connection
        connection = sqlite3.connect(str(db_path))
        logger.info(f"SQLite database connection established to {db_path}")

        return connection

    except Exception as e:
        logger.error(f"Failed to create SQLite connection: {e}")
        return None


def get_db_connection_sqlserver():
    """
    Get database connection for SQL Server (DataGenesis)
    Returns a pyodbc connection object
    DEPRECATED: Use get_db_connection() for local SQLite instead
    """
    try:
        import pyodbc

        # Get credentials
        credentials = credentials_manager.get_credentials()

        if not credentials.get('DB_HOST') or not credentials.get('DB_NAME'):
            logger.error("Missing database credentials")
            return None

        # Build connection string
        conn_str = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={credentials.get('DB_HOST')};"
            f"DATABASE={credentials.get('DB_NAME')};"
            f"UID={credentials.get('DB_USER')};"
            f"PWD={credentials.get('DB_PASSWORD')}"
        )

        # Create connection
        connection = pyodbc.connect(conn_str, timeout=30)
        logger.info(f"Database connection established to {credentials.get('DB_NAME')}")

        return connection

    except Exception as e:
        logger.error(f"Failed to create database connection: {e}")
        return None


# Export main functions
__all__ = [
    'DatabaseCredentialsManager',
    'credentials_manager',
    'render_database_configuration',
    'get_db_connection'
]