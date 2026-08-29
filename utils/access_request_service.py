"""
Servicio para manejar solicitudes de acceso usando el sistema de archivos
"""

import logging
from typing import Optional, Tuple


class AccessRequestService:
    """
    Servicio que maneja las solicitudes de acceso al sistema
    """

    def __init__(self):
        """
        Inicializa el servicio de solicitudes de acceso
        """
        self.logger = logging.getLogger(__name__)
        # Simplified version - just log the requests for now
        # If email service is needed, it can be added later

    def submit_access_request(
        self, username: str, message: str, user_email: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Procesa una solicitud de acceso creando los archivos correspondientes

        Args:
            username: Nombre del usuario que solicita acceso
            message: Mensaje explicando la solicitud
            user_email: Email del usuario (opcional)

        Returns:
            Tuple[bool, str]: (éxito, mensaje de resultado)
        """
        try:
            self.logger.info(f"Procesando solicitud de acceso para: {username}")

            # For now, just log the request
            # TODO: Implement email service or file-based logging
            import os
            from datetime import datetime

            # Create access requests log file
            log_dir = os.path.join(
                os.path.dirname(os.path.dirname(__file__)), "data", "logs"
            )
            if not os.path.exists(log_dir):
                os.makedirs(log_dir)

            log_file = os.path.join(log_dir, "access_requests.log")

            with open(log_file, "a", encoding="utf-8") as f:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                f.write(f"\n{'='*80}\n")
                f.write(f"SOLICITUD DE ACCESO - {timestamp}\n")
                f.write(f"{'='*80}\n")
                f.write(f"Usuario: {username}\n")
                f.write(f"Email: {user_email}\n")
                f.write(f"Razón: {message}\n")
                f.write(f"{'='*80}\n\n")

            self.logger.info(
                f"Solicitud de acceso procesada exitosamente para: {username}"
            )

            return True, "Solicitud de acceso registrada exitosamente. El administrador será notificado."

        except Exception as e:
            self.logger.error(f"Error en submit_access_request: {e}")
            return False, f"Error procesando solicitud: {str(e)}"

    def validate_access_request_data(self, data: dict) -> Tuple[bool, str]:
        """
        Valida los datos de una solicitud de acceso

        Args:
            data: Diccionario con los datos de la solicitud

        Returns:
            Tuple[bool, str]: (válido, mensaje de error si existe)
        """
        required_fields = ["username", "message"]

        for field in required_fields:
            if field not in data or not data[field].strip():
                return False, f"El campo '{field}' es requerido"

        return True, ""

    def is_service_available(self) -> bool:
        """
        Verifica si el servicio está disponible

        Returns:
            bool: True si el servicio está disponible
        """
        return True

    def get_service_status(self) -> dict:
        """
        Obtiene el estado del servicio

        Returns:
            dict: Información del estado del servicio
        """
        return {
            "available": self.is_service_available(),
            "method": "file_based",
        }
