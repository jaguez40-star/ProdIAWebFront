# Knowledge Base - Single Source of Truth

This directory contains **ALL** database schemas, query examples, and domain knowledge for ECP Insights.

## 🎯 Purpose

**This is the ONLY place** where database schemas, SQL examples, and petroleum domain knowledge should be stored and maintained.

All other components (`vector_manager`, `configurable_agent`, etc.) **MUST** use `KnowledgeBaseManager` to access this information.

## 📁 Structure

```
knowledge_base/
├── databases/          # Database-specific knowledge
│   ├── datagenesis/   # DataGenesis (daily production data)
│   │   ├── schema.yaml
│   │   ├── query_examples.yaml
│   │   └── README.md
│   └── ecp_prod/      # ECP_PROD (annual aggregated data)
│       ├── schema.yaml
│       ├── query_examples.yaml
│       └── README.md
└── domain/            # Domain knowledge
    └── petroleum_glossary.yaml
```

## 🔒 Rules for Maintaining Single Source of Truth

### ✅ DO:
- **Edit files in `knowledge_base/` directly** when updating schemas or examples
- **Use `KnowledgeBaseManager`** to access this data programmatically
- **Add new databases** by creating a new folder under `databases/` with `schema.yaml` and `query_examples.yaml`
- **Document changes** in the respective README files

### ❌ DON'T:
- **Never duplicate** schema information in code, prompts, or other config files
- **Never read** from `knowledge_base/` directly in code (use `KnowledgeBaseManager`)
- **Never embed** SQL examples or schemas in Python files or YAML configs
- **Never create** alternative sources of truth (e.g., schemas in `data/` or `config/`)

## 📝 How to Add a New Database

1. Create directory structure:
   ```bash
   mkdir -p knowledge_base/databases/your_database
   ```

2. Create `schema.yaml`:
   ```yaml
   database_info:
     name: "YourDatabase"
     type: "SQL Server"
     description: "Description of your database"

   tables:
     YOUR_TABLE:
       description: "Table description"
       columns:
         - name: COLUMN_NAME
           type: VARCHAR(100)
           nullable: false
           description: "Column description"
   ```

3. Create `query_examples.yaml`:
   ```yaml
   query_examples:
     - id: "your_db_001"
       question: "Example question"
       sql_query: |
         SELECT * FROM YOUR_TABLE;
   ```

4. Create `README.md` documenting the database

5. `KnowledgeBaseManager` will automatically discover it

## 🔄 Updating Existing Information

### To update a schema:
1. Edit `knowledge_base/databases/{db_name}/schema.yaml`
2. Clear cache: `get_knowledge_base_manager().clear_cache()`
3. Restart application

### To add SQL examples:
1. Edit `knowledge_base/databases/{db_name}/query_examples.yaml`
2. Follow the existing format (see examples)
3. Clear cache and restart

### To update petroleum glossary:
1. Edit `knowledge_base/domain/petroleum_glossary.yaml`
2. Clear cache and restart

## 🧪 Validation

Run validation to check knowledge base integrity:

```python
from chatbot.core.knowledge_base_manager import get_knowledge_base_manager

kb = get_knowledge_base_manager()
results = kb.validate_knowledge_base()

if results['valid']:
    print("✅ Knowledge base is valid")
else:
    print("❌ Errors found:", results['errors'])
```

## 📚 Additional Resources

- See individual database READMEs for specific documentation
- See `chatbot/core/knowledge_base_manager.py` for API reference
