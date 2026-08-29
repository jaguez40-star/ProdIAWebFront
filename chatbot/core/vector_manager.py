"""
Vector Database Manager for ECP Insights
Handles ChromaDB integration for semantic search and context retrieval

IMPORTANT: This component uses KnowledgeBaseManager as its ONLY data source.
All schemas, examples, and domain knowledge come from knowledge_base/ directory.

./venv/Scripts/python.exe -c "from chatbot.core.vector_manager import VectorManager; vm = VectorManager(); vm.embed_database_schemas()")
"""

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import chromadb
    from sentence_transformers import SentenceTransformer

    VECTOR_DEPENDENCIES_AVAILABLE = True
except ImportError:
    VECTOR_DEPENDENCIES_AVAILABLE = False

import yaml

# Import KnowledgeBaseManager - SINGLE SOURCE OF TRUTH
from .knowledge_base_manager import get_knowledge_base_manager

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Search result from vector database"""

    content: str
    metadata: Dict[str, Any]
    similarity_score: float
    collection: str


@dataclass
class DatabaseSchema:
    """Database schema information"""

    database_name: str
    tables: List[Dict[str, Any]]
    relationships: List[Dict[str, Any]]
    examples: List[Dict[str, Any]]


class VectorManager:
    """
    Manages vector database operations for ECP Insights
    Handles embedding generation, storage, and semantic search
    """

    def __init__(self, config_path: str = "config/vector_config.yaml"):
        """Initialize Vector Manager"""
        self.config_path = config_path
        self.config = self._load_config()

        # Initialize KnowledgeBaseManager - SINGLE SOURCE OF TRUTH
        self.kb_manager = get_knowledge_base_manager()
        logger.info(
            "✅ VectorManager using KnowledgeBaseManager as single source of truth"
        )

        # Initialize components
        self.client = None
        self.embedding_model = None
        self.collections = {}

        if not VECTOR_DEPENDENCIES_AVAILABLE:
            logger.error(
                "Vector dependencies not available. Install: pip install chromadb sentence-transformers"
            )
            raise ImportError("Missing vector dependencies")

        self._initialize_client()
        self._initialize_embedding_model()
        self._initialize_collections()

        logger.info("VectorManager initialized successfully")

    def _load_config(self) -> Dict[str, Any]:
        """Load vector database configuration"""
        try:
            config_file = Path(self.config_path)
            if not config_file.exists():
                logger.warning(
                    f"Vector config not found: {self.config_path}, using defaults"
                )
                return self._get_default_config()

            with open(config_file, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.error(f"Error loading vector config: {e}")
            return self._get_default_config()

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration"""
        return {
            "vector_database": {
                "provider": "chromadb",
                "chromadb": {
                    "persist_directory": "./vector_db/chroma_storage",
                    "collection_name": "ecp_insights_knowledge",
                    "embedding": {
                        "model": "all-MiniLM-L6-v2",
                        "dimension": 384,
                        "normalize": True,
                    },
                    "distance_metric": "cosine",
                },
            },
            "collections": {
                "database_schemas": {"name": "db_schemas"},
                "sql_examples": {"name": "sql_patterns"},
                "domain_knowledge": {"name": "petroleum_knowledge"},
                "query_responses": {"name": "historical_responses"},
            },
            "search_settings": {"default_top_k": 5, "similarity_threshold": 0.7},
        }

    def _initialize_client(self):
        """Initialize ChromaDB client"""
        try:
            persist_dir = self.config["vector_database"]["chromadb"][
                "persist_directory"
            ]

            # Ensure directory exists
            Path(persist_dir).mkdir(parents=True, exist_ok=True)

            # Initialize ChromaDB client (new API)
            self.client = chromadb.PersistentClient(path=persist_dir)

            logger.info(f"ChromaDB client initialized at: {persist_dir}")

        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB client: {e}")
            raise

    def _initialize_embedding_model(self):
        """Initialize sentence transformer model"""
        try:
            model_name = self.config["vector_database"]["chromadb"]["embedding"][
                "model"
            ]
            self.embedding_model = SentenceTransformer(model_name)
            logger.info(f"Embedding model loaded: {model_name}")

        except Exception as e:
            logger.error(f"Failed to initialize embedding model: {e}")
            raise

    def _initialize_collections(self):
        """Initialize or get existing collections"""
        try:
            collections_config = self.config.get("collections", {})

            for collection_key, collection_info in collections_config.items():
                collection_name = collection_info.get("name", collection_key)

                try:
                    # Try to get existing collection
                    collection = self.client.get_collection(name=collection_name)
                    logger.info(f"Retrieved existing collection: {collection_name}")
                except Exception:
                    # Create new collection if it doesn't exist
                    collection = self.client.create_collection(
                        name=collection_name,
                        metadata={
                            "description": collection_info.get("description", "")
                        },
                    )
                    logger.info(f"Created new collection: {collection_name}")

                self.collections[collection_key] = collection

        except Exception as e:
            logger.error(f"Failed to initialize collections: {e}")
            raise

    def embed_database_schemas(self) -> bool:
        """
        Embed database schemas from configuration files

        NOTE (2025-10-15): Only embeds ECP_PROD schema.
        DataGenesis schema loading is disabled as all queries route to ECP_PROD.
        DataGenesis YAML files are preserved but not embedded into vector database.
        """
        try:
            # DISABLED: DataGenesis schema embedding (2025-10-15)
            # Reason: Simplified routing - all queries now go to ECP_PROD
            # Note: DataGenesis YAML files are preserved in knowledge_base/databases/datagenesis/
            #
            # datagenesis_schema = self._load_datagenesis_schema()
            # if datagenesis_schema:
            #     self._add_schema_to_collection(datagenesis_schema, "datagenesis")

            # Embed ECP_PROD schema
            logger.info("📚 Embedding ECP_PROD schema...")
            ecp_prod_schema = self._load_ecp_prod_schema()
            if ecp_prod_schema:
                self._add_schema_to_collection(ecp_prod_schema, "ecp_prod")
                logger.info("✅ ECP_PROD schema embedded successfully")
            else:
                logger.error("❌ Failed to load ECP_PROD schema")
                return False

            # Embed ROBUSTEZ schema
            logger.info("📚 Embedding ROBUSTEZ schema...")
            robustez_schema = self._load_robustez_schema()
            if robustez_schema:
                self._add_schema_to_collection(robustez_schema, "robustez")
                logger.info("✅ ROBUSTEZ schema embedded successfully")
            else:
                logger.warning("⚠️ Failed to load ROBUSTEZ schema (non-critical)")

            logger.info("Database schemas embedded successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to embed database schemas: {e}")
            return False

    def _load_datagenesis_schema(self) -> Optional[DatabaseSchema]:
        """
        Load DataGenesis schema from KnowledgeBaseManager (SINGLE SOURCE OF TRUTH)

        OLD APPROACH (DEPRECATED): Read from data/tables_detail/detalle_tabla_prod.txt
        NEW APPROACH: Use KnowledgeBaseManager to read from knowledge_base/databases/datagenesis/
        """
        try:
            logger.info("📚 Loading DataGenesis schema from KnowledgeBaseManager...")

            # Get schema from KnowledgeBaseManager
            schema_data = self.kb_manager.get_database_schema("datagenesis")
            if not schema_data:
                logger.warning("DataGenesis schema not found in KnowledgeBaseManager")
                return None

            # Get query examples from KnowledgeBaseManager
            query_examples = self.kb_manager.get_query_examples("datagenesis")

            # Convert schema format for vector storage
            tables_info = schema_data.get("tables", {})
            tables = []
            for table_name, table_def in tables_info.items():
                columns = [col.get("name") for col in table_def.get("columns", [])]
                tables.append(
                    {
                        "name": table_name,
                        "description": table_def.get("description", ""),
                        "columns": columns,
                        "relationships": [],  # Can be extracted if needed
                    }
                )

            # Convert query examples format
            sql_examples = []
            for example in query_examples:
                sql_examples.append(
                    {
                        "description": example.get("question", ""),
                        "sql": example.get("sql_query", ""),
                        "category": "datagenesis_analysis",
                        "table": (
                            example.get("tables_used", [""])[0]
                            if example.get("tables_used")
                            else ""
                        ),
                        "database": "datagenesis",
                    }
                )

            logger.info(
                f"✅ Loaded {len(tables)} tables and {len(sql_examples)} examples from KnowledgeBaseManager"
            )

            return DatabaseSchema(
                database_name="datagenesis",
                tables=tables,
                relationships=[],
                examples=sql_examples,
            )

        except Exception as e:
            logger.error(
                f"Error loading DataGenesis schema from KnowledgeBaseManager: {e}"
            )
            return None

    def _load_ecp_prod_schema(self) -> Optional[DatabaseSchema]:
        """
        Load ECP_PROD schema from KnowledgeBaseManager (SINGLE SOURCE OF TRUTH)

        OLD APPROACH (DEPRECATED): Hardcoded schema due to YAML parsing issues
        NEW APPROACH: Use KnowledgeBaseManager to read from knowledge_base/databases/ecp_prod/
        """
        try:
            logger.info("📚 Loading ECP_PROD schema from KnowledgeBaseManager...")

            # Get schema from KnowledgeBaseManager
            schema_data = self.kb_manager.get_database_schema("ecp_prod")
            if not schema_data:
                logger.warning("ECP_PROD schema not found in KnowledgeBaseManager")
                return None

            # Get query examples from KnowledgeBaseManager
            query_examples = self.kb_manager.get_query_examples("ecp_prod")

            # Convert schema format for vector storage
            tables_info = schema_data.get("tables", {})
            tables = []
            for table_name, table_def in tables_info.items():
                # Handle both list of columns (full definition) and string (reference)
                columns_data = table_def.get("columns", [])
                if isinstance(columns_data, str):
                    # Reference to another table structure (e.g., "Same structure as PROD_2023")
                    # Use a generic column representation
                    columns = [
                        "PRODUCTO",
                        "VICE",
                        "GERENCIA",
                        "CAMPO",
                        "monthly_columns",
                        "Real_Acum",
                    ]
                    column_details = [f"Similar structure to {columns_data}"]
                else:
                    # Full column definition
                    columns = [col.get("name") for col in columns_data]
                    column_details = columns_data

                tables.append(
                    {
                        "name": table_name,
                        "description": table_def.get("description", ""),
                        "columns": columns,
                        "column_details": column_details,
                        "relationships": [],
                    }
                )

            # Convert query examples format
            examples = []
            for example in query_examples:
                examples.append(
                    {
                        "description": example.get("question", ""),
                        "sql": example.get("sql_query", ""),
                        "category": "ecp_prod_analysis",
                        "table": (
                            example.get("tables_used", [""])[0]
                            if example.get("tables_used")
                            else ""
                        ),
                        "database": "ecp_prod",
                        "keywords": example.get("keywords", []),
                        "critical_notes": example.get("critical_notes", []),
                    }
                )

            logger.info(
                f"✅ Loaded {len(tables)} tables and {len(examples)} examples from KnowledgeBaseManager"
            )
            logger.info(f"   - Tables: {[t['name'] for t in tables]}")

            # ⚠️ CRITICAL: No fallback allowed - knowledge_base must be complete
            if not tables or not examples:
                error_msg = (
                    "❌ CRITICAL ERROR: ECP_PROD schema/examples not found in knowledge_base!\n"
                    f"   - Tables loaded: {len(tables)}\n"
                    f"   - Examples loaded: {len(examples)}\n"
                    "   Expected location: knowledge_base/databases/ecp_prod/\n"
                    "   This is a CONFIGURATION ERROR - knowledge_base must be complete.\n"
                    "   NO FALLBACK available (all hardcoded data removed per consolidation)."
                )
                logger.error(error_msg)
                raise ValueError(error_msg)

            return DatabaseSchema(
                database_name="ecp_prod",
                tables=tables,
                relationships=[],
                examples=examples,
            )

        except Exception as e:
            logger.error(f"Error loading ECP_PROD schema: {e}")
            import traceback

            logger.error(traceback.format_exc())
            return None

    def _load_robustez_schema(self) -> Optional[DatabaseSchema]:
        """
        Load ROBUSTEZ schema from KnowledgeBaseManager (SINGLE SOURCE OF TRUTH)
        """
        try:
            logger.info("📚 Loading ROBUSTEZ schema from KnowledgeBaseManager...")

            schema_data = self.kb_manager.get_database_schema("robustez")
            if not schema_data:
                logger.warning("ROBUSTEZ schema not found in KnowledgeBaseManager")
                return None

            query_examples = self.kb_manager.get_query_examples("robustez")

            tables_info = schema_data.get("tables", {})
            tables = []
            for table_name, table_def in tables_info.items():
                columns_data = table_def.get("columns", [])
                if isinstance(columns_data, list):
                    columns = [col.get("name") for col in columns_data]
                else:
                    columns = []

                tables.append(
                    {
                        "name": table_name,
                        "description": table_def.get("description", ""),
                        "columns": columns,
                        "relationships": [],
                    }
                )

            examples = []
            for example in query_examples:
                examples.append(
                    {
                        "description": example.get("question", ""),
                        "sql": example.get("sql_query", ""),
                        "category": "robustez_analysis",
                        "table": (
                            example.get("tables_used", [""])[0]
                            if example.get("tables_used")
                            else ""
                        ),
                        "database": "robustez",
                        "keywords": example.get("keywords", []),
                        "critical_notes": example.get("critical_notes", []),
                    }
                )

            logger.info(
                f"✅ Loaded {len(tables)} tables and {len(examples)} examples for ROBUSTEZ"
            )

            return DatabaseSchema(
                database_name="robustez",
                tables=tables,
                relationships=[],
                examples=examples,
            )

        except Exception as e:
            logger.error(f"Error loading ROBUSTEZ schema: {e}")
            return None

    # NOTE: Methods _extract_sql_examples and _extract_yaml_sql_examples removed
    # These methods were used to parse old text/YAML files from deprecated locations
    # Now all examples come from KnowledgeBaseManager in structured YAML format

    def _add_schema_to_collection(self, schema: DatabaseSchema, database_type: str):
        """Add schema information to vector collection"""
        collection = self.collections.get("database_schemas")
        if not collection:
            logger.error("Database schemas collection not found")
            return

        # Add table information
        for table in schema.tables:
            # Enhanced table text with detailed column information
            column_info = table.get("column_details", table["columns"])
            if (
                isinstance(column_info, list)
                and len(column_info) > 0
                and "(" in str(column_info[0])
            ):
                # Use detailed column info if available
                columns_desc = "\n            ".join(
                    [f"- {col}" for col in column_info]
                )
            else:
                # Fall back to simple column list
                columns_desc = ", ".join(table["columns"])

            table_text = f"""
            Base de datos: {schema.database_name}
            Tabla: {table['name']}
            Descripción: {table['description']}
            Columnas disponibles:
            {columns_desc}
            Relaciones: {', '.join(table.get('relationships', []))}
            """

            embedding = self.embedding_model.encode([table_text.strip()])[0]

            collection.add(
                documents=[table_text.strip()],
                embeddings=[embedding.tolist()],
                metadatas=[
                    {
                        "database": schema.database_name,
                        "table_name": table["name"],
                        "type": "schema",
                        "database_type": database_type,
                    }
                ],
                ids=[f"{schema.database_name}_{table['name']}_schema"],
            )

        # Add SQL examples
        sql_collection = self.collections.get("sql_examples")
        if sql_collection:
            for i, example in enumerate(schema.examples):
                # Include keywords in the embedded text for better semantic search
                keywords_text = ""
                if example.get("keywords"):
                    keywords_text = (
                        f"\nPalabras clave: {', '.join(example['keywords'])}"
                    )

                # Include critical notes for important warnings
                critical_notes_text = ""
                if example.get("critical_notes"):
                    critical_notes_text = f"\n⚠️ NOTAS CRÍTICAS:\n" + "\n".join(
                        f"  - {note}" for note in example["critical_notes"]
                    )

                example_text = f"""
                Consulta: {example['description']}
                SQL: {example['sql']}
                Categoría: {example.get('category', 'general')}
                Base de datos: {schema.database_name}{keywords_text}{critical_notes_text}
                """

                embedding = self.embedding_model.encode([example_text.strip()])[0]

                sql_collection.add(
                    documents=[example_text.strip()],
                    embeddings=[embedding.tolist()],
                    metadatas=[
                        {
                            "database": schema.database_name,
                            "category": example.get("category", "general"),
                            "type": "sql_example",
                            "database_type": database_type,
                        }
                    ],
                    ids=[f"{schema.database_name}_example_{i}"],
                )

    def search_similar_content(
        self,
        query: str,
        collection_name: str = "sql_examples",
        top_k: int = None,
        filters: Dict[str, Any] = None,
    ) -> List[SearchResult]:
        """Search for similar content in vector database"""
        try:
            if top_k is None:
                top_k = self.config["search_settings"]["default_top_k"]

            collection = self.collections.get(collection_name)
            if not collection:
                logger.error(f"Collection {collection_name} not found")
                return []

            # Generate query embedding
            query_embedding = self.embedding_model.encode([query])[0]

            # Prepare where clause for filtering
            where_clause = None
            if filters:
                where_clause = filters

            # Search in collection
            results = collection.query(
                query_embeddings=[query_embedding.tolist()],
                n_results=top_k,
                where=where_clause,
            )

            search_results = []
            if results["documents"] and len(results["documents"]) > 0:
                documents = results["documents"][0]
                metadatas = (
                    results["metadatas"][0]
                    if results["metadatas"]
                    else [{}] * len(documents)
                )
                distances = (
                    results["distances"][0]
                    if results["distances"]
                    else [0.0] * len(documents)
                )

                for doc, metadata, distance in zip(documents, metadatas, distances):
                    # Convert distance to similarity score (closer to 1 is more similar)
                    similarity_score = 1.0 - distance

                    search_results.append(
                        SearchResult(
                            content=doc,
                            metadata=metadata,
                            similarity_score=similarity_score,
                            collection=collection_name,
                        )
                    )

            return search_results

        except Exception as e:
            logger.error(f"Error searching vector database: {e}")
            return []

    def get_database_context(
        self, query: str, database_hint: str = None
    ) -> Dict[str, Any]:
        """
        Get relevant database context for a query

        NOTE (2025-10-15): Simplified to only search ECP_PROD database.
        All queries now route to ECP_PROD regardless of content.
        """
        try:
            context = {
                "selected_database": None,
                "schema_context": [],
                "sql_examples": [],
                "vector_context": [],
            }

            # Determine which database to use (always ecp_prod now)
            context["selected_database"] = self._determine_database(
                query, database_hint
            )

            # Get schema context - SIMPLIFIED: always filter by ecp_prod
            schema_results = self.search_similar_content(
                query,
                "database_schemas",
                top_k=3,
                filters={"database": "ecp_prod"},  # Always ECP_PROD
            )
            context["schema_context"] = [r.content for r in schema_results]

            # Get SQL examples - SIMPLIFIED: always filter by ecp_prod
            sql_results = self.search_similar_content(
                query,
                "sql_examples",
                top_k=5,  # Increased from 3 to 5 to capture PROD_2025 examples
                filters={"database": "ecp_prod"},  # Always ECP_PROD
            )

            # Log retrieved examples for debugging
            logger.info(
                f"🔍 Vector RAG retrieved {len(sql_results)} SQL examples for query: '{query[:80]}...'"
            )
            for i, result in enumerate(sql_results):
                # Extract table name from content
                table_match = result.content[
                    :200
                ]  # First 200 chars should contain table info
                logger.info(
                    f"   Example {i+1} (score: {result.similarity_score:.3f}): {table_match[:100]}..."
                )

            context["sql_examples"] = [r.content for r in sql_results]

            # Get general vector context
            context["vector_context"] = schema_results + sql_results

            return context

        except Exception as e:
            logger.error(f"Error getting database context: {e}")
            return {
                "selected_database": "ecp_prod",  # Changed from datagenesis to ecp_prod
                "schema_context": [],
                "sql_examples": [],
                "vector_context": [],
            }

    def _determine_database(self, query: str, database_hint: str = None) -> str:
        """
        Determine which database to use - SIMPLIFIED to always use ECP_PROD.

        RESPONSIBILITY: Selects DATABASE for Production Agent

        IMPORTANT: This method is called AFTER QueryRouter.route_query() has already
                   decided to use the Production Agent. This method does NOT decide
                   between Production vs General agents.

        FLOW CONTEXT:
            QueryRouter.route_query() → "production" (agent selection)
                ↓
            ProductionAgent.process_query()
                ↓
            VectorManager.get_database_context()
                ↓
            VectorManager._determine_database() → "ecp_prod" (THIS METHOD)

        SIMPLIFIED LOGIC (2025-10-15):
        All production queries now route directly to ECP_PROD database.
        The complex weighted scoring system has been removed as all data
        is now consolidated in the ECP database.

        Args:
            query: User query text
            database_hint: Optional hint from upstream (if provided, use it)

        Returns:
            "ecp_prod" (always, unless database_hint specifies otherwise)
        """
        if database_hint:
            logger.info(f"📌 Database hint provided: {database_hint}")
            return database_hint

        # SIMPLIFIED: Always route to ECP_PROD
        logger.info(
            f"✅ DECISION: ECP_PROD (Simplified routing - all queries to ECP database)"
        )
        return "ecp_prod"

    def refresh_datagenesis_examples(self):
        """Refresh DataGenesis SQL examples in vector database"""
        try:
            sql_collection = self.collections.get("sql_examples")
            if not sql_collection:
                logger.error("SQL examples collection not found")
                return False

            # Get the updated schema
            datagenesis_schema = self._load_datagenesis_schema()
            if not datagenesis_schema:
                logger.error("Failed to load updated DataGenesis schema")
                return False

            # Delete existing DataGenesis examples
            try:
                existing_ids = [
                    f"datagenesis_example_{i}" for i in range(10)
                ]  # Safe range
                sql_collection.delete(ids=existing_ids)
                logger.info(
                    "Deleted existing DataGenesis examples from vector database"
                )
            except Exception as e:
                logger.warning(f"Error deleting existing DataGenesis examples: {e}")

            # Add updated examples
            for i, example in enumerate(datagenesis_schema.examples):
                example_text = f"""
                Consulta: {example['description']}
                SQL: {example['sql']}
                Categoría: {example.get('category', 'general')}
                Base de datos: {datagenesis_schema.database_name}
                """

                embedding = self.embedding_model.encode([example_text.strip()])[0]

                sql_collection.add(
                    documents=[example_text.strip()],
                    embeddings=[embedding.tolist()],
                    metadatas=[
                        {
                            "database": datagenesis_schema.database_name,
                            "category": example.get("category", "general"),
                            "type": "sql_example",
                            "database_type": "datagenesis",
                        }
                    ],
                    ids=[f"{datagenesis_schema.database_name}_example_{i}"],
                )

            logger.info(
                f"Updated {len(datagenesis_schema.examples)} DataGenesis examples in vector database"
            )
            return True

        except Exception as e:
            logger.error(f"Error refreshing DataGenesis examples: {e}")
            return False

    def refresh_ecp_prod_examples(self):
        """Refresh ECP_PROD SQL examples in vector database"""
        try:
            sql_collection = self.collections.get("sql_examples")
            if not sql_collection:
                logger.error("SQL examples collection not found")
                return False

            # Get the updated schema
            ecp_prod_schema = self._load_ecp_prod_schema()
            if not ecp_prod_schema:
                logger.error("Failed to load updated ECP_PROD schema")
                return False

            # Delete existing ECP_PROD examples
            try:
                existing_ids = [
                    f"ecp_prod_example_{i}" for i in range(10)
                ]  # Safe range
                sql_collection.delete(ids=existing_ids)
                logger.info("Deleted existing ECP_PROD examples from vector database")
            except Exception as e:
                logger.warning(f"Error deleting existing examples: {e}")

            # Add updated examples
            for i, example in enumerate(ecp_prod_schema.examples):
                example_text = f"""
                Consulta: {example['description']}
                SQL: {example['sql']}
                Categoría: {example.get('category', 'general')}
                Base de datos: {ecp_prod_schema.database_name}
                """

                embedding = self.embedding_model.encode([example_text.strip()])[0]

                sql_collection.add(
                    documents=[example_text.strip()],
                    embeddings=[embedding.tolist()],
                    metadatas=[
                        {
                            "database": ecp_prod_schema.database_name,
                            "category": example.get("category", "general"),
                            "type": "sql_example",
                            "database_type": "ecp_prod",
                        }
                    ],
                    ids=[f"{ecp_prod_schema.database_name}_example_{i}"],
                )

            logger.info(
                f"Updated {len(ecp_prod_schema.examples)} ECP_PROD examples in vector database"
            )
            return True

        except Exception as e:
            logger.error(f"Error refreshing ECP_PROD examples: {e}")
            return False

    def add_successful_query(
        self, query: str, sql: str, results_summary: str, agent_type: str
    ):
        """Add a successful query-response pair to the knowledge base"""
        try:
            collection = self.collections.get("query_responses")
            if not collection:
                return

            content = f"""
            Consulta usuario: {query}
            SQL generado: {sql}
            Resumen resultados: {results_summary}
            Agente: {agent_type}
            """

            embedding = self.embedding_model.encode([content.strip()])[0]

            import time

            query_id = f"query_{int(time.time())}"

            collection.add(
                documents=[content.strip()],
                embeddings=[embedding.tolist()],
                metadatas=[
                    {
                        "agent_type": agent_type,
                        "success": True,
                        "type": "successful_query",
                    }
                ],
                ids=[query_id],
            )

            logger.info(f"Added successful query to knowledge base: {query_id}")

        except Exception as e:
            logger.error(f"Error adding successful query: {e}")

    def is_available(self) -> bool:
        """Check if vector database is available"""
        return (
            VECTOR_DEPENDENCIES_AVAILABLE
            and self.client is not None
            and self.embedding_model is not None
        )

    def get_stats(self) -> Dict[str, Any]:
        """Get vector database statistics"""
        try:
            stats = {"available": self.is_available(), "collections": {}}

            for name, collection in self.collections.items():
                try:
                    count = collection.count()
                    stats["collections"][name] = {"count": count}
                except:
                    stats["collections"][name] = {
                        "count": 0,
                        "error": "Could not retrieve count",
                    }

            return stats

        except Exception as e:
            logger.error(f"Error getting vector stats: {e}")
            return {"available": False, "error": str(e)}


# Global vector manager instance
vector_manager = None


def get_vector_manager() -> VectorManager:
    """Get global vector manager instance"""
    global vector_manager
    if vector_manager is None:
        vector_manager = VectorManager()
    return vector_manager
