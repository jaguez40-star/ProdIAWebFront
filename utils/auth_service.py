import logging
import os
from datetime import datetime
from typing import Dict, Optional, Set, Tuple

import dns.resolver
from ldap3 import Connection, Server


class AuthService:
    """
    Servicio de autenticación LDAP basado en Active Directory de Ecopetrol
    """

    def __init__(self):
        self.logger = logging.getLogger("AuthService")
        self.logger.setLevel(logging.INFO)

        # Logger específico para eventos de autenticación
        self.auth_logger = logging.getLogger("auth")

        self.AD_DOMAIN = "red.ecopetrol.com.co"

        # Control de filtro de correos autorizados
        self.EMAIL_FILTER_ENABLED: bool = (
            True  # Cambiar a False para deshabilitar el filtro
        )

        # Ruta al archivo de correos autorizados - AJUSTADA PARA LA NUEVA ESTRUCTURA
        self.AUTHORIZED_EMAILS_FILE = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "data",
            "extra_files",
            "authorized_emails.txt",
        )

        # Cache de correos autorizados
        self._authorized_emails: Optional[Set[str]] = None

    def _resolve_ldap_server(self) -> str:
        """
        Resuelve el servidor LDAP usando DNS SRV records

        Returns:
            str: URL del servidor LDAP

        Raises:
            Exception: Si no se puede resolver el servidor LDAP
        """
        try:
            # Resolver registros SRV para LDAP sobre TCP (igual que el código de referencia)
            srv_records = dns.resolver.resolve(f"_ldap._tcp.{self.AD_DOMAIN}", "SRV")

            # Obtener el nameserver del resultado DNS (igual que el código de referencia)
            nameserver = srv_records.nameserver

            # Construir URL del servidor LDAP usando LDAPS (igual que el código de referencia)
            ldap_server_url = "ldaps://" + nameserver

            self.logger.info(f"Servidor LDAP resuelto: {ldap_server_url}")
            return ldap_server_url

        except dns.resolver.NXDOMAIN:
            self.logger.error(f"Dominio no encontrado: _ldap._tcp.{self.AD_DOMAIN}")
            raise Exception(f"No se pudo resolver el dominio LDAP: {self.AD_DOMAIN}")
        except dns.resolver.NoAnswer:
            self.logger.error(f"No hay registros SRV para: _ldap._tcp.{self.AD_DOMAIN}")
            raise Exception("No se encontraron registros SRV para el servidor LDAP")
        except Exception as e:
            self.logger.error(f"Error resolviendo servidor LDAP: {str(e)}")
            raise Exception(f"Error de resolución DNS: {str(e)}")

    def _load_authorized_emails(self) -> Set[str]:
        """
        Carga la lista de correos electrónicos autorizados desde el archivo

        Returns:
            Set[str]: Conjunto de correos autorizados
        """
        authorized_emails = set()

        try:
            if os.path.exists(self.AUTHORIZED_EMAILS_FILE):
                with open(self.AUTHORIZED_EMAILS_FILE, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        # Ignorar líneas vacías y comentarios
                        if line and not line.startswith("#"):
                            authorized_emails.add(line.lower())

                self.logger.info(
                    f"Cargados {len(authorized_emails)} correos autorizados"
                )
            else:
                self.logger.warning(
                    f"Archivo de correos autorizados no encontrado: {self.AUTHORIZED_EMAILS_FILE}"
                )

        except Exception as e:
            self.logger.error(f"Error cargando correos autorizados: {str(e)}")

        return authorized_emails

    def get_authorized_emails(self) -> Set[str]:
        """
        Obtiene el conjunto de correos autorizados (con cache)

        Returns:
            Set[str]: Conjunto de correos autorizados
        """
        if self._authorized_emails is None:
            self._authorized_emails = self._load_authorized_emails()

        return self._authorized_emails

    def reload_authorized_emails(self) -> Set[str]:
        """
        Recarga la lista de correos autorizados desde el archivo

        Returns:
            Set[str]: Conjunto de correos autorizados actualizado
        """
        self._authorized_emails = self._load_authorized_emails()
        return self._authorized_emails

    def is_email_authorized(self, email: str) -> bool:
        """
        Verifica si un correo electrónico está autorizado

        Args:
            email: Correo electrónico a verificar

        Returns:
            bool: True si está autorizado o el filtro está deshabilitado
        """
        if not self.EMAIL_FILTER_ENABLED:
            return True

        if not email:
            return False

        authorized_emails = self.get_authorized_emails()
        return email.lower() in authorized_emails

    def get_user_email(self, username: str) -> str:
        """
        Genera el correo electrónico del usuario basado en el username

        Args:
            username: Nombre de usuario

        Returns:
            str: Correo electrónico del usuario
        """
        # Asumir que el formato es username@ecopetrol.com.co
        if "@" not in username:
            return f"{username}@ecopetrol.com.co"
        return username

    def authenticate_user(
        self, username: str, password: str
    ) -> Tuple[bool, str, Optional[Dict]]:
        """
        Autentica un usuario contra el Active Directory de Ecopetrol

        Args:
            username: Usuario ECP
            password: Contraseña del usuario

        Returns:
            Tuple[bool, str, Optional[Dict]]: (éxito, mensaje, información_usuario)
        """
        if not username or not password:
            return False, "Usuario y contraseña son requeridos", None

        try:
            # Verificar si el correo está autorizado (si el filtro está habilitado)
            user_email = self.get_user_email(username)
            if not self.is_email_authorized(user_email):
                error_msg = (
                    "Acceso no autorizado. Contacte al administrador del sistema."
                )
                # Log de acceso denegado por filtro de correos
                self.auth_logger.warning(
                    f"ACCESO DENEGADO - Email: {user_email} no autorizado | "
                    f"Filtro activo: {self.EMAIL_FILTER_ENABLED}"
                )

                self.logger.warning(
                    f"🚫 ACCESO DENEGADO - Email: {user_email} no autorizado "
                    f"- Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                )
                return False, error_msg, None

            # Resolver el servidor LDAP usando DNS SRV (CORREGIDO)
            try:
                LDAP_SERVER = self._resolve_ldap_server()
            except Exception as dns_error:
                error_msg = f"Error resolviendo servidor LDAP: {str(dns_error)}"
                self.logger.error(error_msg)
                return (
                    False,
                    "Error de configuración del servidor. Contacte al administrador.",
                    None,
                )

            self.logger.info(f"Servidor LDAP: {LDAP_SERVER}")

            # Crear servidor LDAP con configuraciones adicionales para robustez
            try:
                server = Server(
                    LDAP_SERVER,
                    use_ssl=True if LDAP_SERVER.startswith("ldaps://") else False,
                    get_info="ALL",  # Obtener información del servidor
                    connect_timeout=10,  # Timeout de conexión
                )
            except Exception as server_error:
                error_msg = f"Error creando servidor LDAP: {str(server_error)}"
                self.logger.error(error_msg)
                return False, "Error de configuración del servidor", None

            try:
                # Crear conexión con timeout
                conn = Connection(
                    server,
                    user=username,
                    password=password,
                    auto_bind=False,  # No auto-bind para manejo manual
                    receive_timeout=10,
                )
            except Exception as conn_error:
                error_msg = "No fue posible Validar credenciales. Por favor verifique su conexión de Red ECP"
                self.logger.warning(
                    f"Error de conexión para usuario {username}: {str(conn_error)}"
                )
                return False, error_msg, None

            # Intentar autenticar
            try:
                if conn.bind():
                    self.logger.info(f"Usuario {username} autenticado exitosamente")

                    # Información básica del usuario autenticado
                    user_info = {
                        "username": username,
                        "domain": self.AD_DOMAIN,
                        "email": user_email,
                        "authenticated_at": datetime.now().isoformat(),
                        "ldap_server": LDAP_SERVER,
                    }

                    # Cerrar conexión
                    conn.unbind()

                    return True, "Usuario autenticado", user_info
                else:
                    error_msg = f"Credenciales incorrectas: {conn.last_error if conn.last_error else 'Usuario o contraseña inválidos'}"
                    self.logger.warning(
                        f"Autenticación fallida para usuario {username}: {error_msg}"
                    )
                    return False, "Usuario o contraseña incorrectos", None
            except Exception as auth_error:
                error_msg = f"Error durante autenticación: {str(auth_error)}"
                self.logger.error(
                    f"Error de autenticación para usuario {username}: {error_msg}"
                )
                return False, "Error de autenticación", None

        except Exception as e:
            error_msg = f"Error de protocolo LDAP: {str(e)}"
            self.logger.error(f"Error LDAP para usuario {username}: {error_msg}")
            return False, "Error interno del servidor de autenticación", None

    def validate_user_format(self, username: str) -> Tuple[bool, str]:
        """
        Valida el formato del nombre de usuario

        Args:
            username: Usuario a validar

        Returns:
            Tuple[bool, str]: (es_válido, mensaje)
        """
        if not username:
            return False, "El nombre de usuario es requerido"

        # Remover espacios en blanco
        username = username.strip()

        # Validaciones básicas de formato
        if len(username) < 3:
            return False, "El nombre de usuario debe tener al menos 3 caracteres"

        if len(username) > 50:
            return False, "El nombre de usuario no puede exceder 50 caracteres"

        # Aquí podrías agregar más validaciones específicas del formato ECP
        # Por ejemplo, si tienen un formato específico como ECP123456

        return True, "Formato válido"

    def test_ldap_connection(self) -> Tuple[bool, str]:
        """
        Prueba la conectividad con el servidor LDAP sin autenticar

        Returns:
            Tuple[bool, str]: (conectividad_exitosa, mensaje)
        """
        try:
            ldap_server_url = self._resolve_ldap_server()
            server = Server(ldap_server_url, get_info="ALL", connect_timeout=5)

            # Crear conexión anónima para probar conectividad
            conn = Connection(server, auto_bind=True)

            if conn.bound:
                conn.unbind()
                return True, f"Conectividad exitosa con {ldap_server_url}"
            else:
                return False, "No se pudo establecer conexión con el servidor LDAP"

        except Exception as e:
            return False, f"Error de conectividad: {str(e)}"

    def test_dns_connection(self) -> bool:
        """
        Prueba solo la resolución DNS sin intentar conectar a LDAP

        Returns:
            bool: True si puede resolver DNS, False en caso contrario
        """
        try:
            # Intentar resolver el registro SRV para LDAP
            srv_records = dns.resolver.resolve(f"_ldap._tcp.{self.AD_DOMAIN}", "SRV")

            # Si llegamos aquí, la resolución DNS fue exitosa
            self.logger.info(f"Resolución DNS exitosa para {self.AD_DOMAIN}")
            return True

        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, Exception) as e:
            self.logger.warning(f"Fallo en resolución DNS: {str(e)}")
            return False
