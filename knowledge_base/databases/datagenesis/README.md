# DataGenesis Database

## Overview

**Type**: SQL Server
**Purpose**: Daily production data with detailed well, DMU, and volume information
**Granularity**: Daily measurements by DMU (well-formation unit)
**Timezone**: America/Bogota (UTC-05)

## Tables

### DIM_HIERARCHY
Organizational hierarchies (VP, Gerencia, Field)

### DIM_WELL
Well information (names, locations, formations)

### DIM_DMU
DMU (well-formation measurement units)

### VOLUME_PROD_DAILY
Daily production volumes (oil, water, gas, GOR, WOR)

## Typical Use Cases

- **Daily production queries**: "¿Cuál fue la producción de petróleo del campo APIAY ayer?"
- **Well performance**: "¿Qué pozos tienen WOR crítico (>3.0) en el último mes?"
- **Field analysis**: "Promedio de GOR por campo en el último trimestre"

## Schema Details

See `schema.yaml` for complete table definitions, columns, and relationships.

## Query Examples

See `query_examples.yaml` for validated SQL examples with explanations.

## Critical Notes

- **Date handling**: Use `CAST(OBSERVATION_DATETIME AS DATE)` for daily aggregations
- **Active wells only**: Filter by `STATUS = 'ACT'` for current production
- **Timezone**: All dates are in America/Bogota timezone
- **JOINs required**: Always join HIERARCHY → WELL → DMU → VOLUME_PROD_DAILY
- **SQL Syntax**: Use `TOP N` (not LIMIT), `GETDATE()` for current date
