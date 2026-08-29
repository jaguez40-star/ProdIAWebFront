# ProdIA — Estado de Proyecto

| | |
|---|---|
| **Líder** | Jhon Polania |
| **Patrocinador** | Vicepresidencia de Exploración, Desarrollo y Producción |
| **Fecha** | 19 Ago 2026 |
| **Estado** | 🟡 **EN PROCESO** |

---

## ProdIA — Analítica Conversacional de Producción

Plataforma de consulta de producción de hidrocarburos en **lenguaje natural**.
El usuario pregunta en español y la aplicación resuelve la consulta contra el
Reporte Diario de Producción, entregando la cifra, su comparación contra la
referencia (PPTO / P50 / Compromiso) y el análisis causal de la desviación.

Cubre producción de crudo, gas y blancos por campo, activo, gerencia y
vicepresidencia, con ingesta automatizada del reporte diario (17 hojas
modeladas), tablero de desempeño mensual y análisis ejecutivo asistido por IA.

---

## 📊 Salud del proyecto

### 🕐 Tiempo — 🟢 EN REGLA

- **Motor conversacional:** 4 de 4 grupos respondiendo
- **Épicas gerenciales:** 4 de 7 cerradas o cerrables
- 291 versiones entregadas · 202 en los últimos 30 días

### 💰 Presupuesto

- **Ejecutado:** —
- **Desviación:** —

### 🎯 Alcance — 🟡 EN SEGUIMIENTO

- **Épicas:** 3 cerradas · 1 cerrable · 1 en pausa · 2 no iniciadas
- Alcance ampliado sobre la base inicial (ver Riesgo)

---

## 📋 Avance y cronograma

### ✅ Logros recientes (últimas 2 semanas)

- **El P50 se responde como cifra, no como causa.** Ante *"dame el P50 de
  Rubiales"* el asistente respondía "95,6% del presupuesto": la palabra solo
  servía para enrutar y nunca se usaba como referencia. Ahora entrega la cifra
  donde el P50 existe (ECP global y vicepresidencia) y **declina de forma
  explícita** a nivel campo, donde el dato no existe en ninguna de las 16 hojas
  del reporte, ofreciendo la alternativa disponible.

- **Pill de Mantenimientos conectada a fuente real.** Dejó de ser una maqueta
  con 3 filas fijas idénticas en todos los campos: ahora lee **6.850 eventos**
  de servicio a pozo. Dos criterios nacieron de auditar el archivo real —
  evento sin fecha de cierre significa **abierto** (48% de las filas, que se
  habrían descartado), y el filtro es por solape con el mes analizado, no
  contra la fecha de hoy (que dejaba **3 eventos en toda la compañía**).

- **Panel derecho acumulativo.** Cada respuesta reemplazaba la anterior y
  borraba el resultado previo; ahora se apilan en orden cronológico con el
  panorama general fijo arriba, y persisten al navegar entre pestañas.

- **Identidad visual por producto** (Crudo / Gas / Blancos) con contraste
  verificado, separada de la paleta de estado con la que antes colisionaba.

- **El ranking responde con la lectura, no con la tabla.** El chat y el panel
  mostraban exactamente lo mismo; ahora el chat entrega la interpretación
  (concentración, dominancia, participación de terceros) y el panel el detalle.

### 📅 Próximos hitos (siguientes 30 días)

| Hito | Fecha |
|---|---|
| Re-ingesta de `REPORTE_PRESIDENT` en dev y producción — cierra Épica 2 | **22 Ago** |
| Verificación en navegador de los cambios de agosto | **26 Ago** |
| Fase F0 de la nueva arquitectura (ProdIA V02) — validación LDAP | **30 Ago** |
| Definición de alcance para Épicas 3 y 7 (modos por foro · móvil) | **15 Sep** |

---

## ⚠️ Atención gerencial

### 🚫 Bloqueo actual (crítico)

**Dos épicas bloqueadas por datos, no por código.** En ambas la mecánica está
construida y verificada:

- **Épica 2 (Baseline P50 vs compromiso):** espera la re-ingesta de la hoja
  `REPORTE_PRESIDENT`. El script está listo.
- **Épica 4 (Mapa semáforo por campo):** solo **71 de 139 campos (51%)** tienen
  coordenadas geográficas. Entre los 68 sin ubicación hay focos activos
  (CAJUA, CAÑO LIMÓN, PAUTO SUR) — un mapa de atención que omite justo los
  peores campos sería engañoso. Requiere el export del maestro GIS corporativo.

### ⚠️ Riesgo principal

**Alcance ampliado sobre el plan inicial.** El backlog gerencial de 7 épicas se
levantó en julio; desde entonces se incorporaron funcionalidades no planeadas
(motor conversacional completo, panel apilado, identidad visual, análisis
causal), que han absorbido capacidad de los temas definidos originalmente. Dos
épicas (3 · modos por foro y 7 · experiencia móvil) siguen **sin iniciar**.

*Riesgo secundario — validación humana:* hay cambios verificados técnicamente
que esperan confirmación en navegador. La política del proyecto no permite
declarar completada una funcionalidad visual sin esa validación.

### 📌 Decisión requerida

**Priorizar las épicas no iniciadas.** Las épicas 3 (modos por instancia de
reporte: Sistemática, BP, POP, Junta, Comité) y 7 (experiencia móvil-ejecutiva)
están en 0%. La 7 es relevante porque la gerencia declaró consumir el **80%
desde el teléfono**. Se requiere definición de prioridad y alcance.

**Gestionar el maestro GIS de campos.** Sin las coordenadas de los 68 campos
faltantes, la Épica 4 permanece en pausa indefinida.

**Reajuste del plan.** Reformular el cronograma de acuerdo con las
funcionalidades incorporadas, para ajustarlo a la realidad de los tiempos de
desarrollo actuales.

---

<sub>Próxima reunión de seguimiento: 26 de Agosto, 2026 · Confidencial — Uso Exclusivo del Comité Ejecutivo</sub>
