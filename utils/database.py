"""
Database connection and management module for SQL Server
Based on best practices for enterprise SQL Server connections
"""

import logging
import os
import time
from typing import Dict, List, Optional, Any
import pandas as pd

from utils.streamlit_stub import st
from dotenv import load_dotenv
from sqlalchemy import (
    create_engine,
    text,
    MetaData,
    Table,
    inspect,
    Engine,
)
from sqlalchemy.exc import (
    SQLAlchemyError,
    InterfaceError,
    OperationalError,
    DatabaseError,
    TimeoutError,
)
from sqlalchemy.pool import QueuePool


load_dotenv()

# Configurar logging
logger = logging.getLogger(__name__)


class DatabaseConfig:
    """Configuration class for database connections"""

    # Connection settings
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "1433")
    DB_NAME = os.getenv("DB_NAME", "")
    DB_USER = os.getenv("DB_USER", "")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")

    # Connection pool settings
    POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
    MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "5"))
    POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))  # 30 minutes

    # Query settings
    QUERY_TIMEOUT = int(os.getenv("DB_QUERY_TIMEOUT", "60"))  # 60 seconds
    MAX_ROWS = int(os.getenv("DB_MAX_ROWS", "5000"))  # Limit for safety

    # Connection string template
    CONNECTION_STRING_TEMPLATE = (
        "mssql+pyodbc://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        "?driver=ODBC+Driver+18+for+SQL+Server"
        "&TrustServerCertificate=yes"
        "&packet_size=32768"
        "&application_intent=ReadOnly"
        "&connect_timeout=10"
    )


class DatabaseManager:
    """Multi-database manager for SQL Server (DataGenesis) and SQLite (ECP_PROD, ROBUSTEZ) connections"""

    _instance = None
    _engines: Dict[str, Optional[Engine]] = {}
    _metadata: Dict[str, Optional[MetaData]] = {}
    _tables_cache: Dict[str, Dict[str, Table]] = {}
    _last_health_check: float = 0
    _health_check_interval: float = 300  # 5 minutes

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatabaseManager, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize database manager"""
        if not hasattr(self, "_initialized"):
            self._initialized = True
            self.config = DatabaseConfig()
            self._connection_errors = 0
            self._max_connection_errors = 3
            
            # Initialize databases
            self._engines = {"datagenesis": None, "ecp_prod": None, "robustez": None}
            self._metadata = {"datagenesis": None, "ecp_prod": None, "robustez": None}
            self._tables_cache = {"datagenesis": {}, "ecp_prod": {}, "robustez": {}}

    def get_connection_string(self) -> str:
        """Generate connection string from configuration"""
        if not all(
            [
                self.config.DB_HOST,
                self.config.DB_NAME,
                self.config.DB_USER,
                self.config.DB_PASSWORD,
            ]
        ):
            raise ValueError("Database credentials not properly configured")

        return self.config.CONNECTION_STRING_TEMPLATE.format(
            DB_HOST=self.config.DB_HOST,
            DB_PORT=self.config.DB_PORT,
            DB_NAME=self.config.DB_NAME,
            DB_USER=self.config.DB_USER,
            DB_PASSWORD=self.config.DB_PASSWORD,
        )

    def create_engine(self) -> Engine:
        """Create SQLAlchemy engine with optimized settings"""
        connection_string = self.get_connection_string()

        engine = create_engine(
            connection_string,
            poolclass=QueuePool,
            pool_size=self.config.POOL_SIZE,
            max_overflow=self.config.MAX_OVERFLOW,
            pool_timeout=self.config.POOL_TIMEOUT,
            pool_recycle=self.config.POOL_RECYCLE,
            pool_pre_ping=True,  # Validate connections before use
            echo=False,  # Set to True for debugging
            connect_args={
                "timeout": self.config.QUERY_TIMEOUT,
                "autocommit": True,
            },
        )

        return engine

    def get_engine(self, database: str = "datagenesis") -> Engine:
        """Get or create database engine for specified database"""
        if database not in self._engines:
            raise ValueError(f"Unsupported database: {database}")
            
        if self._engines[database] is None:
            try:
                if database == "datagenesis":
                    self._engines[database] = self.create_engine()
                elif database == "ecp_prod":
                    self._engines[database] = self.create_sqlite_engine()
                elif database == "robustez":
                    self._engines[database] = self.create_sqlite_engine("ROBUSTEZ.db")
                else:
                    raise ValueError(f"Unknown database: {database}")
                    
                logger.info(f"Database engine created successfully for {database}")
                self._connection_errors = 0
            except Exception as e:
                self._connection_errors += 1
                logger.error(f"Failed to create database engine for {database}: {str(e)}")
                raise

        return self._engines[database]
    
    def create_sqlite_engine(self, db_filename: str = "ECP_PROD.db") -> Engine:
        """Create SQLite engine for a local database file in data/"""
        sqlite_path = os.path.join(os.path.dirname(__file__), "..", "data", db_filename)
        sqlite_url = f"sqlite:///{sqlite_path}"

        logger.info(f"Creating SQLite engine for: {sqlite_url}")

        engine = create_engine(
            sqlite_url,
            pool_pre_ping=True,
            pool_recycle=self.config.POOL_RECYCLE,
            echo=False  # Set to True for SQL logging
        )

        return engine

    def test_connection(self, database: str = "datagenesis") -> bool:
        """Test database connection health"""
        try:
            engine = self.get_engine(database)
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1 as test"))
                result.fetchone()

            self._last_health_check = time.time()
            logger.info(f"Database connection test successful for {database}")
            return True

        except Exception as e:
            logger.error(f"Database connection test failed for {database}: {str(e)}")
            return False

    def should_check_health(self) -> bool:
        """Check if health check is needed"""
        return (time.time() - self._last_health_check) > self._health_check_interval

    def get_tables_info(self, database: str = "datagenesis") -> Dict[str, Dict]:
        """Get information about all tables in the specified database"""
        try:
            engine = self.get_engine(database)
            inspector = inspect(engine)

            tables_info = {}
            table_names = inspector.get_table_names()

            for table_name in table_names:
                columns = inspector.get_columns(table_name)
                tables_info[table_name] = {
                    "columns": [
                        {
                            "name": col["name"],
                            "type": str(col["type"]),
                            "nullable": col["nullable"],
                            "default": col.get("default"),
                            "primary_key": col.get("primary_key", False),
                        }
                        for col in columns
                    ],
                    "row_count": self._get_table_row_count(table_name),
                }

            return tables_info

        except Exception as e:
            logger.error(f"Failed to get tables info: {str(e)}")
            return {}

    def _get_table_row_count(self, table_name: str) -> Optional[int]:
        """Get approximate row count for a table"""
        try:
            query = f"SELECT COUNT(*) as row_count FROM {table_name}"
            result = self.execute_query(query)
            if not result["data"].empty:
                return result["data"].iloc[0]["row_count"]
        except:
            pass
        return None

    def get_table_schema(self, table_name: str, database: str = "datagenesis") -> str:
        """Generate CREATE TABLE statement for a given table"""
        try:
            engine = self.get_engine(database)
            inspector = inspect(engine)
            columns = inspector.get_columns(table_name)

            schema_lines = [f"CREATE TABLE {table_name} ("]
            column_defs = []

            for col in columns:
                col_def = f"    {col['name']} {col['type']}"
                if not col["nullable"]:
                    col_def += " NOT NULL"
                if col.get("default"):
                    col_def += f" DEFAULT {col['default']}"
                column_defs.append(col_def)

            schema_lines.append(",\n".join(column_defs))
            schema_lines.append(");")

            return "\n".join(schema_lines)

        except Exception as e:
            logger.error(f"Failed to get schema for table {table_name}: {str(e)}")
            return f"-- Error getting schema for {table_name}: {str(e)}"

    def execute_query(
        self, query: str, params: Optional[Dict] = None, database: str = "datagenesis"
    ) -> Dict[str, Any]:
        """
        Execute a read-only SQL query and return results

        Args:
            query: SQL query string
            params: Query parameters (optional)
            database: Target database (datagenesis or ecp_prod)

        Returns:
            Dictionary with 'data' (DataFrame), 'columns', 'rows_affected', 'execution_time'
        """
        start_time = time.time()

        try:
            # Health check if needed (skip for SQLite)
            if database == "datagenesis" and self.should_check_health():
                self.test_connection(database)

            # Validate query is read-only
            if not self._is_read_only_query(query):
                raise ValueError("Only SELECT queries are allowed")

            # Skip automatic row limit injection to avoid syntax errors
            # limited_query = self._add_row_limit(query)
            limited_query = query

            engine = self.get_engine(database)

            with engine.connect() as conn:
                # Execute query
                result = conn.execute(text(limited_query), params or {})

                # Fetch data
                data = result.fetchall()
                columns = list(result.keys())

                # Convert to DataFrame
                df = pd.DataFrame(data, columns=columns)

                execution_time = time.time() - start_time

                logger.info(
                    f"Query executed successfully. Rows: {len(df)}, Time: {execution_time:.2f}s"
                )

                return {
                    "data": df,
                    "columns": columns,
                    "rows_affected": len(df),
                    "execution_time": execution_time,
                    "query": limited_query,
                    "success": True,
                    "error": None,
                }

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = str(e)

            logger.error(f"Query execution failed: {error_msg}")

            return {
                "data": pd.DataFrame(),
                "columns": [],
                "rows_affected": 0,
                "execution_time": execution_time,
                "query": query,
                "success": False,
                "error": error_msg,
            }

    def _is_read_only_query(self, query: str) -> bool:
        """Check if query is read-only (SELECT only)"""
        query_upper = query.strip().upper()

        # Allow SELECT, WITH (CTE), and EXPLAIN
        allowed_starts = ["SELECT", "WITH", "EXPLAIN"]

        # Forbidden keywords
        forbidden_keywords = [
            "INSERT",
            "UPDATE",
            "DELETE",
            "DROP",
            "CREATE",
            "ALTER",
            "TRUNCATE",
            "GRANT",
            "REVOKE",
            "EXEC",
            "EXECUTE",
        ]

        # Check if starts with allowed keyword
        if not any(query_upper.startswith(keyword) for keyword in allowed_starts):
            return False

        # Check for forbidden keywords
        if any(keyword in query_upper for keyword in forbidden_keywords):
            return False

        return True

    def _add_row_limit(self, query: str) -> str:
        """Add TOP clause to limit rows if not present"""
        query_upper = query.strip().upper()

        # If already has TOP or LIMIT, return as is
        if "TOP " in query_upper or "LIMIT " in query_upper:
            return query

        # Add TOP clause for SELECT statements
        if query_upper.startswith("SELECT"):
            # Find the position after SELECT
            select_pos = query_upper.find("SELECT")
            if select_pos != -1:
                select_end = select_pos + 6  # Length of 'SELECT'
                # Insert TOP clause
                before = query[:select_end]
                after = query[select_end:]
                return f"{before} TOP {self.config.MAX_ROWS} {after}"

        return query

    def get_sample_data(self, table_name: str, limit: int = 100) -> pd.DataFrame:
        """Get sample data from a table"""
        query = f"SELECT TOP {limit} * FROM {table_name}"
        result = self.execute_query(query)
        return result["data"]

    def search_tables(self, search_term: str) -> List[str]:
        """Search for tables by name pattern"""
        try:
            engine = self.get_engine()
            inspector = inspect(engine)
            all_tables = inspector.get_table_names()

            # Case-insensitive search
            search_term_lower = search_term.lower()
            matching_tables = [
                table for table in all_tables if search_term_lower in table.lower()
            ]

            return matching_tables

        except Exception as e:
            logger.error(f"Failed to search tables: {str(e)}")
            return []

    def close_connections(self):
        """Close all database connections"""
        for database, engine in self._engines.items():
            if engine:
                engine.dispose()
                self._engines[database] = None
            logger.info("Database connections closed")


# Global instance
db_manager = DatabaseManager()


# Convenience functions for Streamlit integration
def initialize_database() -> bool:
    """Initialize database connection for Streamlit app"""
    try:
        # Check if credentials are configured
        if not all(
            [
                DatabaseConfig.DB_HOST,
                DatabaseConfig.DB_NAME,
                DatabaseConfig.DB_USER,
                DatabaseConfig.DB_PASSWORD,
            ]
        ):
            st.error("❌ Credenciales de base de datos no configuradas")
            st.info(
                "Configura las variables de entorno: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD"
            )
            return False

        # Test connection
        if db_manager.test_connection():
            st.success("✅ Conexión a base de datos establecida")
            return True
        else:
            st.error("❌ Error al conectar con la base de datos")
            return False

    except Exception as e:
        st.error(f"❌ Error de configuración: {str(e)}")
        return False


def execute_sql_query(query: str, params: Optional[Dict] = None, database: str = "datagenesis") -> Dict[str, Any]:
    """Execute SQL query - wrapper for Streamlit"""
    return db_manager.execute_query(query, params, database)


def get_database_info() -> Dict[str, Any]:
    """Get database information for display"""
    try:
        tables_info = db_manager.get_tables_info()

        return {
            "connected": db_manager.test_connection(),
            "total_tables": len(tables_info),
            "tables": tables_info,
            "connection_config": {
                "host": DatabaseConfig.DB_HOST,
                "database": DatabaseConfig.DB_NAME,
                "max_rows": DatabaseConfig.MAX_ROWS,
                "query_timeout": DatabaseConfig.QUERY_TIMEOUT,
            },
        }
    except Exception as e:
        logger.error(f"Failed to get database info: {str(e)}")
        return {"connected": False, "error": str(e)}


# Context manager for database operations
class DatabaseSession:
    """Context manager for database sessions"""

    def __init__(self, database: str = "datagenesis"):
        self.database = database
        self.engine = None
        self.connection = None

    def __enter__(self):
        self.engine = db_manager.get_engine(self.database)
        self.connection = self.engine.connect()
        return self.connection

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.connection:
            self.connection.close()


# Export main functions
__all__ = [
    "DatabaseManager",
    "DatabaseConfig",
    "db_manager",
    "initialize_database",
    "execute_sql_query",
    "get_database_info",
    "DatabaseSession",
]
