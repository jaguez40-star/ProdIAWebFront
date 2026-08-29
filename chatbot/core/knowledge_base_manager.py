"""
Knowledge Base Manager - Single Source of Truth
Manages all database schemas, query examples, and domain knowledge
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
import yaml
from functools import lru_cache

logger = logging.getLogger(__name__)


class KnowledgeBaseManager:
    """
    Centralized manager for all knowledge base content.
    This is the ONLY component that reads from knowledge_base/ directory.

    All other components (vector_manager, configurable_agent, etc.) must use
    this manager to access schemas, examples, and domain knowledge.
    """

    KNOWLEDGE_BASE_ROOT = Path("knowledge_base")

    def __init__(self):
        """Initialize knowledge base manager"""
        self.databases_path = self.KNOWLEDGE_BASE_ROOT / "databases"
        self.domain_path = self.KNOWLEDGE_BASE_ROOT / "domain"

        # Validate structure exists
        if not self.KNOWLEDGE_BASE_ROOT.exists():
            logger.warning(f"Knowledge base not found: {self.KNOWLEDGE_BASE_ROOT}")
            logger.warning("Knowledge base will be created on first use")

        logger.info(f"✅ KnowledgeBaseManager initialized from {self.KNOWLEDGE_BASE_ROOT}")

    @lru_cache(maxsize=10)
    def get_database_schema(self, database: str) -> Dict[str, Any]:
        """
        Get complete schema for a database.

        Args:
            database: Database name ('datagenesis' or 'ecp_prod')

        Returns:
            Dict with complete schema information
        """
        schema_path = self.databases_path / database / "schema.yaml"

        if not schema_path.exists():
            logger.error(f"Schema not found for database: {database} at {schema_path}")
            return {}

        try:
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = yaml.safe_load(f)

            logger.info(f"📋 Loaded schema for {database}: {len(schema.get('tables', {}))} tables")
            return schema
        except Exception as e:
            logger.error(f"Error loading schema for {database}: {e}")
            return {}

    @lru_cache(maxsize=10)
    def get_query_examples(self, database: str) -> List[Dict[str, Any]]:
        """
        Get SQL query examples for a database.

        Args:
            database: Database name ('datagenesis' or 'ecp_prod')

        Returns:
            List of query example dictionaries
        """
        examples_path = self.databases_path / database / "query_examples.yaml"

        if not examples_path.exists():
            logger.error(f"Query examples not found for database: {database} at {examples_path}")
            return []

        try:
            with open(examples_path, 'r', encoding='utf-8') as f:
                examples_data = yaml.safe_load(f)

            examples = examples_data.get('query_examples', [])
            logger.info(f"📝 Loaded {len(examples)} query examples for {database}")
            return examples
        except Exception as e:
            logger.error(f"Error loading query examples for {database}: {e}")
            return []

    @lru_cache(maxsize=1)
    def get_petroleum_glossary(self) -> Dict[str, Any]:
        """
        Get petroleum domain glossary.

        Returns:
            Dict with complete petroleum glossary
        """
        glossary_path = self.domain_path / "petroleum_glossary.yaml"

        if not glossary_path.exists():
            logger.error(f"Petroleum glossary not found at {glossary_path}")
            return {}

        try:
            with open(glossary_path, 'r', encoding='utf-8') as f:
                glossary = yaml.safe_load(f)

            logger.info(f"📚 Loaded petroleum glossary: {len(glossary.get('petroleum_glossary', {}))} categories")
            return glossary
        except Exception as e:
            logger.error(f"Error loading petroleum glossary: {e}")
            return {}

    def search_query_examples(
        self,
        database: str,
        keywords: List[str] = None,
        complexity: str = None
    ) -> List[Dict[str, Any]]:
        """
        Search query examples by keywords and complexity.

        Args:
            database: Database name
            keywords: List of keywords to match
            complexity: Complexity level ('simple', 'medium', 'advanced')

        Returns:
            Filtered list of matching examples
        """
        examples = self.get_query_examples(database)

        if not keywords and not complexity:
            return examples

        filtered = []
        for example in examples:
            # Check keywords match
            if keywords:
                example_keywords = example.get('keywords', [])
                if not any(kw.lower() in [ek.lower() for ek in example_keywords] for kw in keywords):
                    continue

            # Check complexity match
            if complexity and example.get('complexity') != complexity:
                continue

            filtered.append(example)

        logger.info(f"🔍 Found {len(filtered)}/{len(examples)} matching examples")
        return filtered

    def get_database_info(self, database: str) -> Dict[str, Any]:
        """
        Get high-level database information.

        Args:
            database: Database name

        Returns:
            Dict with database_info section from schema
        """
        schema = self.get_database_schema(database)
        return schema.get('database_info', {})

    def get_table_definition(self, database: str, table_name: str) -> Optional[Dict[str, Any]]:
        """
        Get definition for a specific table.

        Args:
            database: Database name
            table_name: Name of the table

        Returns:
            Dict with table definition or None if not found
        """
        schema = self.get_database_schema(database)
        tables = schema.get('tables', {})
        return tables.get(table_name)

    def format_schema_for_prompt(self, database: str) -> str:
        """
        Format schema information for LLM prompts.

        Args:
            database: Database name

        Returns:
            Formatted string ready for prompt injection
        """
        schema = self.get_database_schema(database)

        if not schema:
            return f"Schema no disponible para database: {database}"

        db_info = schema.get('database_info', {})
        tables = schema.get('tables', {})

        lines = [
            f"Base de datos: {db_info.get('name', database)}",
            f"Tipo: {db_info.get('type', 'Unknown')}",
            f"Descripción: {db_info.get('description', '')}",
            "",
            "Tablas disponibles:",
        ]

        for table_name, table_def in tables.items():
            lines.append(f"- {table_name}: {table_def.get('description', '')}")
            if table_def.get('notes'):
                lines.append(f"  Nota: {table_def['notes']}")
            columns = table_def.get('columns', [])

            # Handle both list of columns (full definition) and string (reference to another table)
            if isinstance(columns, str):
                # Reference to another table structure — resolve from the referenced table
                ref_table = None
                for tname, tdef in tables.items():
                    if tname != table_name and isinstance(tdef.get('columns'), list) and tdef['columns']:
                        ref_table = tdef
                        break
                if ref_table and isinstance(ref_table.get('columns'), list):
                    col_names = [c.get('name', '') for c in ref_table['columns']]
                    lines.append(f"  Columnas (misma estructura): {', '.join(col_names)}")
                else:
                    lines.append(f"  Estructura: {columns}")
            elif columns:
                # Full column definition — show ALL column names so LLM uses exact names
                col_names = [c.get('name', '') for c in columns]
                lines.append(f"  Columnas: {', '.join(col_names)}")

        # Add SQL syntax notes
        sql_syntax = schema.get('sql_syntax', {})
        if sql_syntax:
            lines.append("")
            lines.append("SINTAXIS SQL:")
            for key, value in sql_syntax.items():
                if isinstance(value, str):
                    lines.append(f"  - {key}: {value}")

        # Add critical rules if present
        if 'critical_rules' in schema:
            lines.append("")
            lines.append("⚠️ REGLAS CRÍTICAS:")
            for rule in schema['critical_rules']:
                lines.append(f"  - {rule}")

        # Add common mistakes if present (helps LLM avoid known errors)
        if 'common_mistakes' in schema:
            lines.append("")
            lines.append("❌ ERRORES COMUNES A EVITAR:")
            for mistake in schema['common_mistakes']:
                if isinstance(mistake, dict):
                    lines.append(f"  - INCORRECTO: {mistake.get('mistake', '')}")
                    lines.append(f"    CORRECTO: {mistake.get('correct', '')}")
                    lines.append(f"    Razón: {mistake.get('reason', '')}")

        return "\n".join(lines)

    def format_examples_for_prompt(self, database: str, max_examples: int = 3) -> str:
        """
        Format query examples for LLM prompts.

        Args:
            database: Database name
            max_examples: Maximum number of examples to include

        Returns:
            Formatted string ready for prompt injection
        """
        examples = self.get_query_examples(database)[:max_examples]

        if not examples:
            return "No hay ejemplos SQL disponibles."

        lines = ["Ejemplos SQL relevantes:", ""]

        for i, example in enumerate(examples, 1):
            lines.append(f"Ejemplo {i}: {example.get('question', '')}")

            # Add SQL query
            sql_query = example.get('sql_query', '').strip()
            if sql_query:
                lines.append("```sql")
                lines.append(sql_query)
                lines.append("```")

            # Add critical notes
            if example.get('critical_notes'):
                lines.append("Notas críticas:")
                for note in example['critical_notes']:
                    lines.append(f"  {note}")

            lines.append("")

        return "\n".join(lines)

    def get_available_databases(self) -> List[str]:
        """
        Get list of available databases.

        Returns:
            List of database names
        """
        if not self.databases_path.exists():
            return []

        databases = []
        for db_path in self.databases_path.iterdir():
            if db_path.is_dir() and (db_path / "schema.yaml").exists():
                databases.append(db_path.name)

        logger.info(f"📂 Found {len(databases)} available databases: {databases}")
        return databases

    def validate_knowledge_base(self) -> Dict[str, Any]:
        """
        Validate knowledge base structure and content.

        Returns:
            Dict with validation results
        """
        results = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'databases': []
        }

        # Check root exists
        if not self.KNOWLEDGE_BASE_ROOT.exists():
            results['valid'] = False
            results['errors'].append(f"Knowledge base root not found: {self.KNOWLEDGE_BASE_ROOT}")
            return results

        # Check each database
        for database in self.get_available_databases():
            db_result = {
                'name': database,
                'schema_valid': False,
                'examples_valid': False,
                'errors': []
            }

            # Validate schema
            try:
                schema = self.get_database_schema(database)
                if 'tables' in schema and len(schema['tables']) > 0:
                    db_result['schema_valid'] = True
                else:
                    db_result['errors'].append("No tables defined in schema")
            except Exception as e:
                db_result['errors'].append(f"Schema error: {str(e)}")
                results['valid'] = False

            # Validate examples
            try:
                examples = self.get_query_examples(database)
                if len(examples) > 0:
                    db_result['examples_valid'] = True
                else:
                    results['warnings'].append(f"No query examples for {database}")
            except Exception as e:
                db_result['errors'].append(f"Examples error: {str(e)}")

            results['databases'].append(db_result)

        # Check petroleum glossary
        try:
            glossary = self.get_petroleum_glossary()
            if not glossary:
                results['warnings'].append("Petroleum glossary is empty")
        except Exception as e:
            results['errors'].append(f"Glossary error: {str(e)}")
            results['valid'] = False

        return results

    def clear_cache(self):
        """Clear all cached data"""
        self.get_database_schema.cache_clear()
        self.get_query_examples.cache_clear()
        self.get_petroleum_glossary.cache_clear()
        logger.info("🗑️ Knowledge base cache cleared")


# Singleton instance
_knowledge_base_manager = None


def get_knowledge_base_manager() -> KnowledgeBaseManager:
    """Get or create singleton instance of KnowledgeBaseManager"""
    global _knowledge_base_manager
    if _knowledge_base_manager is None:
        _knowledge_base_manager = KnowledgeBaseManager()
    return _knowledge_base_manager
