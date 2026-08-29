# Estructura de Preguntas para Pruebas — ProdIA

> Campo de referencia: **CASTILLA**
> Base de datos: **ROBUSTEZ** (`RESULTADOSREGRESION`, 224K filas, 51 columnas)
> Base de datos: **ECP_PROD** (`PROD_2023`, `PROD_2024`, `PROD_2025`)

---

## Nivel 1 — Vicepresidencia (VP)

### 1.1 Conteo de pozos por VP
```
Cuantos pozos hay por vicepresidencia?
```

### 1.3 Rentabilidad por VP
```
Cuantos pozos son rentables vs no rentables por vicepresidencia?
```

### 1.4 Produccion de aceite por VP
```
Cual es la produccion total de aceite por vicepresidencia en 2025?
```

---

## Nivel 2 — Gerencia

### 2.1 Campos por gerencia
```
Cuales campos tiene cada gerencia?
```

### 2.2 Activos por gerencia
```
Cuantos activos existen por cada gerencia?
```

### 2.3 Breakeven por gerencia
```
Cual es el breakeven promedio por gerencia?
```

### 2.4 Distribucion de tipo de pozo por gerencia
```
Cual es la distribucion de tipo de pozo por gerencia?
```

### 2.5 Estado de pozos por gerencia
```
Cual es la distribucion de estados de pozo por gerencia?
```

### 2.6 Promedio de dias de produccion por gerencia
```
Cual es el promedio de dias de produccion por gerencia?
```

### 2.7 Tasa ponderada por gerencia
```
Cual es la tasa de produccion de aceite ponderada por gerencia?
```

---

## Nivel 3 — Campo (ejemplo: CASTILLA)

### 3.1 Pozos por campo
```
Cuantos pozos unicos existen por campo?
```

### 3.2 Breakeven por campo
```
Cual es el breakeven promedio por campo?
```

### 3.3 Produccion total por campo
```
Cual es la produccion total de aceite del campo CASTILLA en 2025?
```

### 3.4 Total dias de produccion por campo
```
Cual es el total de dias de produccion por campo en 2025?
```

### 3.5 Tasa ponderada por campo
```
Cual es la tasa de produccion ponderada por campo?
```

### 3.6 Pozos productores por campo
```
Que campo tiene mayor cantidad de pozos productores?
```

---

## Nivel 4 — Pozo (UWI)

### 4.1 Top 10 pozos de un campo en un mes especifico
```
En enero 2025, cuales fueron los 10 pozos con mayor produccion en el campo CASTILLA?
```

### 4.2 Produccion solo pozos activos
```
En enero 2025, cual fue la produccion del campo CASTILLA solo pozos activos?
```

### 4.3 Pozo lider cada mes
```
En 2025, que pozo tuvo mayor produccion cada mes en el campo CASTILLA?
```

### 4.4 Pozos con produccion mayor a cero
```
En 2025, por mes, cuantos pozos con produccion mayor a 0 tuvo el campo CASTILLA?
```

---

## Nivel 5 — Analisis Economico

### 5.1 Clasificacion de rentabilidad por gerencia
```
Cuantos pozos son rentables vs no rentables por gerencia?
```

### 5.2 Costos variables por VP
```
Cual es el total de costos variables por vicepresidencia en 2025?
```

### 5.3 Breakeven mas alto
```
Que campos tienen el breakeven mas alto en 2025?
```

### 5.4 EBITDA por campo
```
Cual es el EBITDA total del campo CASTILLA en 2025?
```

### 5.5 Pozos marginales por campo
```
Cuantos pozos marginales tiene el campo CASTILLA?
```

---

## Nivel 6 — Series Temporales (MES a MES)

### 6.1 Produccion mensual de un campo
```
En 2025, por mes, cual es la produccion de aceite del campo CASTILLA?
```

### 6.2 Tasa ponderada mensual de una gerencia
```
En 2025, por mes, cual es la tasa de aceite ponderada de la gerencia GAN?
```

### 6.3 Variacion MoM (mes a mes)
```
En 2025, por mes, cual es la variacion MoM de produccion del campo CASTILLA?
```

### 6.4 Acumulado YTD
```
En 2025, por mes, muestrame el acumulado YTD de produccion del campo CASTILLA
```

### 6.5 Promedio movil 3 meses
```
En 2025, por mes, calcula el promedio movil 3M de produccion del campo CASTILLA
```

### 6.6 Comparar dos campos
```
En 2025, por mes, compara produccion entre los campos CASTILLA y CHICHIMENE
```

### 6.7 Participacion % de un campo en su gerencia
```
En 2025, por mes, que porcentaje de la produccion de la gerencia GAN aporta el campo CASTILLA?
```

### 6.8 Rango de meses
```
Entre marzo y agosto de 2025, cual fue la produccion total del campo CASTILLA?
```

### 6.9 Mes pico de produccion
```
En 2025, en que mes el campo CASTILLA tuvo su produccion maxima?
```

### 6.10 Top 5 campos por mes en una gerencia
```
En 2025, por mes, cuales son los top 5 campos por produccion en la gerencia GAN?
```

---

## Nivel 7 — Calidad de Datos

### 7.1 Duplicados
```
Existen registros duplicados en la tabla?
```

### 7.2 UWI en multiples campos
```
Existen UWI asociados a mas de un campo en el mismo ano?
```

### 7.3 Activos en multiples gerencias
```
Existen activos asociados a mas de una gerencia?
```

### 7.4 MES fuera de rango
```
Existen registros con MES fuera del rango 1-12?
```

### 7.5 Dias de produccion > dias del mes
```
Existen pozos con mas dias de produccion que dias del mes?
```

### 7.6 Pozos activos con cero produccion
```
Existen pozos activos con cero dias de produccion?
```

---

## Nivel 8 — Produccion Nacional (ECP_PROD)

### 8.1 Produccion anual nacional
```
Que valores anuales registra la produccion de crudo nacional?
```

### 8.2 Distribucion mensual 2025
```
Como se distribuye la produccion nacional de hidrocarburos a lo largo de los meses de 2025?
```

### 8.3 Evolucion Crudo/Gas/Blancos
```
Cual ha sido el comportamiento mensual de la produccion nacional de Crudo, Gas y Blancos en 2025?
```

### 8.4 Participacion por gerencia
```
Participacion por Gerencia
```

### 8.5 Ranking de gerencias
```
Ranking de Gerencias por BOPD
```

---

## Botones Esperados por Tipo de Consulta

### Consultas ROBUSTEZ temporales (Nivel 6)
| # | Tipo | Prioridad | Boton |
|---|------|-----------|-------|
| 1 | bar | 1.00 | Variacion % Mes a Mes |
| 2 | line | 0.95 | Tendencia: [metrica] |
| 3 | pie | 0.90 | Segmentacion por Condicion de Pozo |
| 4 | bar | 0.85 | Variacion por Mes |

### Consultas ECP_PROD anuales (Nivel 8.1)
| # | Tipo | Prioridad | Boton |
|---|------|-----------|-------|
| 1 | bar | 0.95 | Variacion Interanual YoY |
| 2 | pie | 0.90 | Participacion por Gerencia |
| 3 | ranking_bar | 0.85 | Ranking de Gerencias por BOPD |

### Consultas ECP_PROD mensuales 2025 (Nivel 8.2/8.3)
| # | Tipo | Prioridad | Boton |
|---|------|-----------|-------|
| 1 | subplot_combo | 0.95 | Variacion de Crudo Mes a Mes 2025 |
| 2 | horizontal_comparison_bar | 0.90 | Maximo vs Minimo Mensual 2025 |
| 3 | multi_line_grouped | 0.85 | Participacion Mensual Gas y Blancos 2025 |

---

## Reglas Criticas para SQL ROBUSTEZ

| Regla | Correcto | Incorrecto |
|-------|----------|------------|
| Tildes | `"AÑO"`, `"Condición Real (Activos)"` | `"ANO"`, `"Condicion Real (Activos)"` |
| Comillas | `"Tasa Producción Aceite"` | `Tasa Producción Aceite` |
| Tasa ponderada | `SUM(tasa * PROD_DAYS) / SUM(PROD_DAYS)` | `AVG(tasa)` |
| MES tipo | `WHERE MES = 1` (INTEGER) | `WHERE MES = '1'` (TEXT) |
| Conteo pozos | `COUNT(DISTINCT UWI) WHERE MES = X` | `COUNT(DISTINCT UWI)` sin filtro mes |
| Breakeven | `AVG("Breakeven (Activos) USD/Bl")` | `SUM("Breakeven (Activos) USD/Bl")` |

---

## Campos Principales para Pruebas

| Campo | Gerencia | Descripcion |
|-------|----------|-------------|
| CASTILLA | GAN | Campo de referencia principal |
| CHICHIMENE | GAN | Segundo campo GAN (para comparaciones) |
| RUBIALES | GOR | Campo grande (comparaciones inter-gerencia) |
| APIAY | GAN | Campo mediano |
| CUSIANA | GCT | Campo gas condensado |
| CUPIAGUA | GCT | Campo gas condensado |

---

## Condiciones de Pozo (valores en BD)

| Condicion | Descripcion |
|-----------|-------------|
| `RENTABLE` | Pozo economicamente viable |
| `MARGINAL` | Pozo en limite de rentabilidad |
| `NO RENTABLE` | Pozo que opera a perdida |

## Estados de Pozo

| Estado | Descripcion |
|--------|-------------|
| `ACT` | Activo |
| `INACT` | Inactivo |
| `SUS` | Suspendido |
| `ABA` | Abandonado |

## Tipos de Pozo

| Tipo | Descripcion |
|------|-------------|
| `PRODUCTION` | Productor |
| `INJECTION` | Inyector |
| `OBSERVATION` | Observacion |
| `PROD_INJ` | Productor/Inyector |
