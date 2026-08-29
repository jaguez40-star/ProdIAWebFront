# Hilo de conversación · Tarjeta P50 de apertura

Guion de preguntas derivadas de la tarjeta **ECP · Cumplimiento del compromiso corporativo (P50)**,
la primera vista que recibe el usuario al abrir el reporte.

---

## Datos de partida

| | Crudo | Gas | Blancos |
|---|---|---|---|
| **Estado** | Ajustado | En meta | Actuar |
| **Cumplimiento (REAL / P50)** | 95,9 % | 105,2 % | 86,7 % |
| **Real del mes (kbpe)** | 498,2 | 81,9 | 12,9 |
| Base P50 | 519,5 | 77,8 | 14,9 |
| Compromiso = P50 | 519,5 | 77,8 | 14,9 |
| Proyección cierre | 509,1 | 80,7 | 13,2 |
| Programa día | 516,3 | 79,4 | 13,3 |
| Real día | – | – | – |
| **Gap vs P50** | **−21,3** | **+4,1** | **−2,0** |

**Lectura inicial:** dos productos incumplen (Crudo, Blancos) y uno sobrecumple (Gas).
El gap neto corporativo es negativo: −21,3 + 4,1 − 2,0 = **−19,2 kbpe**.

---

## 1. El gap grande — Crudo

Crudo concentra el mayor gap absoluto (−21,3 kbpe) y, por volumen, es el que arrastra el
resultado corporativo.

- [ ] **Q1** ¿A qué se debe el gap de crudo del mes? → *analizar · causal*
- [ ] **Q2** ¿Qué activos o campos explican los −21,3 de crudo? → *cuantificar · N5 ranking*
- [ ] **Q3** ¿El gap viene de un campo puntual o está repartido entre varios? → *N5 + concentración*

**Por qué es la primera:** es la pregunta de mayor impacto económico y la que un directivo
haría de entrada.

> El plan de pruebas detallado de este bloque está en la sección **Q1 · Plan de pruebas**
> al final del documento.

---

## 2. La contradicción de Blancos

Blancos tiene el **peor porcentaje** (86,7 %, estado "Actuar") pero el **gap más pequeño**
en términos absolutos (−2,0 kbpe). El semáforo y la magnitud no coinciden.

- [ ] ¿Por qué Blancos está en "Actuar" si el gap es de solo −2,0?
- [ ] ¿Cuánto pesa Blancos en el total corporativo?
- [ ] ¿El criterio de semáforo es porcentual o absoluto?

**Por qué importa:** valida si la alerta visual está bien calibrada o si genera ruido sobre
un producto de bajo peso relativo.

---

## 3. Lo que Gas puede compensar

- [ ] ¿El excedente de gas (+4,1) alcanza para compensar el déficit de crudo?
- [ ] ¿Qué está impulsando el sobrecumplimiento de gas?
- [ ] ¿El sobrecumplimiento de gas es sostenible hasta el cierre?

**Nota:** +4,1 cubre apenas el 19 % del déficit de crudo. La compensación es parcial.

---

## 4. La señal transversal — proyección vs programa

En Crudo y Blancos la **proyección de cierre queda por debajo del programa día**:

- Crudo: 509,1 vs 516,3 → por debajo
- Blancos: 13,2 vs 13,3 → por debajo
- Gas: 80,7 vs 79,4 → **por encima** (único que supera)

- [ ] ¿Por qué la proyección de cierre está por debajo del programa día?
- [ ] ¿Qué se necesita en los días restantes para cerrar en compromiso?
- [ ] ¿Es alcanzable el P50 de crudo con los días que quedan?

**Por qué importa:** es la pregunta prospectiva — deja de mirar lo ocurrido y pasa a la
decisión sobre lo que queda de mes.

---

## 5. Cierre económico

- [ ] ¿Qué impacto en EBITDA tiene el gap de crudo?
- [ ] ¿A cuánto equivale en ingresos el déficit del mes?
- [ ] ¿Cuál es el costo de oportunidad de no cerrar el P50?

**Por qué va al final:** traduce el volumen a dinero, que es el cierre natural de la
conversación ejecutiva.

---

## Punto abierto · calidad del dato

**"Real día" aparece como `–` en los tres productos.**

Dos explicaciones posibles:

1. El día en curso aún no tiene cifra cargada (comportamiento esperado a primera hora).
2. Falta el dato por un problema de ingesta.

Conviene distinguirlas: una **proyección de cierre calculada sin el día actual** puede estar
desactualizada, y las preguntas del bloque 4 se apoyan justamente en esa proyección.

- [ ] ¿Por qué "Real día" está vacío en los tres productos?
- [ ] ¿La proyección de cierre incorpora el día en curso?

---

## Cómo trabajar este hilo

Cada casilla es una pregunta a probar contra el chat en lenguaje natural. Para cada una
conviene registrar:

- **Respuesta obtenida** — ¿contestó con cifras correctas?
- **Ruta de clasificación** — ¿jerarquizar / cuantificar / analizar / out?
- **Calidad** — ¿la respuesta es accionable o genérica?
- **Brechas** — ¿qué debería haber respondido y no respondió?

> Nota operativa: las respuestas de cifras dependen de Postgres; la redacción del intro y la
> prosa ejecutiva dependen de Ollama. Si Ollama está caído las cifras siguen siendo correctas,
> solo se pierde la narración.

---
---

# Q1 · Plan de pruebas

> ## ✅ CERRADO — 2026-08-24 · commit `7b1f061`
>
> **Resultado: 7/7 en `analizar`, todas por `regex`.** Ninguna depende ya de Ollama.
> Las 3 trampas de dominio dan `desconocido` por `regex+filtro` — la contención funciona.
>
> El ciclo giró completo: lote en Test Clas → feedback del usuario (Control 3) →
> patrones nuevos → golden ampliado → confirmación en vivo.
>
> El detalle de lo ejecutado está en **Resultado del lote**, al final de esta sección.

Estado verificado contra el código en `INGESTA/Rep_Prod/backend/app/features/consulta_v2/`.

---

## A. Regresión — deben pasar hoy

Variaciones léxicas de Q1 con verbo interrogativo explícito y producto nombrado.
Todas enrutan a **analizar · causal**.

| # | Pregunta | Qué prueba |
|---|----------|------------|
| A1 | ¿A qué se debe el gap de crudo del mes? | Canónica (baseline) |
| A2 | ¿Por qué se cayó el crudo este mes? | Sinónimo verbal ("cayó") |
| A3 | ¿Qué pasó con la producción de aceite? | Sinónimo producto ("aceite") |
| A4 | ¿Qué explica el faltante del periodo? | Sinónimo gap ("faltante") + sin producto |
| A5 | ¿Por qué no cumplimos la meta de crudo? | Formulación por negación |
| A6 | ¿Qué está jalando el crudo para abajo? | Registro coloquial |

**Riesgo real de este bloque:** el vocabulario de dominio. Si un sinónimo
(`gap`/brecha/faltante/déficit, `crudo`/petróleo/aceite) no está en
`config/vocabulario_dominio.yaml`, la pregunta cae a OUT.

**Es lo más valioso a medir aquí** y no requiere ninguna capacidad nueva.

Nota sobre **A4**: no nombra el producto. Verificar si asume crudo por default
(`cuantificar/slots.py:81-91` lo hace en su módulo) o si pide desambiguación.

---

## B. Dudosas — hay que probarlas para saber

Cada una aísla una hipótesis concreta sobre el clasificador. Son las más informativas.

| # | Pregunta | Hipótesis que aísla |
|---|----------|---------------------|
| B1 | ¿Qué nos pegó en crudo? | ¿"pegó" está en el vocabulario? Coloquial ejecutivo |
| B2 | Razones del incumplimiento en petróleo | ¿El clasificador depende de la forma interrogativa? |

**B2 es la más interesante:** sin signo de interrogación ni verbo interrogativo.
Si falla, revela que el clasificador se apoya en la forma y no en el contenido.

---

## C. Especificación — se espera que fallen

Documentadas como fallo conocido, con causa identificada. **No son regresión.**

| # | Pregunta | Por qué falla hoy |
|---|----------|-------------------|
| C1 | ¿Y eso por qué? *(tras el veredicto de crudo)* | El drill de continuación existe (`maquina_q.py:121-173`) pero sus tokens son CAUSA/CAUSAS/EXPLICA/EXPLICAN. "por qué" no matchea → `return None` (`maquina_q.py:154`) |

**C1 es el arreglo más barato identificado:** añadir "por qué"/"porque" a la lista de
tokens de ese drill. No requiere arquitectura nueva. Ver candidatos al final.

---

## D. Protocolo de prueba

**Sesión limpia por pregunta.** `_CTX` (`maquina_q.py:36`) guarda el turno anterior en
memoria de proceso. Una pregunta puede pasar por arrastre del contexto y no por mérito
propio — eso sería un falso positivo.

Excepción: **C1 requiere contexto previo** (es elíptica). Se prueba justo después de A1.

Para cada pregunta registrar:

| Campo | Qué anotar |
|-------|------------|
| Respuesta | ¿Contestó con cifras correctas? |
| Grupo | jerarquizar / cuantificar / analizar / desconocido |
| Vía | regex / regex+llm / llm / regex+llm_fallo |
| Calidad | ¿Accionable o genérica? |
| Brecha | ¿Qué debería haber respondido y no respondió? |

---

## E. Orden de ejecución

1. **A1–A6** en una tanda. Si todas pasan, el vocabulario está sano.
2. **B1–B2**, que son las que enseñan algo.
3. **C1** inmediatamente después de A1 (necesita el contexto).

---

## F. Candidatos de cambio de código

| # | Cambio | Estado |
|---|--------|--------|
| F1 | Añadir "por qué"/"porque" a los tokens del drill de analizar (`maquina_q.py:133-134`) | **Pendiente** — C1 no se probó |
| F2 | Añadir al vocabulario los sinónimos faltantes | ✅ Hecho — `PETROLEO`, `FALTANTE` |
| F3 | Extender `clasificacion_golden.yaml` con los casos verificados | ✅ Hecho — +10 casos (85 totales) |

Nota sobre F3: **no crear un YAML nuevo.** Ya existen tres golden con runner y gate ≥90 %
(`clasificacion_golden.yaml`, `cuantificar_golden.yaml`, `analizar_golden.yaml`).
Un archivo paralelo duplicaría formato sin ganar nada.

---

## Resultado del lote · 2026-08-24

### Antes (lote inicial, 7 preguntas)

| Pregunta | Grupo | Vía | Veredicto |
|---|---|---|---|
| ¿Por qué se cayó el crudo este mes? | Analizar | regex | ✓ |
| ¿Qué pasó con la producción de aceite? | Analizar | regex | ✓ |
| ¿Por qué no cumplimos la meta de crudo? | Analizar | regex | ✓ |
| Razones del incumplimiento en petróleo | Analizar | **llm** | ✓ |
| ¿Qué explica el faltante del periodo? | **Desconocido** | regex+filtro | ✗ → Analizar |
| ¿Qué está jalando el crudo para abajo? | **Desconocido** | llm | ✗ → Analizar |
| ¿Qué nos pegó en crudo? | **Cuantificar** | llm | ✗ → Analizar |

**3 de 7 por regex.** Tres correcciones del usuario = los casos verificados que
autorizaron el crecimiento de patrones.

### Diagnóstico

- `FALTANTE` no confirmaba dominio → el patrón `EXPLICA` sí atrapaba, pero el filtro
  descartaba la pregunta por no hallar vocabulario petrolero (`regex+filtro`).
- `JALANDO` y `NOS PEGÓ` no tenían patrón → caían al LLM, que enrutaba mal.
- `PETROLEO` faltaba en el vocabulario pese a que `CRUDO` y `ACEITE` ya estaban.

### Cambios aplicados (commit `7b1f061`)

**`patrones_grupo.yaml` · grupo `analizar`:**
`PEG[OA]\b` · `JALANDO` · `JALA[N]?\s+(PARA\s+)?ABAJO` · `RAZONES?\s+(DE|DEL)` · `MOTIVOS?\s+(DE|DEL)`

**Sin anclar, a propósito.** Son verbos del español común. Anclarlos repetiría el error
que ya obligó a retirar `META\b` y `COMO VAMOS` de `patrones_anclados` (nota 2026-08-02
del propio archivo). Con el filtro de dominio delante, "¿qué nos pegó en crudo?" entra
por `CRUDO` y una frase ajena no.

**`vocabulario_dominio.yaml`:** `PETROLEO`, `FALTANTE`

**`clasificacion_golden.yaml`:** +10 casos — los 3 corregidos, los 4 que ya pasaban
(guarda de no-regresión) y 3 trampas de dominio.

### Después

| Verificación | Resultado |
|---|---|
| Las 7 de Q1 | **7/7 `analizar`, todas por `regex`** |
| ¿Qué me pegó la semana pasada? | `desconocido` · regex+filtro ✅ |
| Razones del divorcio de mis vecinos | `desconocido` · regex+filtro ✅ |
| ¿Quién está jalando la cuerda más fuerte? | `desconocido` · regex+filtro ✅ |

La vía `regex+filtro` en las trampas es la confirmación clave: el patrón las atrapa
(como debe) y el filtro de dominio las rechaza por falta de vocabulario petrolero.

### Pendiente

- **C1 · "¿Y eso por qué?"** no se probó. Sigue fallando por diseño
  (`maquina_q.py:154`); el arreglo F1 está identificado pero no aplicado.
- El golden runner **no se ejecutó** — no hay Python en el equipo de desarrollo.
  La validación fue en vivo, en Test Clas. Conviene correrlo en el servidor:
  `PYTHONPATH=. uv run python app/features/consulta_v2/golden/run_golden.py`

---

## G. Fuera de alcance de Q1

Verificado que **no existe** en el sistema. No son fallos del bloque Q1; son ausencias
de capacidad, y probarlas aquí solo produciría ruido:

- **Validación de premisas falsas** — ninguna rama compara la entidad que afirma el
  usuario contra los detractores reales del gap. NO EXISTE.
- **Concentración del gap por la vía de cuantificar** — `concentracion_pct` solo se
  calcula con `metrica == "real" and direccion == "top"`; en gap devuelve siempre `None`
  (`ranking.py:236-239`, marcado como "muerto hoy" en `:397-401`). Afecta a **Q3**, no a Q1.
  La concentración de gap sí existe, pero en otra ruta: `analisis/api.py:1820` con umbral
  literal `>= 70` en `analizar/plantilla.py:85`.
- **Responsabilidad humana / atribución de culpa** como caso OUT — NO EXISTE.
- **Predicción futura como OUT** — al contrario, `proyeccion` es una sub-intención
  *soportada* de analizar.
