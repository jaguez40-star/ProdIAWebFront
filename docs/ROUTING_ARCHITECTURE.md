# Sistema de Routing en ECP Insights

## Resumen Ejecutivo

El sistema de routing de ECP Insights utiliza una **arquitectura de dos niveles** para procesar consultas de usuarios:

1. **Nivel 1 - Agent Selection** (`query_router.py`): Decide **QUÉ AGENTE** usar (Production vs General)
2. **Nivel 2 - Database Selection** (`vector_manager.py`): Decide **QUÉ BASE DE DATOS** consultar (DataGenesis vs ECP_PROD)

Esta separación de responsabilidades evita duplicación de código y mantiene el sistema mantenible.

---

## Flujo Completo de Routing

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER QUERY                                     │
│                    "¿Cuál ha sido la producción nacional por año?"       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  NIVEL 1: AGENT SELECTION                                               │
│  📍 Ubicación: chatbot/agents/query_router.py                           │
│  🎯 Responsabilidad: ¿Production Agent o General Agent?                 │
│                                                                          │
│  query_router.route_query(user_query) →                                 │
│     - Analiza keywords generales de producción petrolera                │
│     - Calcula scores: production_score vs general_score                 │
│     - Decide: "production" (datos) o "general" (conversación)           │
│                                                                          │
│  Decisión: "production" ✅ (tiene keywords petroleros)                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PRODUCTION AGENT                                                        │
│  📍 Ubicación: chatbot/agents/production_agent.py                       │
│  🎯 Responsabilidad: Procesar consultas de datos petroleros             │
│                                                                          │
│  production_agent.process_query() →                                     │
│     - Obtiene contexto vectorial                                        │
│     - Genera SQL                                                        │
│     - Ejecuta consulta                                                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  NIVEL 2: DATABASE SELECTION                                            │
│  📍 Ubicación: chatbot/core/vector_manager.py                           │
│  🎯 Responsabilidad: ¿DataGenesis o ECP_PROD?                           │
│                                                                          │
│  vector_manager.get_database_context() →                                │
│     vector_manager._determine_database() →                              │
│                                                                          │
│  Heurística con 3 prioridades:                                          │
│     1. EXPLICIT OVERRIDES (2025 mensual → ECP_PROD)                     │
│     2. WEIGHTED SCORING (keywords con pesos 1-4)                        │
│     3. MULTI-LEVEL LOGIC (ratios, contexto, default)                    │
│                                                                          │
│  Decisión: "ecp_prod" ✅ (nacional + por año = strong indicators)       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  EJECUCIÓN DE CONSULTA SQL                                              │
│  Base de datos: ECP_PROD                                                │
│  Tablas: PROD_2023, PROD_2024, PROD_2025                                │
│  Resultado: Datos de producción nacional agregados por año              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Nivel 1: Agent Selection (QueryRouter)

### Ubicación
`chatbot/agents/query_router.py`

### Responsabilidad
Determinar si la consulta requiere:
- **Production Agent**: Consultas de datos petroleros (SQL, análisis)
- **General Agent**: Conversación general (saludos, ayuda, chat)

### Keywords Relevantes

**Production Keywords** (indica consulta de datos):
```python
# Métricas técnicas
"gor", "wor", "bopd", "producción", "petróleo", "crudo", "gas"

# Entidades DataGenesis
"campo", "pozo", "dmu", "apiay", "cusiana"

# Entidades ECP_PROD
"gerencia", "vicepresidencia", "tt_gerencia", "nacional", "ranking"

# Análisis
"promedio", "ranking", "estadísticas", "reporte", "balance"

# Temporal
"anual", "mensual", "diario", "por año", "mes a mes"

# Productos
"hidrocarburos", "producto", "distribución"
```

**General Keywords** (indica conversación):
```python
"hola", "ayuda", "help", "gracias", "cómo funciona", "quién eres"
```

### Algoritmo de Scoring

```python
def _calculate_production_score(query):
    # 1. Base score: keyword density
    keyword_matches = count_keyword_matches(query)
    base_score = min(keyword_matches / word_count * 2, 1.0)

    # 2. Bonuses por patrones específicos
    bonuses = 0.0

    if has_year(query):                    # "2023", "2024", "2025"
        bonuses += 0.2

    if has_units(query):                   # "bbl", "mscf", "bopd"
        bonuses += 0.3

    if has_question_pattern(query):         # "cuál", "cuánto", "cómo"
        bonuses += 0.2

    if has_technical_terms(query):          # "análisis", "reporte", "balance"
        bonuses += 0.2

    if has_strategic_terms(query):          # "nacional", "ranking", "distribución"
        bonuses += 0.25

    if has_temporal_patterns(query):        # "mensual", "anual", "por año"
        bonuses += 0.15

    return min(base_score + bonuses, 1.0)
```

### Lógica de Decisión

```python
if general_score > 0.7 and production_score < 0.3:
    return "general"  # Conversación clara

elif production_score > 0.3:
    return "production"  # Cualquier indicador petrolero significativo

elif short_query and general_score > 0.3:
    return "general"  # Saludos cortos

elif production_score > 0.1:
    return "production"  # Mínimo indicador petrolero

else:
    return "general"  # Default ambiguo
```

### ⚠️ Importante
**QueryRouter NO decide la base de datos**. Solo decide el tipo de agente. La selección de DB (DataGenesis vs ECP_PROD) ocurre después en VectorManager.

---

## Nivel 2: Database Selection (VectorManager)

### Ubicación
`chatbot/core/vector_manager.py` → `_determine_database()`

### Responsabilidad
Determinar cuál base de datos usar:
- **DataGenesis**: Datos operacionales granulares (pozos, campos, diario)
- **ECP_PROD**: Datos estratégicos agregados (nacional, anual, gerencias)

### Sistema de 3 Prioridades

#### Priority 1: Explicit Overrides
Reglas críticas que **siempre** ganan:

```python
# Override: 2025 mensual → ECP_PROD (tabla PROD_2025)
if "2025" in query and ("mensual" in query or "hidrocarburos" in query):
    return "ecp_prod"
```

**Razón**: La tabla `PROD_2025` en ECP_PROD tiene datos mensuales de 2025. Sin este override, iría incorrectamente a DataGenesis.

#### Priority 2: Weighted Keyword Scoring

**ECP_PROD Keywords** (datos estratégicos):
```python
# Weight 4 - Extremely strong
"tt_gerencia": 4

# Weight 3 - Strong indicators
"producción nacional": 3
"por año": 3
"anual": 3
"estadísticas": 3
"ranking": 3
"mayor producción": 3

# Weight 2 - Moderate
"gerencia": 2
"vicepresidencia": 2
"evolucionado": 2

# Weight 1 - Weak
"histórico": 1
"participación": 1
"año": 1
```

**DataGenesis Keywords** (datos operacionales):
```python
# Weight 4 - Extremely strong (technical metrics)
"gor": 4
"wor": 4
"dmu": 4

# Weight 3 - Strong (well-level & daily)
"pozo": 3
"diario": 3
"ayer": 3
"producción diaria": 3

# Weight 2 - Moderate
"activo": 2
"suspendido": 2
"última semana": 2

# Weight 1 - Weak (general terms)
"campo": 1
"petróleo": 1
"barril": 1
```

**Cálculo de Scores**:
```python
total_ecp_score = sum(matched_ecp_weights)
total_dg_score = sum(matched_dg_weights)
```

#### Priority 3: Multi-Level Decision Logic

**Rule 1**: Strong indicators dominate (≥4)
```python
if strong_dg_score >= 4 and strong_ecp_score == 0:
    return "datagenesis"  # DataGenesis domina claramente

if strong_ecp_score >= 4 and strong_dg_score == 0:
    return "ecp_prod"  # ECP_PROD domina claramente
```

**Rule 2**: Mixed strong indicators → ratio analysis
```python
if strong_dg_score > 0 and strong_ecp_score > 0:
    ratio = strong_dg_score / strong_ecp_score

    if ratio >= 1.5:
        return "datagenesis"  # DG domina por 50%+

    elif ratio <= 0.67:
        return "ecp_prod"  # ECP domina por 33%+

    else:
        # Ratio cercano (0.67-1.5) → usar contexto
        if has_technical_keywords(query):
            return "datagenesis"
        else:
            return "ecp_prod"
```

**Rule 3**: Total scores comparison (≥3)
```python
if total_ecp_score >= 3 and total_ecp_score > total_dg_score:
    return "ecp_prod"

if total_dg_score >= 3 and total_dg_score > total_dg_score:
    return "datagenesis"
```

**Rule 4**: Ambiguous → default DataGenesis
```python
# Default to DataGenesis (more granular data)
return "datagenesis"
```

---

## Ejemplos de Routing Completo

### Ejemplo 1: Query Estratégica

**Query**: `"¿Cuál ha sido la producción nacional por año?"`

**Nivel 1 - Agent Selection**:
```
Keywords matched: producción (1), nacional (1), por año (1), año (1)
production_score = 0.65
general_score = 0.0

Decision: "production" ✅
```

**Nivel 2 - Database Selection**:
```
ECP_PROD:
  - "producción nacional" (weight 3)
  - "por año" (weight 3)
  - "año" (weight 1)
  Total: 7

DataGenesis:
  - No strong matches
  Total: 0

Rule 3: total_ecp_score (7) >= 3 and wins
Decision: "ecp_prod" ✅
```

**Base de Datos Final**: ECP_PROD
**Tablas**: PROD_2023, PROD_2024, PROD_2025

---

### Ejemplo 2: Query Operacional

**Query**: `"¿Qué pozos tienen WOR crítico ayer?"`

**Nivel 1 - Agent Selection**:
```
Keywords matched: pozos (1), wor (1), ayer (1)
production_score = 0.72
general_score = 0.0

Decision: "production" ✅
```

**Nivel 2 - Database Selection**:
```
DataGenesis:
  - "pozos" (weight 3)
  - "wor" (weight 4)
  - "ayer" (weight 3)
  - "crítico" bonus
  Total: 10

ECP_PROD:
  - No matches
  Total: 0

Rule 1: strong_dg_score (10) >= 4 and strong_ecp_score = 0
Decision: "datagenesis" ✅
```

**Base de Datos Final**: DataGenesis
**Tablas**: VOLUME_PROD_DAILY, DIM_WELL

---

### Ejemplo 3: Query con Override

**Query**: `"¿Cómo se distribuye la producción mensual de hidrocarburos en 2025?"`

**Nivel 1 - Agent Selection**:
```
Keywords matched: distribución (1), producción (1), mensual (1), hidrocarburos (1), 2025 (1)
production_score = 0.81
general_score = 0.0

Decision: "production" ✅
```

**Nivel 2 - Database Selection**:
```
PRIORITY 1 OVERRIDE triggered:
  - "2025" present: YES ✅
  - "mensual" present: YES ✅
  - "hidrocarburos" present: YES ✅

Override rule: 2025 + (mensual OR hidrocarburos) → ECP_PROD

Decision: "ecp_prod" ✅ (bypasses Priority 2 & 3)
```

**Base de Datos Final**: ECP_PROD
**Tabla**: PROD_2025 (tiene columnas mensuales ENE, FEB, MAR...)

---

## Diferencias Clave Entre Bases de Datos

### DataGenesis
**Enfoque**: Datos operacionales y técnicos granulares
**Nivel**: Pozo, campo, día
**Métricas**: GOR, WOR, oil_volume, water, gas
**Temporal**: Diario (OBSERVATION_DATETIME)
**Uso típico**: Monitoreo diario, análisis de pozos, alertas técnicas

**Tablas**:
- `DIM_WELL`: Información de pozos
- `DIM_HIERARCHY`: Jerarquía campo-gerencia
- `VOLUME_PROD_DAILY`: Producción diaria por pozo
- `DIM_DMU`: Unidades de medición

### ECP_PROD
**Enfoque**: Datos estratégicos y agregados
**Nivel**: Nacional, gerencia, año
**Métricas**: BOPD promedio, participación %, acumulados
**Temporal**: Anual, mensual (columnas ENE-DIC)
**Uso típico**: Reportes ejecutivos, análisis de tendencias, benchmarking

**Tablas**:
- `PROD_2023`: Producción agregada 2023
- `PROD_2024`: Producción agregada 2024
- `PROD_2025`: Producción agregada 2025 (con desglose mensual)
- `TT_GERENCIA_AÑO_PROD`: Resumen por gerencia y año
- `DATA_HOM`: Datos homologados

---

## Mantenimiento y Mejoras

### ¿Cuándo actualizar QueryRouter?
Actualizar cuando necesites:
- ✅ Agregar nuevos **tipos de consultas** (ej: forecast, compliance)
- ✅ Mejorar detección de **consultas conversacionales**
- ❌ NO para routing de base de datos (eso es VectorManager)

### ¿Cuándo actualizar VectorManager._determine_database()?
Actualizar cuando necesites:
- ✅ Agregar nuevas **bases de datos** (ej: DataMart de finanzas)
- ✅ Ajustar **keywords de routing** entre DBs
- ✅ Agregar nuevos **overrides críticos**
- ❌ NO para decidir agentes (eso es QueryRouter)

### Sincronización de Keywords
Los keywords en ambos archivos deben estar **sincronizados conceptualmente**:

**QueryRouter** → Keywords generales de producción petrolera
```python
# Incluye keywords de AMBAS bases de datos
production_keywords = [
    "gor", "wor", "pozo",        # DataGenesis
    "nacional", "ranking", "tt_gerencia"  # ECP_PROD
]
```

**VectorManager** → Keywords específicos por base de datos
```python
# Separados por DB con pesos
ecp_strong_keywords = {"tt_gerencia": 4, "producción nacional": 3}
dg_strong_keywords = {"gor": 4, "wor": 4, "pozo": 3}
```

---

## Logging y Debugging

### Logs de QueryRouter
```
INFO - 🔀 QueryRouter - Production: 0.72, General: 0.15
INFO - 🛢️ Routing to PRODUCTION agent (petroleum query detected)
```

### Logs de VectorManager
```
INFO - 📊 Database routing scores:
       ECP_PROD: 7 (strong=6, moderate=1)
       DataGenesis: 3 (strong=0, moderate=3)
       ECP matched: ['producción nacional(3)', 'por año(3)', 'año(1)']
       DG matched: ['campo(1)', 'petróleo(1)']

INFO - ✅ DECISION: ECP_PROD (Rule 3: Total score 7 ≥3 and wins vs 3)
```

---

## Testing

### Test del QueryRouter
```python
# Debe detectar CUALQUIER query de producción petrolera
test_cases = [
    ("Producción nacional por año", "production"),
    ("WOR diario campo APIAY", "production"),
    ("Ranking gerencias 2024", "production"),
    ("Hola, ¿cómo estás?", "general"),
]
```

### Test de Database Selection
```python
# Debe elegir la DB correcta según granularidad
test_cases = [
    ("Producción nacional por año", "ecp_prod"),
    ("Pozos con GOR > 500", "datagenesis"),
    ("Distribución mensual hidrocarburos 2025", "ecp_prod"),  # Override!
    ("Producción diaria CASTILLA ayer", "datagenesis"),
]
```

---

## Referencias

- **QueryRouter**: `chatbot/agents/query_router.py`
- **VectorManager**: `chatbot/core/vector_manager.py`
- **ProductionAgent**: `chatbot/agents/production_agent.py`
- **Test de Routing**: `test_database_routing.py`
- **Vector DB README**: `vector_db/README.md`

---

**Última actualización**: 2025-10-11
**Autor**: Sistema ECP Insights
**Versión**: 2.0 (Post-consolidación de routing)
