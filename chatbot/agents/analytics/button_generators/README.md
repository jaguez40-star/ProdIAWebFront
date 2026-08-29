# Generadores de Botones de Analytics

Este módulo gestiona la generación de botones dinámicos con consultas SQL y gráficos para el panel de analytics.

## 📋 Archivo Principal: `sql_followups.py`

### Estructura de Configuración

El sistema usa **detección por palabras clave** para identificar el tipo de pregunta y generar botones relevantes.

---

## 🎯 Configuración Actual: Producción Nacional

**Ubicación:** `sql_followups.py:33-37`

### Palabras Clave
```python
production_keywords = [
    "producción", "bopd", "nacional", "año", "gerencia",
    "crudo", "petróleo", "anual", "anuales", "volumen",
    "promedio", "últimos", "ultimos", "valores", "registra"
]
```

### Preguntas Cubiertas
1. ✅ "Cual ha sido la producción nacional (BOPD) por año?"
2. ✅ "Cómo ha sido la producción promedio nacional de crudo por cada año?"
3. ✅ "Cuál es el volumen anual de producción nacional de petróleo?"
4. ✅ "Qué valores anuales registra la producción de crudo nacional?"
5. ✅ "Cuál ha sido la producción de petróleo en BOPD a nivel nacional los ultimos años?"
6. ✅ "Qué producción nacional de crudo se ha obtenido en los ultimos años?"

### Botones Generados
Cuando se detecta una pregunta con estas palabras clave, se generan automáticamente 3 botones:

1. **Variación Interanual (YoY) y CAGR**
   - Tipo: `bar`
   - SQL: Análisis temporal con LAG, deltas y CAGR
   - Tabla: `TT_GERENCIA_AÑO_PROD`

2. **Participación por Gerencia**
   - Tipo: `pie`
   - SQL: Distribución porcentual por vicepresidencias
   - Tabla: `TT_GEN_AÑO_PROD`

3. **Ranking de Gerencias por BOPD**
   - Tipo: `ranking_bar`
   - SQL: Ranking con RANK() OVER PARTITION BY
   - Tabla: `TT_GEN_AÑO_PROD`

---

## 🎯 Configuración Actual: Distribución Mensual 2025

**Ubicación:** `sql_followups.py:183-186`

### Palabras Clave
```python
monthly_keywords = [
    "distribuye", "distribución", "mensual", "meses", "mes a mes",
    "2025", "hidrocarburos", "crudo", "gas", "blancos"
]
```

### Preguntas Cubiertas
1. ✅ "Cómo se distribuye la producción nacional de hidrocarburos a lo largo de los meses de 2025?"

### Botones Generados
Cuando se detecta una pregunta sobre distribución mensual, se generan automáticamente 3 botones:

1. **Variación de la producción de Crudo mes a mes durante 2025**
   - Tipo: `line`
   - SQL: Análisis de evolución mensual de crudo
   - Tabla: `PROD_2025`

2. **Variación entre mes de mayor y menor producción en 2025**
   - Tipo: `bar`
   - SQL: Comparación máximo vs mínimo mensual
   - Tabla: `PROD_2025`

3. **Porcentaje de producción mensual: Crudo, Gas y Blancos**
   - Tipo: `stacked_bar`
   - SQL: Distribución porcentual por producto mensual
   - Tabla: `PROD_2025`

---

## 🔧 Cómo Agregar Nuevos Conjuntos de Preguntas

### Opción 1: Agregar palabras clave al conjunto existente

**Archivo:** `sql_followups.py:33-37`

Simplemente agrega más palabras clave al array `production_keywords`:

```python
production_keywords = [
    "producción", "bopd", "nacional", "año", "gerencia",
    "crudo", "petróleo", "anual", "anuales", "volumen",
    "promedio", "últimos", "ultimos", "valores", "registra",
    # Agregar nuevas palabras aquí:
    "histórico", "tendencia", "evolución"
]
```

### Opción 2: Crear un nuevo conjunto de botones

**Ubicación:** Después de la línea 166 en `sql_followups.py`

Agrega un nuevo bloque `if` con su propio conjunto de palabras clave y botones:

```python
# Nuevo conjunto para análisis de GOR/WOR
gor_keywords = ["gor", "wor", "relación gas", "relación agua"]
is_gor_query = any(keyword in question_lower for keyword in gor_keywords)

if is_gor_query:
    logger.info("🎯 Detected GOR/WOR query - generating specific buttons")

    buttons.append({
        "id": "FU_GOR_01",
        "title": "Análisis de GOR",
        "description": "Relación Gas-Aceite histórica",
        "chart_type": "line",
        "sql_query": """
            SELECT [AÑO], [GERENCIA], AVG([GOR]) as GOR_PROMEDIO
            FROM TT_GOR_ANALYSIS
            GROUP BY [AÑO], [GERENCIA]
            ORDER BY [AÑO]
        """.strip(),
        "database": "ecp_prod",
        "config": {
            "x_axis": "AÑO",
            "y_axis": "GOR_PROMEDIO",
            "chart_type": "line",
            "title": "Evolución del GOR"
        },
        "priority": 0.95,
        "css_class": "btn btn-outline-primary btn-sm chart-button",
        "is_sql_query": True
    })

    return buttons
```

---

## 📊 Estructura de un Botón

```python
{
    "id": "identificador_unico",              # ID único del botón
    "title": "Título del Botón",             # Texto visible en el botón
    "description": "Descripción detallada",   # Tooltip/descripción
    "chart_type": "bar|line|pie|ranking_bar", # Tipo de gráfico
    "sql_query": "SELECT ...",                # Query SQL completa
    "database": "ecp_prod",                   # Base de datos objetivo
    "config": {                               # Configuración del gráfico
        "x_axis": "columna_x",
        "y_axis": "columna_y",
        "chart_type": "tipo_grafico",
        "title": "Título del Gráfico",
        "top_n": 10  # Opcional: limitar resultados
    },
    "priority": 0.95,  # 0.0-1.0, mayor = más prioritario
    "css_class": "btn btn-outline-primary btn-sm chart-button",
    "is_sql_query": True  # Indica que es una consulta SQL
}
```

---

## 🎨 Tipos de Gráficos Disponibles

- `bar`: Gráfico de barras
- `line`: Gráfico de líneas
- `pie`: Gráfico circular
- `ranking_bar`: Barras con ranking
- `dashboard`: Panel de KPIs
- `benchmark`: Comparación vs targets
- `executive_trend`: Tendencias ejecutivas
- `yoy_growth`: Crecimiento año sobre año
- `gap_analysis`: Análisis de brechas
- `efficiency`: Análisis de eficiencia

---

## 📝 Ejemplo de Flujo Completo

1. **Usuario pregunta:** "Cuál es el volumen anual de producción nacional de petróleo?"

2. **Detección:** El sistema detecta las palabras "volumen", "anual", "producción", "nacional", "petróleo"

3. **Coincidencia:** Se activa `is_production_query = True`

4. **Generación:** Se crean automáticamente 3 botones con consultas SQL

5. **Renderizado:** Los botones aparecen en el panel del usuario

6. **Interacción:** Al hacer clic, se ejecuta el SQL y se muestra el gráfico

---

## 🧪 Testing

Para probar si tus palabras clave funcionan, puedes:

1. Agregar logs temporales:
```python
logger.info(f"🔍 Question: {question_lower}")
logger.info(f"🔍 Matched keywords: {[k for k in production_keywords if k in question_lower]}")
```

2. Verificar en los logs: `data/logs/agent_activity_*.log`

---

## 📚 Archivos Relacionados

- `executive_buttons.py`: Botones ejecutivos generales
- `dynamic_buttons.py`: Botones dinámicos generados por datos
- `../chart_creators/`: Módulos de creación de gráficos
- `../data_analyzers/`: Análisis de datos y columnas
