# Proyecto: ECP Insights (ProdIA)

## Resumen general
ECP Insights es una aplicacion web de analitica y chat orientada a datos de produccion petrolera. Esta version esta montada sobre **Flask + SocketIO** con un flujo de 3 paneles (respuesta, botones de graficas, y graficas/seguimientos). El sistema integra routing inteligente por tipo de consulta, ejecucion SQL, y generacion automatica de visualizaciones y follow-ups.

## Stack tecnico principal
- Backend: Flask, Flask-SocketIO, Flask-CORS.
- LLM y orquestacion: LangChain, LangGraph, Ollama (gemma4 local), prompts en YAML.
- Analitica/visualizacion: pandas, plotly, generadores de graficos propios.
- Vector DB: ChromaDB + SentenceTransformers.
- Persistencia: SQLite local para historial de chat.
- Autenticacion: flujo LDAP/AD con lista blanca (modo desarrollo habilitado).

## Estructura del proyecto (alto nivel)
- `app.py`: entrypoint de Flask/SocketIO y orquestacion del chat en tiempo real.
- `routes/`: endpoints web y API.
- `chatbot/`: agentes, routing, LLM, analytics, y utilidades de data/SQL.
- `config/`: configuraciones de prompts, vector DB y settings de aplicacion.
- `knowledge_base/`: schemas y conocimiento de dominio consumidos por el vector manager.
- `static/` y `templates/`: frontend (JS, CSS, HTML, layout 3 paneles).
- `scripts/`: automatizacion para pipelines de reportes fijos.
- `data/`: almacenamiento local (chat history, exports, uploads).
- El segundo backend (FastAPI, puerto 5030) + su propio frontend React, para el Reporte
  Diario de Produccion (ingesta, tablas, Motor Q v2, EBITDA/Analizar), vive en el **repo
  hermano `backend\`** (ProdIABack), no dentro de este checkout. Flask lo consume via
  proxy interno en `routes/api.py` (`INGESTA_API_URL`); el navegador nunca le habla
  directo. Ver "Despliegue y control de versiones" mas abajo.

## Funcionalidades clave
- Chat con persistencia de conversaciones y mensajes (panel principal).
- Routing inteligente de consultas (general vs production).
- Seleccion de base de datos por heuristicas (DataGenesis vs ECP_PROD).
- Generacion SQL, ejecucion de consultas y respuesta con metadatos.
- Generacion de botones de graficas (panel 2) y graficas con follow-ups (panel 3).
- Paneles fijos de reportes con pipeline configurable y placeholders.
- Autenticacion con lista blanca + modo desarrollo.

## Pipelines principales

### 1) Pipeline de UI en tiempo real (SocketIO)
**Archivo:** `app.py`
1. Cliente emite `send_message` con `conversation_id` y `message`.
2. Backend guarda mensaje del usuario en DB y emite `new_message`.
3. Backend emite estados de procesamiento.
4. Backend llama `get_ai_response_with_panels()` (API local `/api/ai/generate`).
5. Respuesta se persiste con metadata (paneles, sql, base usada, tiempo).
6. Backend emite `new_message` (panel 1) y datos para panel 2 y 3.

### 2) Pipeline de API de IA y 3 paneles
**Archivo:** `routes/api.py` endpoint `/api/ai/generate`
1. Determina `session_id` y contexto.
2. **Routing de agente**: `query_router.route_query()` decide `general` o `production`.
3. **General Agent** responde directamente (solo panel 1).
4. **Production Agent** ejecuta:
   - Vector context + generacion SQL.
   - Ejecucion SQL y normalizacion.
5. **Panel 2**: `AnalyticsAgent.generate_chart_buttons()` crea botones dinamicos.
6. **Panel 3**: `FollowupAgent.generate_followups()` crea insights y recomendaciones.
7. Respuesta final incluye `panel_1`, `panel_2`, `panel_3` y metadata de SQL.

### 3) Pipeline de routing (2 niveles)
**Documento:** `docs/ROUTING_ARCHITECTURE.md`
- **Nivel 1 (Agent Selection)**: `chatbot/agents/query_router.py` usa scoring de keywords para decidir `production` vs `general`.
- **Nivel 2 (Database Selection)**: `chatbot/core/vector_manager.py` decide `datagenesis` vs `ecp_prod` por reglas + scoring ponderado.
- Nota: existe override explicito para consultas mensuales 2025 hacia `ECP_PROD`.

### 4) Pipeline de Vector DB y conocimiento
**Archivo:** `chatbot/core/vector_manager.py`
- Usa `knowledge_base/` como fuente unica de schemas y ejemplos.
- Embeddings con SentenceTransformers y almacenamiento en ChromaDB.
- Configuracion en `config/vector_config.yaml`.

### 5) Pipeline de Analitica y graficos
**Archivo:** `chatbot/agents/analytics_agent.py`
- Genera botones dinamicos para panel 2 segun datos y contexto.
- Mantiene cache global para reutilizar datos en generacion de graficas.
- Usa analizadores de datos (numeric/categorical/fecha) y generadores de charts modulares.

### 6) Pipeline de reportes fijos
**Script:** `scripts/Active_Buttons_report.py`
Automatiza:
- Habilitar botones en `fixed_reports.py`.
- Crear backend placeholder en `chart_creators/`.
- Crear renderer JS en `static/js/`.
- Conectar pipeline en `production_reports.py`.

**Script relacionado:** `scripts/iny_comp_lienzo_mensual.py` (reutiliza el pipeline anterior para reportes mensuales).

## Flujos de autenticacion y sesiones
- `routes/auth.py`: login/logout, lista blanca y opcion LDAP/AD.
- `utils/auth_service.py` y `utils/auth_middleware.py`: validaciones y decoradores.
- Sesiones guardadas en filesystem (`SESSION_TYPE=filesystem`).

## Persistencia de datos
- Historial de chat y conversaciones: `utils/chat_history.py` (SQLite en `data/`).
- Vector DB: `vector_db/chroma_storage`.
- Archivos de entrada/salida: `data/uploads` y `data/exports`.

## Entrypoints y ejecucion
- Backend principal: `app.py` (puerto 5029).
- Backend INGESTA: `backend\backend\app\main.py` en el repo hermano (FastAPI, puerto 5030).
- Arranque: `iniciar_frontend.bat` (Flask :5029) y `iniciar_backend.bat` (INGESTA :5030),
  cada uno en su repo. Corren en la misma consola que los invoca y resuelven el interprete
  base via `pyvenv.cfg`, evitando el trampolin `venv\Scripts\python.exe` que WDAC bloquea
  en el servidor 139.
- Script de instalacion: `install.bat` (crea `venv/`, instala `requirements-windows.txt`).
  Requiere Python **3.12.x** exacto (`onnxruntime==1.22.1` aun no tiene wheels para 3.14;
  ver postmortem del 2026-08-26). En el layout separado omite la parte de INGESTA y avisa:
  es normal. El backend se instala aparte con `uv sync`.
- Dependencias: `requirements-windows.txt` (Flask) + `backend\backend\pyproject.toml` (uv).

## Despliegue y control de versiones (actualizado 2026-08-29)
El codigo vive en **2 repos**, carpetas hermanas y no anidadas:
- **`frontend\`** — ProdIAWebFront: solo Flask (puerto 5029).
- **`backend\`** — ProdIABack: solo INGESTA (puerto 5030), FastAPI + su frontend React.

El **origen de trabajo es un repositorio externo** (`ProdIAWebFront` y `ProdIABack`), porque
la maquina local no tiene VPN y no alcanza Azure DevOps. El flujo es: editar en local →
push al repositorio de trabajo → pull en el servidor de pruebas → verificar → publicar en
Azure DevOps `dev` (rama con politicas: no admite push directo) → servidor 139.

El monorepo `ProdIA-2.0` queda como **archivo historico**, no como fuente de verdad.

Scripts de apoyo (ambos comiteados en `frontend\`):
- `exportar_azure.ps1`: exporta con `git archive` (solo lo versionado, nunca `.env`,
  `venv/`, `node_modules/`) hacia una carpeta limpia sin git.
- `verificar_deploy.ps1`: chequea que un checkout desplegado tenga la version actual
  (puerto correcto, rediseno del login, y **todos** los estaticos que `templates/login.html`
  referencia realmente presentes) — correr siempre antes de dar un despliegue por bueno.
- Script `migrar_a_azure.ps1` (en la carpeta de procedimientos del equipo): puente hacia el
  checkout de Azure, con verificacion de fidelidad hash por hash.

Detalle completo de la migracion de puertos (y por que hizo falta) en
`POSTMORTEM_migracion_puertos_azure_20260826.md`.

## Observaciones relevantes
- Se conserva compatibilidad de pipelines viejos, pero hay un flujo nuevo de 3 paneles.
- El routing y la seleccion de DB estan claramente separados para mantenimiento.
- Hay placeholders para reportes fijos que facilitan iteraciones rapidas en frontend/backend.

## Recomendaciones tecnicas (opcional)
- Confirmar si `DEVELOPMENT_MODE=True` en `routes/auth.py` debe estar activo en produccion.
- Documentar el modelo Ollama esperado (`gemma4:latest`) y fallback si no esta disponible.
- Consolidar la documentacion del pipeline de reportes fijos en `docs/`.
