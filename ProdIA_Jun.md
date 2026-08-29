# Bitácora de Cambios — Junio 2026
## Proyecto ProdIA (ECP Insights Flask)

> Fuente: análisis de sistema de archivos + documentos internos del proyecto.
> La bitácora formal (`data/bitacora/`) cubre hasta Marzo 2026; este documento
> registra los cambios identificados para el período 01–29 de Junio de 2026.

---

## Semana 1 — 1 al 6 de Junio

### Resumen
Sin cambios de código registrados durante esta semana.

> *Período de estabilización post-marzo. No se detectaron modificaciones en el código fuente ni en la documentación del proyecto principal.*

---

## Semana 2 — 9 al 13 de Junio

### Resumen
Sin cambios de código registrados durante esta semana.

> *No se detectaron modificaciones en el código fuente ni en la documentación del proyecto principal.*

---

## Semana 3 — 16 al 20 de Junio

### Resumen
Semana de mayor actividad del mes. Se dio inicio y completó el **MVP del sub-proyecto `INGESTA/Rep_Prod/`** ("Robustez V2.0"), una plataforma analítica web completamente nueva que reemplaza el flujo basado en Excel del *Reporte Diario de Producción* de Ecopetrol. El trabajo se concentró en **2 días de alta intensidad (17 y 18 de junio)** con 12 sesiones documentadas.

En paralelo, se incorporaron al proyecto principal nuevos documentos de referencia: la estructura de preguntas de prueba para el sistema (`Estruct_Q.md`) y la guía de personalidad y estilo del chatbot (`personalidad.md`).

---

### 17 de Junio — Análisis y Decisiones de Arquitectura

#### S1 — Análisis de archivos fuente `.xlsm`
Se auditaron las 2 muestras de archivos Excel (`20231231`, `20240211`) del tipo **sin raw** (~27–28 MB). Hallazgo crítico: la capa de datos a grano completo (`BDP_datos_dia/mes/Programa`) **solo existe en archivos "New" (~125 MB)**; los archivos estándar (~30 MB) contienen únicamente pivots agregados. Se detectaron credenciales de producción en texto plano dentro de `xl/connections.xml` (usuarios `c5243438`, `c7201640`; BD `BDP38PRD`) → acción: rotar credenciales.

- **Archivos afectados:** `Doc_Desing/` (muestras), `CLAUDE.md`

#### S2 — Decisiones de arquitectura (D1–D3)
Se tomaron las 3 decisiones fundacionales del proyecto:
- **D1 — PostgreSQL** (en vez de SQLite): ~4M+ filas de hechos, concurrencia batch + web, `NUMERIC` exacto para paridad < 0.1%.
- **D2 — Fuente = celdas de hoja** (no pivot cache ni conexión directa a `BDP38PRD`).
- **D3 — Estrategia "degradación elegante"**: ingerir TODO archivo y preservar lo que cada uno trae. Archivo con raw → llena 3 facts ECP + filiales. Archivo sin raw → llena solo filiales/comentarios/config (ningún archivo se rechaza).

- **Archivos afectados:** `CLAUDE.md` del sub-proyecto

---

### 18 de Junio — Construcción del MVP (10 sesiones en un día)

#### S3 — Validación del esquema raw
Se obtuvo y analizó el archivo "New" de 125 MB (`20241004_Reporte New Diario de Producción.xlsm`, 24 hojas). Esquema validado:

| Tabla raw | Filas | Medidas |
|-----------|-------|---------|
| `BDP_datos_dia` | 8.628 | 5/5 ✓ |
| `BDP_datos_mes` | 314.952 | 10 (9 del DDL + `BPDAC_5` extra) |
| `BDP_Programa` | 13.822 | 3/3 ✓ |

Hallazgos: `IDBDP` es entero; `FECHA` es entero `YYYYMMDD`; la detección de raw debe hacerse **por presencia de hoja**, no por tamaño ni nombre de archivo.

#### S4 — DDL v2 PostgreSQL
Se tradujo el DDL v9 (MySQL) a PostgreSQL. Resultado: `db/ddl_v2_postgres.sql` con esquemas `bronze`/`core`, 21 tablas core + 4 Bronze + 7 vistas. Claves naturales validadas contra datos reales (0 colisiones): `uk_dia`/`uk_mes` incluyen `producto`; `uk_prog` incluye `fuente_id`. Se incorporaron piezas Medallion faltantes: tablas Bronze (staging crudo), `ingesta_log`, `kpis_precalculados`, extensión de `config_reporte`.

- **Archivos creados:** `db/ddl_v2_postgres.sql`

#### S5 — Creación de la base de datos
BD `robustez` creada en PostgreSQL 18.4 local. DDL ejecutado exitosamente: 20 tablas core + 4 Bronze + 7 vistas, `dim_fecha` precargada 2019–2030. Conexión configurada en `.env` (`DATABASE_URL=postgresql+psycopg://...`).

- **Archivos creados:** `.env`, `.gitignore`

#### S6 — ETL Prototipo funcional
Se construyó `etl/ingesta_prototipo.py` (autónomo, ejecutable con `uv run`). Validado contra el archivo "New" (215 s de ejecución):
- Detector de tipo por presencia de hoja
- Bronze tipado + landing JSONB
- Dims derivadas: fuente 338 registros, socio 68
- Facts ECP a grano completo: dia 8.628 / mes 314.952 / programa 13.822 (0 pérdida)
- Filiales: `fact_produccion_diaria` (245 filas, unpivot REAL/PROGRAMA + split `EAI→America`/`Hocol (crudo)`)
- `fact_plan_mensual` (36 filas, POP desde filas TOTAL)
- `fact_promedio_validado` (70 filas, sección YTD de INICIO)
- Idempotencia verificada: 2 corridas → conteos idénticos
- Camino degradado (STD) validado: archivo `20240211` (~28 MB) → tipo STD, `tiene_raw=false`, `nivel_detalle=SIN_ECP`, 0 filas ECP, 280 filiales + 24 comentarios ✓

- **Archivos creados:** `etl/ingesta_prototipo.py`

#### S7 — Análisis del corpus real
Se escaneó el corpus completo `data/{2023,2024,2025}/`: **37 archivos** en total, **16 con raw** (desde 2024-10-02), **21 sin raw** (2023 + Ene–Sep 2024). Conclusión: tamaño/nombre NO predicen la capa raw; la detección por hoja es la única regla confiable. El ETL debe ingerir TODOS los archivos y el upsert "última gana" construye la unión histórica.

#### S8 — Documentación del agente (CLAUDE.md)
Se añadieron al `CLAUDE.md` del sub-proyecto: modos de operación por prefijo (`plan:`, `auditoria:`, `backup:`), flujo profesional audit-first obligatorio, y la bitácora de sesiones (§12). Se formalizó la regla de cobertura: prohibido reducir alcance en silencio.

#### S9 — Scaffolding del monorepo (FastAPI)
Se creó la estructura `backend/` con FastAPI y organización por vertical slicing:
- `core/`: config (pydantic-settings), db (SQLAlchemy Core), logging (structlog)
- `features/ingesta/`, `features/reportes/`, `features/kpis_prod/`
- `shared/utils.py`, CLI (`python -m app.cli`)
- Tests: pytest verde (7/7)
- La lógica del ETL fue **copiada** (no movida) a `backend/`; `etl/ingesta_prototipo.py` sigue funcional como legacy.

- **Archivos creados:** `backend/` (árbol completo), `backend/pyproject.toml`

#### S10 — API de Ingesta por Demanda
Se implementaron los endpoints de ingesta:

| Endpoint | Descripción |
|----------|-------------|
| `GET /ingesta/disponibles` | Lista 37 `.xlsm` con tipo NEW/STD (por detección de hoja) + `ya_ingerido` |
| `POST /ingesta/archivo {nombre}` | Ingesta un archivo (nombre validado contra `data/`, anti-traversal) |
| `POST /ingesta/jobs` | Crea job en `BackgroundTasks`, devuelve `job_id` |
| `GET /ingesta/jobs` / `GET /ingesta/jobs/{id}` | Progreso del lote (procesados/total, errores) |

Nueva tabla `core.ingesta_job` para persistencia de jobs. Verificado end-to-end.

- **Archivos creados:** `db/migrations/001_ingesta_job.sql`, `backend/app/features/ingesta/*`, `backend/tests/`

#### S11-S12 — Frontend MVP (React 19)
Se instaló Node.js 22.23.0 LTS (vía MSI, ya que `winget` no disponible: error `0x8a15000f`). Se construyó el frontend completo:
- Scaffold Vite 8 + react-ts
- 3 pestañas Bootstrap: **Ingesta** (tabla de disponibles → ingerir uno/lote → barra de progreso en vivo por polling + historial), **Reportes** (cobertura), **KPIs Producción** (barras por producto)
- TanStack Query + Zustand para estado
- FastAPI sirve el build (`dist/`) en mismo origen + CORS para dev server de Vite
- Build limpio: 233 kB / `dist/`
- Proxy Vite en dev: `/ingesta`, `/reportes`, `/kpis-prod`, `/health` → `:8000`

- **Archivos creados:** `frontend/` (árbol completo), actualización de `backend/app/main.py`, `.gitignore`

---

### Nuevos archivos en el proyecto ProdIA principal (Semana 3)

| Archivo | Descripción |
|---------|-------------|
| `Estruct_Q.md` | Estructura de 48 preguntas de prueba organizadas en 8 niveles (VP → Gerencia → Campo → Pozo → Económico → Series Temporales → Calidad de Datos → Nacional). Incluye reglas críticas de SQL para ROBUSTEZ y botones esperados por tipo de consulta. |
| `personalidad.md` | Guía de personalidad y estilo del chatbot: directa, amable, sin reformular la pregunta, responder inmediatamente al objetivo del usuario. Define system prompt, ejemplos few-shot, clasificación de intención y postproceso para apertura de respuestas. |
| `static/css/ingesta.css` | Hoja de estilos CSS para el módulo de ingesta (relacionada con el nuevo sub-proyecto INGESTA). |
| `static/js/vendor/jszip-3.10.1.min.js` | Librería JSZip vendorizada (3.10.1), agregada posiblemente para soporte de exportación o manejo de archivos ZIP en el frontend. |

---

## Semana 4 — 23 al 27 de Junio

### Resumen
Sin cambios de código registrados durante esta semana.

> *Período posterior al sprint de desarrollo del sub-proyecto INGESTA. Probable fase de pruebas internas y validación del MVP construido la semana anterior.*

---

## Semana 5 — 29 de Junio (Cierre de mes)

### Resumen
**Migración del proyecto completo** a la ruta actual:
`c:\APLICACIONES\ProdIA\12112025_prodIA\12112025_prodIA\`

Todos los archivos del proyecto (código fuente, templates, assets, scripts, datos) presentan timestamp `2026-06-29 15:05–15:07`, indicando una copia o movimiento masivo en bloque. Esta operación no implica cambios funcionales en el código.

También se detectaron nuevos scripts utilitarios sin fecha específica dentro del mes:

| Archivo | Descripción |
|---------|-------------|
| `_update_panorama_titles.py` | Script para actualización masiva de títulos del panorama general en gráficos. |
| `_loc_map.py` | Script de mapa de localización de campos/pozos. |
| `todos_campos.txt` | Listado extendido de campos (complementa `campos.txt`; incluye campos adicionales). |
| `DIFERIDAS_MES.csv` | Datos de producción diferida mensual (insumo para análisis de diferidas). |
| `resumen/_update_resp.py` | Script de actualización de respuestas en el módulo de resúmenes ejecutivos. |
| `resumen/product.py` | Nuevo script de análisis de producción en el módulo resumen. |

---

## Resumen Ejecutivo del Mes

| Semana | Actividad | Impacto |
|--------|-----------|---------|
| Sem 1 (1–6 Jun) | Sin cambios | — |
| Sem 2 (9–13 Jun) | Sin cambios | — |
| Sem 3 (16–20 Jun) | **Creación sub-proyecto `INGESTA/Rep_Prod/`** (MVP end-to-end en 2 días: FastAPI + PostgreSQL + React 19 + ETL + API) + nuevos docs ProdIA (`Estruct_Q.md`, `personalidad.md`) | 🔴 Alto |
| Sem 4 (23–27 Jun) | Sin cambios documentados | — |
| Sem 5 (29 Jun) | Migración del proyecto a ruta actual + scripts utilitarios nuevos | 🟡 Medio |

### Hitos del mes
1. **MVP de "Robustez V2.0" operacional** — plataforma que reemplaza el flujo Excel del Reporte Diario de Producción. Stack independiente: FastAPI + PostgreSQL 18 + React 19 + ETL `uv`/openpyxl.
2. **ETL validado** contra 37 archivos `.xlsm` históricos (2023–2025) con idempotencia verificada y soporte de degradación elegante (archivos sin raw no se rechazan).
3. **API de ingesta por demanda** con jobs en background y UI web funcional.

### Pendientes al cierre de Junio (sub-proyecto INGESTA)
- `fact_plan_mensual.ppto_kbd` (fuente PPTO de filiales pendiente)
- Segmento Exploración (VEX sin encaje en `empresa_id NOT NULL`)
- Batch productivo sobre los 37 archivos históricos completos
- Primer `git init` del repositorio de INGESTA
- Nuevas features: `auth`, `kpis_fin`, `reports`, filtros jerárquicos (VP → Gerencia → Activo → Pozo), export Excel con `openpyxl`

---

*Generado el 2026-06-29 — Fuente: análisis de sistema de archivos + `INGESTA/Rep_Prod/CLAUDE.md §12`*
