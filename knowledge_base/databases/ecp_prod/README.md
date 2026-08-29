# ECP_PROD Database

## Overview

**Type**: SQLite
**Purpose**: Annual aggregated production data by management unit (gerencia) and field
**Granularity**: Yearly averages (BOPD)
**Coverage**: Historical annual data (2015-2025)

## Tables

### TT_GERENCIA_AÑO_PROD
Annual production (BOPD average) by management unit and field

### PROD_2025
Monthly production distribution by product type (CRUDO, GAS, BLANCOS) for 2025

## Typical Use Cases

- **Annual production queries**: "¿Cuál ha sido la producción nacional (BOPD) por año?"
- **YoY growth analysis**: "¿Cómo evolucionó la producción de VP LLANOS en los últimos 5 años?"
- **Ranking by year**: "¿Cuáles fueron los 5 campos con mayor BOPD en 2023?"
- **Monthly distribution 2025**: "¿Cómo se distribuye la producción de hidrocarburos por meses en 2025?"

## Schema Details

See `schema.yaml` for complete table definitions, columns, and constraints.

## Query Examples

See `query_examples.yaml` for validated SQL examples with explanations.

## Critical Notes

- **BOPD Meaning**: Barrels of Oil Per Day = CRUDO (oil production)
- **CAMPO is geographic**: CAMPO contains location names (APIAY, RUBIALES), NOT product type
- **NO producto filter needed**: BOPD already represents crude oil (crudo)
- **Common ERROR**: Never use `WHERE CAMPO = 'CRUDO'` (CAMPO is field name, not product)
- **PROD_2025 specific**:
  - No AÑO column exists - use literal '2025'
  - Always use `TRIM(PRODUCTO)` in WHERE clauses
  - Products: 'CRUDO', 'GAS', 'BLANCOS'
  - Columns are months: Enero, Febrero, ..., Diciembre
- **SQL Syntax**: SQLite uses `LIMIT N` (not TOP)
