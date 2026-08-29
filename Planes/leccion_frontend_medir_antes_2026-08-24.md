# Lección aprendida · Depurar frontend: medir antes de razonar

**Fecha:** 2026-08-24
**Costo:** ~3 horas para dos bugs de CSS/JS que, medidos, se resolvieron en un paso cada uno.
**Commits:** `c0667e8`, `35ed171`, `d9aedf0`, `94b0565` (scroll de Insights) · `d4b85a4` (pie del Historial)

---

## Los dos bugs

| | Scroll de Insights | Sección de pie del Historial |
|---|---|---|
| **Síntoma** | El panel no bajaba al último gráfico | El bloque de usuario no se anclaba al fondo |
| **Intentos fallidos** | 3 | 2 |
| **Causa real** | Un listener en `document` capturaba el scroll del **chat** y abortaba la bajada del panel | `#mc-historial-body` computaba `display:block` pese a la regla `display:flex` para ese id |
| **Cómo apareció** | Traza en la app real: *"abortado: el usuario movio el scroll"* en un navegador headless donde nadie tocó nada | Medir `getComputedStyle().display` en vez de leer el archivo CSS |
| **Tiempo tras medir** | 1 iteración | 1 iteración |

---

## Qué salió mal

### 1. Razonar sobre el archivo en vez del valor computado

El CSS **decía** `display:flex`. El archivo servido por Flask **traía** `display:flex`.
El elemento computaba `display:block`.

Leer el archivo tres veces no revela eso. Una sola línea sí:

```js
getComputedStyle(document.getElementById('mc-historial-body')).display
```

**Regla:** en CSS, lo que vale es el valor *computado*, no el declarado. Entre uno y otro
hay cascade, especificidad, orden de hojas, reglas de otros archivos y estilos en línea.

### 2. Reconstruir el DOM de memoria para "probar"

Los tres intentos del scroll se validaron con páginas HTML de prueba escritas a mano,
reproduciendo la estructura *supuesta* del panel. Todas pasaban. El bug seguía.

El DOM real tenía dos diferencias decisivas que la reconstrucción no tenía:
- `#mc-insights-cuerpo` es `overflow:hidden`, no `auto` (se asumió que era el scroller).
- El chat auto-scrollea al pintar la respuesta, y ese evento contaminaba el listener global.

**Regla:** un test que reproduce el DOM que uno imagina valida la imaginación, no el código.

### 3. Cambiar código sin subir el cache-bust

Una medición dio "no aplica la regla" porque el navegador servía el CSS anterior:
se editó `historial.css` sin tocar el `?v=` de `mainchat_layout.html`.

**Regla:** editar un `.css`/`.js` de este repo y **no** subir su `?v=` en las plantillas
que lo cargan invalida cualquier prueba posterior. Es parte del cambio, no un extra.

### 4. Resolver el problema que no se pidió

Se pidió *"crea una sección en la parte inferior y ubica el bloque ahí"*.
Se atacó el anclaje del pie ya existente, asumiendo que era el bug de `margin-top:auto`
documentado en `34db74e`. Dos iteraciones perdidas antes de leer literalmente la petición.

**Regla:** si el usuario describe **qué construir**, construirlo. No inferir que en realidad
se refiere a un bug conocido de esa misma zona.

---

## Procedimiento para la próxima vez

Ante un bug de layout o comportamiento en el navegador:

1. **Levantar la app** (ver `SETUP_LOCAL.md`). Sin esto, todo lo demás es adivinar.
2. **Medir el valor computado** del elemento sospechoso —`display`, `flexGrow`,
   `marginTop`, `scrollHeight`/`clientHeight`— antes de abrir ningún archivo.
3. **Instrumentar el código real** con `console.log` temporal si el flujo es asíncrono.
   La traza dice qué rama se tomó; el archivo solo dice qué ramas existen.
4. **Un cambio, una medición.** Nada de dos hipótesis por iteración.
5. **Subir el `?v=`** de cada asset tocado, siempre.

### Señal de alarma

**Si van dos intentos fallidos, parar y medir.** El tercer intento a ciegas nunca
acierta y cuesta lo mismo que la medición que sí lo resuelve.

---

## Lo que sí funcionó

Levantar el entorno local (~40 min, ver `SETUP_LOCAL.md`) resolvió **ambos** bugs en
una iteración cada uno, después de 5 intentos fallidos entre los dos. La inversión se
paga sola en el primer bug de frontend que se depure con ella.
