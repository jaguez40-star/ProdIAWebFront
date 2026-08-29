import logging
import os
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler

from config.settings import BASE_DIR


class AuthLogger:
    """
    Logger específico para registrar operaciones de autenticación (login/logout)
    """

    def __init__(self, log_dir=None, log_filename="auth_operations.log"):
        """
        Inicializa el logger de autenticación

        Args:
            log_dir (str): Directorio donde se guardarán los logs
            log_filename (str): Nombre del archivo de log
        """
        self.log_dir = log_dir or str(BASE_DIR / "data" / "logs")
        self.log_filename = log_filename
        self.logger = self._setup_logger()

    def _setup_logger(self):
        """
        Configura el logger con el formato y handler apropiados
        """
        # Crear directorio de logs si no existe
        if not os.path.exists(self.log_dir):
            os.makedirs(self.log_dir)

        # Crear logger específico para auth
        logger = logging.getLogger("auth_operations")
        logger.setLevel(logging.INFO)

        # Evitar duplicar handlers si ya existe
        if logger.hasHandlers():
            logger.handlers.clear()

        # Configurar handler con rotación diaria
        log_path = os.path.join(self.log_dir, self.log_filename)
        handler = TimedRotatingFileHandler(
            log_path,
            when="midnight",
            interval=1,
            backupCount=30,  # Mantener 30 días de logs
            encoding="utf-8",
        )

        # Formato específico para operaciones de auth
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)

        # Agregar handler al logger
        logger.addHandler(handler)

        return logger

    def log_login_success(self, username, domain=None):
        """
        Registra un login exitoso

        Args:
            username (str): Nombre del usuario
            domain (str): Dominio del usuario (opcional)
        """
        domain_info = f" | Dominio: {domain}" if domain else ""
        self.logger.info(f"LOGIN_SUCCESS | Usuario: {username}{domain_info}")

    def log_login_failure(self, username, reason=None):
        """
        Registra un intento de login fallido

        Args:
            username (str): Nombre del usuario
            reason (str): Razón del fallo (opcional)
        """
        reason_info = f" | Razón: {reason}" if reason else ""
        self.logger.warning(f"LOGIN_FAILURE | Usuario: {username}{reason_info}")

    def log_logout(self, username, domain=None):
        """
        Registra un logout

        Args:
            username (str): Nombre del usuario
            domain (str): Dominio del usuario (opcional)
        """
        domain_info = f" | Dominio: {domain}" if domain else ""
        self.logger.info(f"LOGOUT | Usuario: {username}{domain_info}")

    def log_session_expired(self, username):
        """
        Registra una sesión expirada

        Args:
            username (str): Nombre del usuario
        """
        self.logger.info(f"SESSION_EXPIRED | Usuario: {username}")


# Instancia global del logger de autenticación
auth_logger = AuthLogger()
