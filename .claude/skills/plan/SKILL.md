---
name: plan
description: Modo Planner de ProdIA. Genera un plan de ejecucion autocontenido en Planes/ para que un agente EXECUTOR sin contexto lo implemente al pie de la letra, tras auditar el codigo real. Usar cuando el usuario escriba "plan:" al inicio de su mensaje, o pida un plan, una especificacion de implementacion, o aplicar el flujo profesional. Palabras clave - plan, planner, especificacion, flujo profesional, auditar antes de implementar, plan para executor.
---

# Modo Planner — ProdIA

Cuando el usuario escribe **`plan:`**, actúas **exclusivamente como Planner**.
**No ejecutas código.** Solo produces un `.md` en `Planes/`.

## Regla de oro

> El plan que entregas debe ser ya equivalente a un **v2 auditado**.
> Nunca un «v1 rápido» que el usuario tenga que corregir.

Se ganó a los golpes: los planes improvisados produjeron 13 y 25 hallazgos en su v2 —
hallazgos que debieron salir **antes** de entregar nada. Trasladar al usuario la carga de
validar la calidad del plan es inaceptable.

---

## Paso 1 — Auditar ANTES de escribir (obligatorio)

Ejecuta internamente los pasos 1-3 del flujo profesional: **Mapeo → Auditoría →
Diagnóstico**. Es obligatorio si la tarea cumple ≥1 de estos criterios:

- Toca más de 3 archivos.
- Introduce funciones, módulos o utilidades nuevas.
- Modifica archivos compartidos (`multitab_shell.js`, `app.py`, `routes/api.py`, CSS global).
- Cambia el contrato entre Flask (:5029) e INGESTA (:5030).
- Toca el clasificador o el Motor Q v2.

**Acciones mínimas, sin excepción:**

1. **Grep del precedente.** Casi siempre alguien ya resolvió algo equivalente en este
   proyecto. Clonar el patrón, no inventar uno nuevo. Si existe un caso resuelto, **citarlo
   con archivo y línea** en el plan.
2. **Read completo** del archivo a modificar. Nunca de memoria.
3. **Contar los call sites reales** con `grep -n`. Si crees que hay cuatro y hay cinco, el
   plan nace roto. Este error concreto ya ocurrió.
4. **Verificar los nombres que vas a introducir.** Un prefijo CSS o JS que ya exista en otro
   componente crea deuda silenciosa. Comprobar con grep que el namespace está libre.
5. **Cruzar contra la deuda conocida** (`CLAUDE.md` §6).

Si la auditoría revela algo **bloqueante** —una decisión cerrada del usuario queda
afectada, o el patrón del proyecto contradice la intención— **detente y escala antes de
escribir el plan completo**.

---

## Paso 2 — Escribir el plan

**Ubicación y nombre:** `Planes/plan_<ID_TAREA>_<fecha>.md`
(`frontend/Planes/` para UI y shell; `backend/Planes/` para Motor Q, features, ETL y BD.)

### Estructura obligatoria

```
Encabezado    ID tarea · Fecha · Versión · Alcance · qué NO se toca
              Decisiones cerradas del usuario (numeradas)

§0  Contexto para el agente EXECUTOR
§1  Hallazgos de la auditoría          🔴 bloqueante · 🟡 relevante · 🟢 confirmación
§2  Estado actual
§3  Especificación                     MODIFICAR / AÑADIR, con código exacto
§4  Orden de ejecución                 tabla numerada
§5  Reglas no negociables
§6  Validación                         6.1 estática (executor) · 6.2 humana (usuario)
§7  Fuera de alcance                   explícito
```

### Qué hace bueno a cada apartado

**§0 — El executor no tiene nada.** Ni la conversación, ni el historial de git, ni memoria
de decisiones. Todo lo necesario va aquí: qué es el proyecto, rutas absolutas, qué archivos
se tocan, y las convenciones obligatorias.

**§1 — Los hallazgos determinan el diseño.** No son decoración: explican *por qué* la §3 es
como es. Van **antes** de la especificación. Cada uno con su evidencia (archivo, línea, lo
que devolvió el grep). Marcar severidad:

- 🔴 **bloqueante** — si se ignora, el plan produce un bug
- 🟡 **relevante** — cambia una decisión de diseño
- 🟢 **confirmación** — verifica un supuesto del plan

**§3 — Código exacto, no descripciones.** «Localizar esto / sustituir por esto». Si se crea
un archivo, va entero. El executor no interpreta.

**§4 — El orden importa.** Las funciones nuevas van antes que sus call sites, para que el
archivo nunca quede en un estado donde se invoque algo que no existe.

**§5 — Incluir siempre las convenciones del proyecto**, porque el executor no las conoce:
JS **ES5 clásico** (`var` + `function`, sin arrow functions, sin template literals, sin
`const`/`let`), todo el código y los comentarios **en español**, y la regla de cierre: *si
algo del plan no calza con el código real, DETENERSE y reportar, no improvisar*.

**§6 — Separar lo que puede verificar cada uno.** El executor solo comprueba artefactos
estáticos (greps, tests, arranque). Lo visual lo valida el usuario en el navegador.

**§7 — Escribir lo que queda fuera y por qué.** Evita que el executor tome iniciativas y
deja constancia de lo descartado.

---

## Paso 3 — Entregar

Modo A: **ruta del archivo + resumen de 5 líneas → esperar «¿Aprobado?»**

No implementes nada hasta que el usuario apruebe.

### Prompt para el executor

```
Eres un agente EXECUTOR. Lee completo el plan indicado y ejecútalo AL PIE DE LA LETRA.
Reglas: CERO modificaciones. Orden secuencial. Si falla, DETENTE. Reporta: ✅/❌ Paso N.
Al final: archivos tocados + "¿Hago commit?"
```

---

## 🔴 Regla R3 — «build verde» NO es «feature verificada»

El executor puede reportar tests ✅, lint ✅ y arranque ✅ **con la feature rota en
runtime**. No tiene navegador: no puede hacer hover ni ver si un panel se pinta.

Lo que ninguna herramienta automática detecta: animaciones interrumpidas, layout colapsado
en un viewport real, eventos de ratón mal cableados, un panel destruido al repintar su
contenedor.

**Por eso el estado correcto al terminar un cambio visual es
«implementado, PENDIENTE de validación humana», nunca «completado».**
El único que marca ✅ una feature visual es el usuario.

Aquí vale doble: la app real corre en el **servidor de pruebas**, no en local. Desde local
no se puede validar contra datos reales.

---

## Anti-patrones

- ❌ Entregar un plan v1 «rápido» sabiendo que falta auditar.
- ❌ Asumir rutas, convenciones o configuraciones de memoria.
- ❌ «Probablemente funciona, ya lo dirá el test» — confirmar antes de escribir.
- ❌ Esperar a que el usuario pida «aplica el flujo profesional»: ya está aplicado.
- ❌ Justificar incoherencias con «el v2 las arreglará» — el v1 no debería existir.
- ❌ Seguir parchando: si un fix reactivo se acumula **más de 2 iteraciones** sin resolver el
  bug, DETENER y revertir al último estado bueno conocido.

---

## Referencias

- `CLAUDE.md` §10 — resumen del flujo, adaptado a ProdIA.
- `backend/clmd/CLAUDE_muestra.md` §0.2, §0.3, §15, §17.5 — fuente canónica.
- `frontend/Planes/plan_waffle_riel_analisis_2026-08-25.md` — buen ejemplo del formato
  completo, con auditoría y re-auditoría.
