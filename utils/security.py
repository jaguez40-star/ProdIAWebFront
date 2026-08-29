"""
Security utilities and error handling for the SQL chatbot system
Implements security measures to prevent SQL injection and unauthorized access
"""

import re
import logging
import hashlib
import time
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta

from utils.streamlit_stub import st

# Configure logging
logger = logging.getLogger(__name__)

class SecurityConfig:
    """Security configuration constants"""
    
    # SQL injection patterns to detect
    SQL_INJECTION_PATTERNS = [
        r"(?i)((\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|MERGE|SELECT|UPDATE|UNION|USE|BEGIN|COMMIT|ROLLBACK)\b))",
        r"(?i)(\b(AND|OR)\b.{1,6}?(=|<|>|\!=))",
        r"(?i)(\b(HAVING|WHERE)\b\s+(1=1|1=0|true|false))",
        r"(?i)(\/\*|\*\/|--|#)",
        r"(?i)(\bxp_\w+|\bsp_\w+)",
        r"(?i)(\bsysadmin\b|\bsa\b|\bdb_owner\b)",
        r"(?i)(\bSCHEMA\b|\bINFORMATION_SCHEMA\b|\bSYSOBJECTS\b)",
        r"(?i)(\bSHUTDOWN\b|\bKILL\b)"
    ]
    
    # Allowed SQL keywords for read-only operations
    ALLOWED_SQL_KEYWORDS = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER',
        'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL',
        'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'TOP', 'LIMIT',
        'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'CASE', 'WHEN', 'THEN',
        'ELSE', 'END', 'CAST', 'CONVERT', 'SUBSTRING', 'LEN', 'LOWER', 'UPPER',
        'DATEPART', 'YEAR', 'MONTH', 'DAY', 'GETDATE', 'WITH', 'CTE'
    ]
    
    # Rate limiting settings
    MAX_QUERIES_PER_MINUTE = 30
    MAX_QUERIES_PER_HOUR = 200
    MAX_QUERY_LENGTH = 10000
    MAX_RESULT_ROWS = 10000
    
    # Session security
    SESSION_TIMEOUT_MINUTES = 60
    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_DURATION_MINUTES = 15

class QueryValidator:
    """Validates SQL queries for security and compliance"""
    
    def __init__(self):
        self.injection_patterns = [re.compile(pattern) for pattern in SecurityConfig.SQL_INJECTION_PATTERNS]
    
    def validate_query(self, query: str) -> Dict[str, Any]:
        """
        Validate SQL query for security issues
        
        Args:
            query: SQL query string to validate
            
        Returns:
            Dictionary with validation results
        """
        validation_result = {
            'valid': True,
            'issues': [],
            'warnings': [],
            'sanitized_query': query.strip()
        }
        
        try:
            # Basic checks
            if not query or not query.strip():
                validation_result['valid'] = False
                validation_result['issues'].append("Query is empty")
                return validation_result
            
            # Length check
            if len(query) > SecurityConfig.MAX_QUERY_LENGTH:
                validation_result['valid'] = False
                validation_result['issues'].append(f"Query too long (max {SecurityConfig.MAX_QUERY_LENGTH} characters)")
                return validation_result
            
            # SQL injection detection
            injection_detected = self._detect_sql_injection(query)
            if injection_detected:
                validation_result['valid'] = False
                validation_result['issues'].extend(injection_detected)
                return validation_result
            
            # Read-only validation
            readonly_issues = self._validate_readonly(query)
            if readonly_issues:
                validation_result['valid'] = False
                validation_result['issues'].extend(readonly_issues)
                return validation_result
            
            # Structure validation
            structure_warnings = self._validate_structure(query)
            validation_result['warnings'].extend(structure_warnings)
            
            # Add TOP clause if missing
            sanitized = self._add_safety_limits(query)
            validation_result['sanitized_query'] = sanitized
            
            logger.info(f"Query validation passed: {query[:100]}...")
            
        except Exception as e:
            logger.error(f"Error validating query: {str(e)}")
            validation_result['valid'] = False
            validation_result['issues'].append(f"Validation error: {str(e)}")
        
        return validation_result
    
    def _detect_sql_injection(self, query: str) -> List[str]:
        """Detect potential SQL injection patterns"""
        issues = []
        
        for pattern in self.injection_patterns:
            matches = pattern.findall(query)
            if matches:
                issues.append(f"Potential SQL injection pattern detected: {matches[0]}")
        
        # Check for suspicious strings
        suspicious_strings = [
            "1=1", "1=0", "true=true", "false=false",
            "'or'1'='1'", "admin'--", "' or ''=''"
        ]
        
        query_lower = query.lower()
        for suspicious in suspicious_strings:
            if suspicious.lower() in query_lower:
                issues.append(f"Suspicious pattern detected: {suspicious}")
        
        return issues
    
    def _validate_readonly(self, query: str) -> List[str]:
        """Validate that query is read-only"""
        issues = []
        
        query_upper = query.upper().strip()
        
        # Must start with SELECT or WITH (for CTEs)
        if not (query_upper.startswith('SELECT') or query_upper.startswith('WITH')):
            issues.append("Only SELECT and WITH statements are allowed")
        
        # Forbidden keywords for write operations
        forbidden_keywords = [
            'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
            'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE',
            'BULK', 'BACKUP', 'RESTORE', 'SHUTDOWN', 'KILL'
        ]
        
        for keyword in forbidden_keywords:
            if re.search(rf'\b{keyword}\b', query_upper):
                issues.append(f"Forbidden keyword detected: {keyword}")
        
        # Check for system functions and procedures
        system_patterns = [
            r'\bxp_\w+', r'\bsp_\w+', r'\bms_\w+',
            r'\bOPENROWSET\b', r'\bOPENQUERY\b', r'\bOPENDATASOURCE\b'
        ]
        
        for pattern in system_patterns:
            if re.search(pattern, query_upper):
                issues.append(f"System function/procedure not allowed: {pattern}")
        
        return issues
    
    def _validate_structure(self, query: str) -> List[str]:
        """Validate query structure and suggest improvements"""
        warnings = []
        
        query_upper = query.upper()
        
        # Check for TOP or LIMIT clause
        if 'TOP ' not in query_upper and 'LIMIT ' not in query_upper:
            warnings.append("Query should include TOP or LIMIT clause for performance")
        
        # Check for SELECT *
        if 'SELECT *' in query_upper:
            warnings.append("Consider selecting specific columns instead of SELECT *")
        
        # Check for missing WHERE clause in large table queries
        if 'WHERE' not in query_upper and 'JOIN' not in query_upper:
            warnings.append("Consider adding WHERE clause to filter results")
        
        return warnings
    
    def _add_safety_limits(self, query: str) -> str:
        """Add safety limits to query if not present"""
        query_upper = query.upper().strip()
        
        # If no TOP or LIMIT, add TOP clause
        if 'TOP ' not in query_upper and 'LIMIT ' not in query_upper:
            if query_upper.startswith('SELECT'):
                # Find position after SELECT
                select_pos = query_upper.find('SELECT')
                select_end = select_pos + 6  # Length of 'SELECT'
                
                # Insert TOP clause
                before = query[:select_end]
                after = query[select_end:]
                
                return f"{before} TOP {SecurityConfig.MAX_RESULT_ROWS}{after}"
        
        return query

class RateLimiter:
    """Rate limiting for API requests and queries"""
    
    def __init__(self):
        self.requests = {}  # user_id -> list of timestamps
    
    def check_rate_limit(self, user_id: str) -> Dict[str, Any]:
        """
        Check if user has exceeded rate limits
        
        Args:
            user_id: Unique identifier for the user
            
        Returns:
            Dictionary with rate limit status
        """
        now = datetime.now()
        
        # Initialize user if not exists
        if user_id not in self.requests:
            self.requests[user_id] = []
        
        user_requests = self.requests[user_id]
        
        # Remove old requests (older than 1 hour)
        cutoff_time = now - timedelta(hours=1)
        user_requests[:] = [req_time for req_time in user_requests if req_time > cutoff_time]
        
        # Check limits
        minute_ago = now - timedelta(minutes=1)
        hour_ago = now - timedelta(hours=1)
        
        requests_last_minute = len([req for req in user_requests if req > minute_ago])
        requests_last_hour = len([req for req in user_requests if req > hour_ago])
        
        # Check if limits exceeded
        if requests_last_minute >= SecurityConfig.MAX_QUERIES_PER_MINUTE:
            return {
                'allowed': False,
                'reason': 'Rate limit exceeded: too many queries per minute',
                'retry_after': 60,
                'requests_remaining': 0
            }
        
        if requests_last_hour >= SecurityConfig.MAX_QUERIES_PER_HOUR:
            return {
                'allowed': False,
                'reason': 'Rate limit exceeded: too many queries per hour',
                'retry_after': 3600,
                'requests_remaining': 0
            }
        
        # Add current request
        user_requests.append(now)
        
        return {
            'allowed': True,
            'requests_remaining_minute': SecurityConfig.MAX_QUERIES_PER_MINUTE - requests_last_minute - 1,
            'requests_remaining_hour': SecurityConfig.MAX_QUERIES_PER_HOUR - requests_last_hour - 1
        }

class SessionManager:
    """Manages user sessions and security"""
    
    def __init__(self):
        self.failed_attempts = {}  # user_id -> count
        self.lockout_times = {}    # user_id -> lockout_until
    
    def get_user_id(self) -> str:
        """Get or create user ID for current session"""
        if 'user_id' not in st.session_state:
            # Generate user ID based on session info
            session_info = f"{st._get_session_id()}_{time.time()}"
            st.session_state.user_id = hashlib.md5(session_info.encode()).hexdigest()
        
        return st.session_state.user_id
    
    def check_session_security(self, user_id: str) -> Dict[str, Any]:
        """Check session security status"""
        now = datetime.now()
        
        # Check if user is locked out
        if user_id in self.lockout_times:
            lockout_until = self.lockout_times[user_id]
            if now < lockout_until:
                remaining_minutes = (lockout_until - now).total_seconds() / 60
                return {
                    'allowed': False,
                    'reason': f'Account locked due to too many failed attempts',
                    'lockout_remaining_minutes': int(remaining_minutes)
                }
            else:
                # Lockout expired, reset
                del self.lockout_times[user_id]
                if user_id in self.failed_attempts:
                    del self.failed_attempts[user_id]
        
        return {'allowed': True}
    
    def record_failed_attempt(self, user_id: str):
        """Record a failed attempt for user"""
        if user_id not in self.failed_attempts:
            self.failed_attempts[user_id] = 0
        
        self.failed_attempts[user_id] += 1
        
        # Check if lockout threshold reached
        if self.failed_attempts[user_id] >= SecurityConfig.MAX_FAILED_ATTEMPTS:
            lockout_until = datetime.now() + timedelta(minutes=SecurityConfig.LOCKOUT_DURATION_MINUTES)
            self.lockout_times[user_id] = lockout_until
            logger.warning(f"User {user_id} locked out until {lockout_until}")
    
    def record_successful_attempt(self, user_id: str):
        """Record a successful attempt, reset failed count"""
        if user_id in self.failed_attempts:
            del self.failed_attempts[user_id]

class ErrorHandler:
    """Centralized error handling for the application"""
    
    @staticmethod
    def handle_database_error(error: Exception) -> Dict[str, Any]:
        """Handle database-related errors"""
        error_str = str(error)
        
        # Common database errors
        if "Login failed" in error_str or "authentication" in error_str.lower():
            return {
                'user_message': "Error de autenticación: Verifica las credenciales de la base de datos",
                'log_message': f"Database authentication error: {error_str}",
                'error_type': 'authentication'
            }
        
        elif "timeout" in error_str.lower() or "connection" in error_str.lower():
            return {
                'user_message': "Error de conexión: No se puede conectar a la base de datos",
                'log_message': f"Database connection error: {error_str}",
                'error_type': 'connection'
            }
        
        elif "permission" in error_str.lower() or "access" in error_str.lower():
            return {
                'user_message': "Error de permisos: Sin acceso a la tabla o base de datos",
                'log_message': f"Database permission error: {error_str}",
                'error_type': 'permission'
            }
        
        else:
            return {
                'user_message': "Error de base de datos: Consulta el registro para más detalles",
                'log_message': f"Database error: {error_str}",
                'error_type': 'general'
            }
    
    @staticmethod
    def handle_llm_error(error: Exception) -> Dict[str, Any]:
        """Handle LLM-related errors"""
        error_str = str(error)
        
        if "connection" in error_str.lower() or "timeout" in error_str.lower():
            return {
                'user_message': "Error de IA: No se puede conectar al modelo Ollama",
                'log_message': f"LLM connection error: {error_str}",
                'error_type': 'llm_connection'
            }
        
        elif "model" in error_str.lower() or "not found" in error_str.lower():
            return {
                'user_message': "Error de IA: Modelo no encontrado o no configurado",
                'log_message': f"LLM model error: {error_str}",
                'error_type': 'llm_model'
            }
        
        else:
            return {
                'user_message': "Error de IA: Problema al procesar la consulta",
                'log_message': f"LLM error: {error_str}",
                'error_type': 'llm_general'
            }
    
    @staticmethod
    def handle_validation_error(error: Exception) -> Dict[str, Any]:
        """Handle validation errors"""
        return {
            'user_message': f"Error de validación: {str(error)}",
            'log_message': f"Validation error: {str(error)}",
            'error_type': 'validation'
        }

# Global instances
query_validator = QueryValidator()
rate_limiter = RateLimiter()
session_manager = SessionManager()

def validate_sql_query(query: str) -> Dict[str, Any]:
    """Validate SQL query for security - main entry point"""
    return query_validator.validate_query(query)

def check_user_rate_limit() -> Dict[str, Any]:
    """Check rate limit for current user"""
    user_id = session_manager.get_user_id()
    return rate_limiter.check_rate_limit(user_id)

def check_session_security() -> Dict[str, Any]:
    """Check session security for current user"""
    user_id = session_manager.get_user_id()
    return session_manager.check_session_security(user_id)

def record_query_attempt(success: bool):
    """Record query attempt result"""
    user_id = session_manager.get_user_id()
    
    if success:
        session_manager.record_successful_attempt(user_id)
    else:
        session_manager.record_failed_attempt(user_id)

def render_security_status():
    """Render security status in Streamlit"""
    st.markdown("### 🛡️ Estado de Seguridad")
    
    # Current user info
    user_id = session_manager.get_user_id()
    st.info(f"ID de Usuario: {user_id[:8]}...")
    
    # Rate limit status
    rate_status = check_user_rate_limit()
    if rate_status['allowed']:
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Consultas restantes (minuto)", rate_status.get('requests_remaining_minute', 0))
        with col2:
            st.metric("Consultas restantes (hora)", rate_status.get('requests_remaining_hour', 0))
    else:
        st.error(f"🚫 {rate_status['reason']}")
    
    # Session security status
    session_status = check_session_security()
    if session_status['allowed']:
        st.success("✅ Sesión activa y segura")
    else:
        st.error(f"🔒 {session_status['reason']}")
        if 'lockout_remaining_minutes' in session_status:
            st.warning(f"⏰ Tiempo restante: {session_status['lockout_remaining_minutes']} minutos")

# Export main functions
__all__ = [
    'SecurityConfig',
    'QueryValidator',
    'RateLimiter', 
    'SessionManager',
    'ErrorHandler',
    'validate_sql_query',
    'check_user_rate_limit',
    'check_session_security',
    'record_query_attempt',
    'render_security_status'
]