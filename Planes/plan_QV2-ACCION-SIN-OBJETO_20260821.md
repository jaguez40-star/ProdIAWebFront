# Plan QV2-ACCION-SIN-OBJETO — regla de buena formación en el grupo «desconocido»

> **Versión:** v2 auditada — pasos 1-3 del flujo de 6 (Mapeo → Auditoría → Diagnóstico)
> aplicados contra el código real (`ProdIA_V02/CLAUDE.md` §0).
> **Fecha:** 2026-08-21
> **Modo:** Planner. El executor implementa, no decide.
> **Origen:** conversación real en `/mainchat`. El bot ofreció *«¿Quieres ver la producción
> de CASTILLA o consultar otro campo o activo?»*; el usuario respondió *«Sí muestrame»* y
> recibió un rechazo de **fuera de dominio**. Regla pedida por el usuario: *«si se invoca
> una acción (verbo), debe haber una instancia sobre la que recaiga esa acción»*.

---

## 0. Marco normativo

**El único `CLAUDE.md` del workspace es `c:/APLICACIONES/ProdIA_V02/CLAUDE.md`** (§0-§11,
DT-1…DT-6). `ProdIA-2.0` no tiene uno propio; sus reglas de **método** (planner, flujo de
6 pasos, R3) aplican por analogía, las de **stack** (pnpm, vitest) no.

> ⚠️ No citar `§15`, `§17.5`, `DT-14/15/16`: **no existen**. Un plan anterior lo hizo y
> sus anclas resultaron inverificables. Toda regla de este plan cita algo comprobable.

**Este plan SÍ modifica el backend**, por autorización explícita del usuario al pedirlo.
Deroga, solo para este alcance, la restricción «el back queda como está» de los planes de
MainChat. Nada de MainChat ni del frontend se toca aquí.

---

## 1. Contexto

**Servicio:** `INGESTA/Rep_Prod/backend` — FastAPI + Python, feature `consulta_v2`
(Motor Q v2). Es un **proceso distinto** del Flask de ProdIA-2.0: Flask solo proxea
(`routes/api.py` → `INGESTA_API_URL`). Reiniciar Flask NO recarga este código.

### 1.1 El flujo real de una pregunta

```
clasificar(texto, cid)
  ├─ _continuacion(texto, _CTX[cid])      ← reescribe continuaciones cortas (≤5 tokens)
  └─ _clasificar_core(efectivo)
       ├─ clasificar_capa1  (regex, patrones_grupo.yaml)
       ├─ filtro de dominio (detectar_entidad + nivel_dominio)
       ├─ clasificar_capa2  (LLM) si la regex no resolvió
       └─ si grupo == "desconocido" y log:            ← RAMA OUT
            (B) no_soportado.detectar(texto) if ent_ctx  → rechazo determinista
            (A) respuesta_out.redactar_out(...)          → el LLM redacta "fuera de ámbito"
```

El caso del usuario entró por **(A)**: `no_soportado.detectar("Sí muestrame")` devolvió
`None` (solo cubre formas temporales) y el LLM redactó *«este asistente está enfocado
exclusivamente en…»* — una respuesta de **fuera de dominio** para una pregunta que está
**dentro** del dominio pero **incompleta**.

### 1.2 El diagnóstico en una línea

El bucket `desconocido` mete en la misma bolsa dos fallos que piden respuestas opuestas:

| Caso | Qué es | Respuesta correcta |
|---|---|---|
| «¿qué es la fotosíntesis?» | fuera de dominio | «eso está fuera de mi ámbito» |
| «sí muéstrame» | dentro, mal formada | «¿que te muestre **qué**?» |

---

## 2. Objetivo

Añadir un **tercer camino (C)** en la rama OUT: un detector determinista de preguntas
**mal formadas por falta de complemento**, que responde pidiendo el dato que falta en vez
de declarar la pregunta ajena al dominio.

**El grupo NO cambia: sigue siendo `desconocido`.** Solo cambia el `mensaje`. Esta es la
propiedad de seguridad central del plan — ver H4.

---

## 3. Hallazgos de la auditoría

### 3.1 🔴 La regla, tal como se enunció, rechazaría preguntas válidas

Si «instancia» se lee como *entidad del catálogo*, la regla rompe todo el tráfico global:

- «muéstrame el desempeño del mes» → sin entidad, **válida**
- «dame el ranking de campos» → sin entidad, **válida**
- «cuánto crudo produjo ECP» → sin entidad, **válida**

**Formulación correcta:** *verbo de acción ⇒ **complemento***, donde el complemento puede
ser una entidad **o** un objeto de dominio. «Sí muéstrame» falla porque no tiene ninguno
de los dos. La tercera condición del §7.2 es la que evita este falso positivo.

### 3.2 🔴 H4 — El golden **no puede** romperse, y hay que saber por qué

`golden/run_golden.py` asevera **únicamente el grupo**:

```python
acierto = got["grupo"] == c["esperado"]
```

Como este plan **nunca reasigna el grupo**, el gate del clasificador queda intacto por
construcción. Es la razón de fondo para colgar la regla en la rama OUT y no en el
clasificador.

### 3.3 🔴 H5 — Ya existe la regla SIMÉTRICA, y el golden la fija

`golden/clasificacion_golden.yaml` contiene:

```yaml
# ---- trampa: sin verbo clasificable (A3) → desconocido ----
- pregunta: "Castilla"        → desconocido
- pregunta: "y Cajúa?"        → desconocido
- pregunta: "dame Rubiales"   → desconocido
- pregunta: "hola"            → desconocido
```

Dos consecuencias importantes:

1. **La regla del usuario es la contraparte de A3.** A3 dice *instancia sin verbo
   clasificable → desconocido*; la nueva dice *verbo sin instancia → desconocido*. Encajan
   como pareja, no compiten.
2. **«dame Rubiales» tiene verbo Y entidad, y aun así es `desconocido`.** Porque `dame` no
   es un verbo *clasificable*: no dice qué hacer (¿producción? ¿estructura? ¿análisis?).
   → La nueva regla **no debe disparar** en ese caso (hay entidad), y su mensaje seguiría
   yendo al LLM. Ver D1: tratarlo también es una decisión de alcance, no un añadido gratis.

### 3.4 🟠 H1 — La regla documentada que se está violando (causa raíz)

`no_soportado.py` lleva escrito:

> 🔑 El mensaje NUNCA termina en una pregunta sí/no (H1): un «sí» del usuario cae en el
> drill de afirmación de `maquina_q._continuacion` y se reescribe a «acumulado de
> {entidad}» — es decir, entregaría el ACUMULADO en vez de lo ofrecido.

Pero el cierre que originó el caso sale de `respuesta_jerarquizar.py`:

```python
return f"ver la producción de {canonical} o consultar otro campo o activo"
```

Se emite como *«¿Quieres … ?»*: **sí/no sobre una disyuntiva**, justo lo que H1 prohíbe.
Este plan es la **red de seguridad**; el cierre es la **causa**. Ver D2.

### 3.5 🟠 H6 — Riesgo de solape léxico, con precedente de bug real

`maquina_q.py` ya declara cinco conjuntos de palabras clave y documenta un bug de orden:

| Conjunto | Contenido relevante |
|---|---|
| `_AFIRM` | SI, **DALE**, OK, OKEY, CLARO, BUENO, LISTO, SIP, VALE, ESO, ESA |
| `_PROD_KW` | PRODUCCION, PRODUJO, PRODUCE, PRODUCIDO, CUANTO(S), CUANTA(S) |
| `_ESTRUCT_KW` | PERTENECE, ACTIVO(S), GERENCIA(S), CAMPO(S), POZO(S), QUE ES, CUAL… |
| `_ACUM_KW` | ACUMULADO, EN EL ANO, DEL ANO, EN TOTAL, YTD |
| `_TEMP_CONT_KW` | MES A MES, VARIACION, COMO VARIO, SERIE, EVOLUCION |

> *«DEBE revisarse ANTES que `_ACUM_KW`: "promedio del año" contiene "DEL ANO" y sin este
> orden `_ACUM_KW` la capturaría primero (bug real 2026-08-02)»*

**`DALE` es a la vez afirmación y verbo de acción.** Añadirlo a la lista de verbos lo
robaría al drill de `_continuacion`. Ver R-4 y §7.2.a.

### 3.6 🟢 H7 — `_CTX` sobrevive a un turno `desconocido`

`clasificar()` solo escribe `_CTX` cuando el grupo resuelto es `jerarquizar`,
`cuantificar` o `analizar`. En `desconocido` el contexto anterior **queda intacto**.

Dos consecuencias: (a) el mensaje nuevo puede nombrar la entidad del contexto como
candidata, y (b) si aun así el usuario contesta «sí», el drill `ofrece_produccion` de
`_continuacion` sigue vivo y lo resuelve. La regla no rompe el hilo.

### 3.7 🟢 H8 — El vocabulario se carga una sola vez al arranque

`config/vocabulario_dominio.yaml` avisa: *«Se carga UNA vez al arranque del backend →
editar exige REINICIAR los backends»*. Este plan **no** edita ese YAML, pero sí código
Python: **el backend de INGESTA debe reiniciarse**. Reiniciar Flask no basta (§1).

### 3.8 🟢 H9 — Hay suite de tests y módulo espejo que copiar

`backend/tests/` tiene 25 archivos, entre ellos `test_no_soportado.py` (55 líneas), que es
la plantilla exacta: tests **puros**, sin BD ni LLM, sobre `detectar()` y `mensaje()`,
incluida una aserción explícita de H1 (`assert "¿Quieres" not in m`).
`pyproject.toml` declara `[tool.pytest.ini_options] pythonpath = ["."]`.

---

## 4. Decisiones del usuario — RESUELTAS (2026-08-21)

| # | Decisión | Resolución |
|---|---|---|
| **D1** | **Alcance** | ✅ **Solo `accion_sin_objeto`** — la regla que pidió el usuario. La forma simétrica `objeto_sin_accion` («dame Rubiales», «Castilla») queda **fuera de alcance**, §10. |
| **D2** | **Causa raíz** (el cierre de `respuesta_jerarquizar` viola H1) | ✅ **Plan aparte.** No se toca aquí. §10. |
| **D3** | **Lista de verbos** | ✅ **Aceptada con las adiciones del usuario**: `PRESENTAME`, `CUENTAME`, `EXPLICAME` (+ las formas base `PRESENTA` y `EXPLICA`). `MUESTRAME` ya figuraba. `CUENTA` sola queda **excluida**: es sustantivo del dominio («cuenta contable»). Ver §7.2.a. |

> Las tres están resueltas: el Paso 3 **ya no está bloqueado**. R-8 queda satisfecha.

---

## 5. Prerequisitos verificables

Anclas por `grep -c` contra el código real, **nunca por número de línea ni hash de commit**.
Desde `c:/APLICACIONES/ProdIA/ProdIA-2.0/INGESTA/Rep_Prod/backend`.

| # | Comando | Esperado |
|---|---|---|
| P1 | `grep -c "def detectar" app/features/consulta_v2/no_soportado.py` | `1` (módulo espejo) |
| P2 | `grep -c "def mensaje" app/features/consulta_v2/no_soportado.py` | `1` |
| P3 | `grep -c "no_soportado.detectar(texto) if ent_ctx else None" app/features/consulta_v2/maquina_q.py` | `1` (punto de enganche) |
| P4 | `grep -c "redactar_out(texto, usuario=usuario, contexto=ctx)" app/features/consulta_v2/maquina_q.py` | `1` |
| P5 | `grep -c "def nivel_dominio" app/features/consulta_v2/dominio.py` | `1` |
| P6 | `grep -c "def detectar_entidad" app/features/consulta_v2/*.py` | `≥1` |
| P7 | `grep -c 'got\["grupo"\] == c\["esperado"\]' app/features/consulta_v2/golden/run_golden.py` | `1` (H4: el golden solo mira el grupo) |
| P8 | `grep -c "dame Rubiales" app/features/consulta_v2/golden/clasificacion_golden.yaml` | `1` (H5) |
| P9 | `grep -c "_AFIRM = " app/features/consulta_v2/maquina_q.py` | `1` (H6) |
| P10 | `ls tests/test_no_soportado.py` | existe (plantilla) |
| P11 | `grep -c "pythonpath" pyproject.toml` | `1` |

> **Si P3, P4, P7 o P10 fallan → DETENERSE y reportar.** El plan se re-audita.

---

## 6. Inventario de archivos

| Archivo | Acción |
|---|---|
| `app/features/consulta_v2/incompleta.py` | **CREAR** — detector puro, ~70 líneas |
| `app/features/consulta_v2/maquina_q.py` | **MODIFICAR** — 1 import + 1 bloque en la rama OUT |
| `tests/test_incompleta.py` | **CREAR** — espejo de `test_no_soportado.py` |
| `app/features/consulta_v2/no_soportado.py` | **SOLO LECTURA** — plantilla |
| `config/*.yaml`, `golden/*` | **NO TOCAR** |
| Todo `ProdIA-2.0/` fuera de `INGESTA/` | **NO TOCAR** — MainChat y el frontend quedan fuera |

---

## 7. Especificación

### PASO 1 · Verificación previa

Ejecutar P1-P11 del §5. Si P3/P4/P7/P10 fallan → **DETENERSE**.

Confirmar además que ningún verbo de la lista de §7.2.a ya dispara un grupo en Capa 1
(si lo hiciera, esas frases nunca llegarían a la rama OUT y la regla sería inerte):

```bash
grep -inE "MUESTRA|MOSTRAR|ENSENA|DAME|TRAEME|GRAFICA|COMPARA|CALCULA|LISTAME|SACAME" \
     app/features/consulta_v2/config/patrones_grupo.yaml
```

Resultado esperado: **sin coincidencias en patrones activos**. Si alguno aparece,
retirarlo de la lista de verbos y **reportar** — no se toca el YAML (R-3).

---

### PASO 2 · Crear `incompleta.py`

Módulo **puro**: sin BD, sin LLM, sin I/O. Espejo conceptual de `no_soportado.py`.

**Cabecera literal:**

```python
"""incompleta.py — detector determinista de preguntas EN dominio y CON capacidad, pero MAL
FORMADAS por falta de complemento.

Tercer hermano de dominio.py (¿es del tema?) y no_soportado.py (¿está construido?). Este
responde una pregunta distinta: ¿la frase está completa?

Caso de origen (real, 2026-08-21): tras ofrecer "¿Quieres ver la producción de CASTILLA o
consultar otro campo o activo?", el usuario escribió "sí muéstrame". El verbo queda SIN
OBJETO: no dice qué mostrar. Resolverlo por contexto sería adivinar el sujeto — decisión
del usuario: eso es peor que preguntar. La clasificación 'desconocido' es CORRECTA; lo que
estaba mal era el TRATO (se respondía "fuera de mi ámbito" a una pregunta del tema).

🔑 NO reclasifica. El grupo sigue siendo 'desconocido' — solo cambia el mensaje. Por eso el
golden (que solo asevera el grupo, run_golden.py) no puede romperse por este módulo.

🔑 Verbo ⇒ COMPLEMENTO, no verbo ⇒ entidad. "muéstrame el desempeño del mes" es global y
válida: no tiene entidad pero sí objeto de dominio. Sin la tercera condición (nivel_dominio
is None) esta regla rechazaría todo el tráfico global.

🔑 El mensaje NUNCA termina en una pregunta sí/no (H1, misma regla que no_soportado.py): un
"sí" cae en el drill de afirmación de maquina_q._continuacion. El cierre pide un SUSTANTIVO.

Regex con \\b sobre texto NORMALIZADO (norm(): UPPER, sin acentos). Compilados en el import.
"""
```

**Contenido:**

#### 7.2.a — Lista de verbos (D3)

Lista **confirmada por el usuario (D3)**. Cubre tres familias de acción: mostrar/entregar
(`MUESTRAME`, `DAME`), graficar/calcular (`GRAFICAME`, `COMPARA`) y **narrar**
(`CUENTAME`, `EXPLICAME`, `PRESENTAME`) — esta última añadida por el usuario, y es la que
más se parece a la frase que originó el plan.

```python
_RX_VERBO_ACCION = re.compile(
    r"\b(MUESTRA|MUESTRAME|MOSTRAR|MOSTRARME|ENSENAME|ENSENAR|"
    r"VER|VEAMOS|VERLO|VERLA|DAME|DAMELO|DAMELA|TRAEME|TRAER|"
    r"GRAFICA|GRAFICAME|GRAFIQUEME|COMPARA|COMPARAME|"
    r"CALCULA|CALCULAME|LISTAME|SACAME|PONME|DESPLIEGA|"
    r"PRESENTA|PRESENTAME|CUENTAME|EXPLICA|EXPLICAME)\b")
```

> Nota de la revisión de D3: `MUESTRAME` ya figuraba en la lista original (2.ª posición).
> Las tres nuevas son `PRESENTAME`, `CUENTAME` y `EXPLICAME`; se añaden además las formas
> base `PRESENTA` y `EXPLICA`, seguras por no colisionar con vocabulario del dominio.

**Exclusiones deliberadas (H6, R-4):**

| Palabra | Por qué NO va |
|---|---|
| `DALE` | vive en `_AFIRM`; añadirla se la robaría al drill de `_continuacion` |
| `LISTO` | igual — está en `_AFIRM` |
| `CONSULTA` | colisiona con el nombre de la pestaña y con lenguaje común del producto |
| `LISTA` (sola) | sustantivo frecuente («la lista de campos»); solo se acepta `LISTAME` |
| **`CUENTA` (sola)** | **sustantivo del propio dominio**: «cuenta contable», «cuenta de resultados». Falso positivo garantizado. Solo se acepta `CUENTAME` |
| `ABRE`, `SACA` | valor marginal frente al riesgo de falso positivo |

#### 7.2.b — La función

```python
def detectar(texto, hay_entidad, nivel):
    """'accion_sin_objeto' si la frase invoca una acción sin nada sobre lo que recaiga.

    Las tres condiciones son conjuntivas y el orden importa poco (todas son puras), pero
    la tercera es la que evita el falso positivo del tráfico GLOBAL:
      1. hay verbo de acción
      2. hay_entidad is False   → no nombra una entidad del catálogo
      3. nivel is None          → tampoco trae objeto de dominio (ni fuerte ni estructural)

    Recibe `hay_entidad` y `nivel` YA CALCULADOS por el llamador en vez de llamar a
    detectar_entidad()/nivel_dominio() aquí: maquina_q._clasificar_core ya los tiene, y
    repetirlos sería trabajo doble además de acoplar este módulo puro al catálogo.
    """
```

Devuelve `"accion_sin_objeto"` o `None`.

#### 7.2.c — El mensaje

```python
def mensaje(codigo, entidad_ctx=None):
    """Pide el complemento que falta. Determinista, jamás pasa por el LLM.

    Con entidad en el hilo se NOMBRA como candidata — pero como candidata, no como
    resolución: la decisión vuelve al usuario. Sin contexto, se enumeran los tipos de
    complemento aceptados.

    H1: el cierre pide un SUSTANTIVO, nunca un sí/no.
    """
```

Dos formas exactas:

- **Con contexto:**
  «Me pediste que te muestre algo, pero no dijiste sobre qué. Puedo darte la producción de
  **{entidad_ctx}**, o nómbrame otro campo, activo o gerencia.»
- **Sin contexto:**
  «Me pediste que te muestre algo, pero no dijiste sobre qué. Nómbrame un campo, activo o
  gerencia, o dime si quieres producción, estructura o análisis.»

---

### PASO 3 · Enganchar en la rama OUT de `maquina_q.py`

**Bloquea hasta D1/D2/D3.**

Añadir el import junto a `no_soportado`, y en la rama OUT insertar el camino (C)
**entre** (B) y (A):

```python
        forma = no_soportado.detectar(texto) if ent_ctx else None
        if forma:
            mensaje = no_soportado.mensaje(forma, ent_ctx)
        # (C) La frase invoca una ACCIÓN sin nada sobre lo que recaiga. Va DESPUÉS de (B):
        #     "muéstrame el trimestre" es primero una capacidad no construida y solo después
        #     una frase incompleta — el rechazo honesto de (B) es más informativo.
        #     Va ANTES de (A): el LLM respondería "fuera de mi ámbito" a una pregunta que SÍ
        #     es del tema, solo que le falta el complemento.
        elif incompleta.detectar(texto, bool(entidad), nivel_dominio(texto)):
            mensaje = incompleta.mensaje("accion_sin_objeto", ent_ctx)
        else:
            mensaje = respuesta_out.redactar_out(texto, usuario=usuario, contexto=ctx)["texto"]
```

> 🔑 `entidad` es la variable que `_clasificar_core` ya calculó (backstop incluido). **No
> volver a llamar a `detectar_entidad`** — R-4.
>
> 🔑 **No tocar `grupo`.** Sigue valiendo `"desconocido"`. Si el executor siente la
> tentación de reclasificar, **DETENERSE**: rompería el golden y contradice la decisión
> explícita del usuario de que `desconocido` es la clasificación correcta.
>
> 🔑 El orden respecto a `_continuacion` ya es correcto y **no hay que hacer nada**:
> `clasificar()` llama a `_continuacion()` antes que a `_clasificar_core()`, así que una
> continuación que sí resuelve por contexto (un «sí» pelado con `ofrece_produccion`) se
> reescribe primero y nunca llega aquí.

---

### PASO 4 · Crear `tests/test_incompleta.py`

Espejo de `test_no_soportado.py`: puros, sin BD ni LLM.

**Positivos — deben disparar:**

| Entrada | `hay_entidad` | `nivel` |
|---|---|---|
| `"sí muestrame"` | False | None |
| `"muéstrame"` | False | None |
| `"dame"` | False | None |
| `"gráficame eso"` | False | None |
| `"cuéntame"` | False | None |
| `"explícame"` | False | None |
| `"preséntame eso"` | False | None |

> Los tres últimos son los verbos que añadió el usuario en D3. `norm()` pliega los acentos,
> así que `"cuéntame"` y `"cuentame"` deben dar el mismo resultado — **aserción explícita**.

**Negativos — NO deben disparar (§3.1, el riesgo de falso positivo):**

| Entrada | Por qué no |
|---|---|
| `"muéstrame el desempeño del mes"` con `nivel="fuerte"` | tiene objeto de dominio |
| `"dame el ranking de campos"` con `nivel="estructural"` | idem |
| `"muéstrame Castilla"` con `hay_entidad=True` | tiene instancia |
| `"dame Rubiales"` con `hay_entidad=True` | **H5** — es A3, no esta regla |
| `"hola"` | no hay verbo de acción |
| `"dale"` | **H6** — es afirmación, pertenece a `_AFIRM` |
| `"explícame el gap de crudo"` con `nivel="fuerte"` | tiene objeto de dominio (verbo nuevo de D3, mismo blindaje) |
| `"la cuenta contable"` | **D3** — `CUENTA` sola está excluida a propósito; si dispara, se coló en el regex |
| `""` | vacío |

**Del mensaje:**

- nombra la entidad del contexto cuando se le pasa
- **H1**: `assert "¿Quieres" not in m` y que no termine en `"?"` precedido de sí/no
- determinista: `assert not any(ch.isdigit() for ch in m)` (no inventa cifras)
- la variante sin contexto no nombra ninguna entidad

---

## 8. Reglas no negociables

| # | Regla |
|---|---|
| **R-1** | **Prohibido cambiar el `grupo`.** La regla altera el `mensaje` y nada más. |
| **R-2** | **Prohibido tocar** `golden/*`, `config/*.yaml`, `dominio.py`, `no_soportado.py`, `respuesta_out.py`, `patrones.py`. |
| **R-3** | **Prohibido tocar nada fuera de `INGESTA/Rep_Prod/backend/`.** MainChat y el frontend no entran en este plan. |
| **R-4** | **Cero refactors de oportunidad.** No recalcular entidad, no reordenar keywords, no «limpiar» `_AFIRM`. |
| **R-5** | `incompleta.py` es **puro**: sin BD, sin LLM, sin red, sin lectura de YAML. Si el executor necesita I/O, el diseño está mal → **DETENERSE**. |
| **R-6** | **Orden estricto** 1→4. Un paso falla → **DETENERSE** y reportar. |
| **R-7** | El executor **no declara «completada»** una feature conversacional (`ProdIA_V02/CLAUDE.md` §0 **R3**). Cierra con *«Validación conversacional humana ⏳ PENDIENTE»*. |
| **R-8** | D1, D2 y D3 confirmadas antes del Paso 3. |
| **R-9** | Grep de call sites antes de mover o eliminar cualquier símbolo. |
| **R-10** | Ninguna regla se justifica citando un documento sin verificar la cita (§0). |

---

## 9. Validaciones

### 9.a — Automáticas

Desde `INGESTA/Rep_Prod/backend`:

| # | Comando | Esperado |
|---|---|---|
| V1 | `python -c "import ast,sys; ast.parse(open('app/features/consulta_v2/incompleta.py',encoding='utf-8').read())"` | sin salida |
| V2 | `pytest tests/test_incompleta.py -v` | todos en verde |
| V3 | `pytest tests/test_no_soportado.py tests/test_consulta_v2_clasificador.py -v` | **sin regresión** |
| V4 | `pytest -q` | mismo número de fallos que en la línea base (medirla ANTES del Paso 2 y reportarla) |
| V5 | `python app/features/consulta_v2/golden/run_golden.py` | **misma tasa de acierto que la línea base** (medirla antes). H4 dice que no puede cambiar; si cambia, se violó R-1 |
| V6 | `grep -c "grupo" app/features/consulta_v2/incompleta.py` | `0` — el módulo no conoce el concepto de grupo |
| V7 | `grep -cE "import (psycopg|sqlalchemy)\|_llm\|requests" app/features/consulta_v2/incompleta.py` | `0` (R-5) |
| V8 | `git diff --stat -- MainChat/ static/ templates/ routes/ app.py` (desde la raíz del repo) | **vacío** (R-3) |

> V4 y V5 exigen **línea base medida antes de tocar nada**. Un plan que no la mide no puede
> distinguir «ya estaba roto» de «lo rompí yo».

### 9.b — Conversacional humana — 🔴 OBLIGATORIA

**Requiere reiniciar el backend de INGESTA** (H8). Reiniciar Flask no basta.

| # | Prueba | Criterio |
|---|---|---|
| C1 | «¿Qué es Castilla?» → luego «Sí muestrame» | Responde pidiendo el complemento y **nombra CASTILLA** como candidata. Ya no dice «fuera de mi ámbito» |
| C2 | Igual, y responder «Sí» a secas | Sigue funcionando el drill de `ofrece_produccion` (H7): entrega la producción |
| C3 | En frío, «muéstrame» | Mensaje sin contexto: enumera los tipos de complemento |
| C4 | «muéstrame el desempeño del mes» | **Responde normal.** Si pide complemento → falso positivo, se violó §3.1 |
| C5 | «dame el ranking de campos que más crudo producen» | Responde el ranking |
| C6 | «dame Rubiales» | Comportamiento **idéntico al de antes** (H5: es A3, no esta regla) |
| C7 | «¿qué es la fotosíntesis?» | Sigue respondiendo fuera de dominio, por el camino (A) |
| C8 | «¿cuánto produjo en el primer trimestre?» con Castilla en el hilo | Sigue dando el rechazo de `no_soportado` (camino B gana sobre C) |
| C9 | Badge en la UI | Sigue diciendo **Desconocido** — la clasificación no cambió, solo el trato |
| C10 | Con Castilla en el hilo: «cuéntame», «explícame», «preséntame» | Los tres verbos de D3 piden el complemento y nombran CASTILLA |
| C11 | «explícame el gap de crudo de Castilla» | **Responde normal.** Si pide complemento → falso positivo de los verbos nuevos |

---

## 10. Fuera de alcance

| Tema | Estado |
|---|---|
| **D1 · forma simétrica `objeto_sin_accion`** | «dame Rubiales», «Castilla», «y Cajúa?» — hay instancia pero ningún verbo clasificable. Merecen la misma cortesía («¿qué quieres saber de RUBIALES?»), pero el golden ya fija su grupo y tocarlos pide su propio plan. |
| **D2 · el cierre de `respuesta_jerarquizar`** | Viola H1 (`¿Quieres … ?` sobre una disyuntiva). Es la **causa raíz**; este plan es la red de seguridad. Plan aparte. |
| **Ampliar `_AFIRM` a afirmaciones de varias palabras** | «sí muéstrame», «ok dale» — `t in _AFIRM` compara la frase entera. Arreglarlo es otra decisión: haría que el motor **resuelva** en vez de **repreguntar**, que es justo lo contrario de lo que pidió el usuario. **No se hace sin decisión explícita.** |
| **Vocabulario de dominio** | `vocabulario_dominio.yaml` no se toca (R-2). |
| **Frontend / MainChat** | No se toca (R-3). El badge y el render de `desconocido` ya sirven. |
