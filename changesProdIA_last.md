# Cambios ProdIA — 5 al 12 de agosto de 2026

> **Nota:** todo el trabajo de este período se hizo el **11 de agosto**. Entre el 5 y el 10 no hay
> ningún commit, y el 12 tampoco. La bitácora de la guia sigue cerrada en 2026-08-04, así que
> este período **no está registrado allí**.

**11 commits, todos del 2026-08-11** (`b1e5086` … `0a43f25`).

---

## 1. Pila acumulativa de resultados en el panel derecho de Consulta

Cuatro commits sobre una misma funcionalidad, iterando con capturas del usuario:

- **`b0c4c8d`** — Antes, cada respuesta del Motor Q v2 (KPI, serie, variación, ranking)
  **reemplazaba** el panel derecho y borraba la anterior. Ahora los resultados se apilan en un
  contenedor nuevo `#cn-stack`, en orden cronológico, con cabecera (pregunta + hora), autoscroll al
  bloque nuevo, y persisten al cambiar de pestaña, colapsar/reabrir el panel y remontar el shell.
  Tope silencioso de 100 bloques. Plan auditado en 2 rondas (7 supuestos falsos corregidos contra el
  código real antes de codificar).
- **`d4116d0`** — Tres cabos sueltos: si preguntabas y cambiabas de pestaña antes de la respuesta,
  **el panel se perdía en silencio** (ahora se encola y se restaura); `unmount` guardaba en un caché
  que `mount` siempre descartaba (código muerto con comentario que afirmaba lo contrario); y
  endurecimiento de la restauración para que no destruya bloques recién llegados.
- **`7ae2ee0`** — El reporte inicial *parecía* perderse al llegar el primer resultado (nunca se
  destruía). Tres causas, todas de visibilidad: el riel seguía marcando "Desempeño del mes" como
  Activo; el modo pila exigía además caché con contenido; y `renderViewer` destruía la pila sin
  salvarla.
- **`b77144a`** — Cambio estructural: análisis y pila dejan de ser **excluyentes**. Nuevo contenedor
  `.cn-col` como único scroller — el **Panorama general queda apilado arriba** (singleton, se
  reemplaza en sitio) y los resultados debajo, en un scroll único.

## 2. Panel de árbol jerárquico para JERARQUIZAR (`7ed529a`)

El grupo Jerarquizar del Motor Q v2 gana panel derecho, apilado igual que Cuantificar.
`responder_cordial()` pasa a devolver `{mensaje, panel}` con 3 tipos nuevos (`jerarq_arbol`,
`jerarq_operador`, `jerarq_rank`).

Hallazgos de auditoría que corrigieron el diseño:

- El conteo de pozos abre conexión a **otra base** sin caché → se reusa el valor ya calculado.
- La jerarquía **no es lineal**: un activo puede colgar de varias gerencias.
- Una Vicepresidencia muestra **varios grupos de hijos a la vez** (Gerencias, Activos y Campos).
- "Operador" **no es un nivel** de la jerarquía → tipo de panel propio, sin árbol.

## 3. Identidad de color por producto (`3d3f59e`, `39c854f`)

Crudo/Gas/Blancos dejan de compartir hex con la paleta de **estado** y ganan identidad propia: verde
petróleo / rojo llama / amarillo tubería, con variante de texto oscurecida y contraste WCAG AA
verificado. El icono de Blancos cambia de gota a surtidor (era casi idéntico al de Crudo). El estado
sigue leyéndose en el chip y el anillo — las dos paletas conviven, cada una en su rol.

El fix posterior completó la **4ª vía** de la especificación (que quedó definida pero sin usar) y
endureció un guard de hex que validaba longitud pero no que fueran dígitos.

## 4. Tarjeta de ranking: dot plot + dona (`ff09a3d`, `0fd517f`, `0a43f25`)

- Dot plot con identidad de producto para el ranking N5 de Cuantificar. **Bifurca por métrica, no
  reemplaza**: la lista plana sigue sirviendo a las variantes por "gap", que dan valores negativos.
- Dona de participación en % a la derecha del dot plot. Los **bbl viven solo en el dot plot y el %
  solo en la dona** — sin cifras duplicadas. La dona no muestra volúmenes porque el total se deriva
  de un valor redondeado (banda de ±0,22%, ~194.000 bbl); muestra porcentajes y conteo de campos.
- De paso se arregló un defecto de accesibilidad **preexistente**: un `role="img"` en la raíz
  ocultaba a lectores de pantalla todo el contenido interno.
- Clamp defensivo del % de concentración (hoy matemáticamente imposible de superar, pero protege la
  geometría ante cambios futuros).

## 5. Documentación (`b1e5086`)

Anonimizado el nombre del solicitante en el backlog de épicas, la bitácora de julio y un comentario
de código. Sin cambios de comportamiento.

---

**Alcance técnico:** todo el período es **frontend** (`static/js/multitab_shell.js`,
`static/css/colapsable.css`, `templates/main.html`), salvo el panel de Jerarquizar, que sí tocó
Python. **Cero cambios de BD y cero cambios de contrato de backend.**
