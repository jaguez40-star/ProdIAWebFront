// =====================================================================
// MultiTab Shell — integración real en "Análisis Avanzado"
// Adaptado de Colapsable/static/js/colapsable.js (prototipo mock).
// Usa las funciones ig* reales de chat.js — sin datos mock.
// =====================================================================

(function () {
  "use strict";

  var TABS = [
    { id: "ingesta", label: "Ingesta", icon: "cloud-arrow-up-fill", sub: "Cargar y mapear reporte" },
    { id: "control", label: "Control", icon: "sliders2", sub: "Parámetros y reglas" },
    { id: "analisis", label: "Análisis", icon: "graph-up-arrow", sub: "Vistas avanzadas" },
    { id: "consulta", label: "Consulta", icon: "chat-dots", sub: "Preguntas en lenguaje natural" },
    // [2026-07-30] Laboratorio del clasificador de grupo (Motor Q v2 · Fase 1)
    { id: "testclas", label: "Test Clas", icon: "clipboard2-check", sub: "Laboratorio del clasificador (Motor v2)" },
  ];

  var state = {
    activeTab: "ingesta",
    collapsed: false,
    mounted: false,
    savedState: null,
    ingestaBodyCache: null,
    ingestaViewerCache: null,
    consultaStackCache: null,   // DocumentFragment con los hijos de #cn-stack fuera de pantalla
  };

  function esc(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function el(id) { return document.getElementById(id); }

  // [2026-08-04] Restricción por usuario: SOLO "Javier Guerrero" ve todas las pestañas del shell;
  // cualquier otro usuario ve únicamente "Consulta". Gate frontend (nombre desde la sesión Flask
  // via window.USER_FULL_NAME). Tolerante a mayúsculas/espacios.
  function __cnSoloConsulta() {
    try {
      return String(window.USER_FULL_NAME || "").trim().toLowerCase() !== "javier guerrero";
    } catch (e) { return true; }
  }

  function tabDef(id) {
    for (var i = 0; i < TABS.length; i++) if (TABS[i].id === id) return TABS[i];
    return TABS[0];
  }

  // [2026-08-25] WAFFLE-NAV · tabDef() NUNCA devuelve falsy: cae a TABS[0] para que el rail y el
  // header del panel siempre tengan icono/label (sus 3 llamadores hacen def.icon / def.label sin
  // guarda). Por eso la comprobación de existencia va aparte: cambiar tabDef rompería :342, :493
  // y :624 con TypeError.
  function tabExiste(id) {
    for (var i = 0; i < TABS.length; i++) if (TABS[i].id === id) return true;
    return false;
  }

  // ---------- Shell HTML (extracted from colapsable_layout.html) ----------
  function shellHTML() {
    return (
      '<div class="colapsable-layout">' +
      '<div class="rb-cp" id="rb-cp">' +

      // Zona 1: Rail
      '<div class="rb-cp__rail" role="tablist" aria-orientation="vertical" aria-label="Secciones del panel">' +
      '  <div class="rb-cp__rail-logo" aria-hidden="true"><span><i class="bi bi-hexagon-fill"></i></span></div>' +
      '  <button type="button" role="tab" id="cp-tab-ingesta" data-tab="ingesta"' +
      '    class="rb-cp__tab is-active" aria-selected="true" aria-controls="rb-cp-panel-body" tabindex="0" title="Ingesta">' +
      '    <i class="bi bi-cloud-arrow-up-fill rb-cp__tab-icon" aria-hidden="true"></i>' +
      '    <span class="rb-cp__tab-label">Ingesta</span></button>' +
      '  <button type="button" role="tab" id="cp-tab-control" data-tab="control"' +
      '    class="rb-cp__tab" aria-selected="false" aria-controls="rb-cp-panel-body" tabindex="-1" title="Control">' +
      '    <i class="bi bi-sliders2 rb-cp__tab-icon" aria-hidden="true"></i>' +
      '    <span class="rb-cp__tab-label">Control</span></button>' +
      '  <button type="button" role="tab" id="cp-tab-analisis" data-tab="analisis"' +
      '    class="rb-cp__tab" aria-selected="false" aria-controls="rb-cp-panel-body" tabindex="-1" title="Análisis">' +
      '    <i class="bi bi-graph-up-arrow rb-cp__tab-icon" aria-hidden="true"></i>' +
      '    <span class="rb-cp__tab-label">Análisis</span></button>' +
      '  <button type="button" role="tab" id="cp-tab-consulta" data-tab="consulta"' +
      '    class="rb-cp__tab" aria-selected="false" aria-controls="rb-cp-panel-body" tabindex="-1" title="Consulta">' +
      '    <i class="bi bi-chat-dots rb-cp__tab-icon" aria-hidden="true"></i>' +
      '    <span class="rb-cp__tab-label">Consulta</span></button>' +
      '  <button type="button" role="tab" id="cp-tab-testclas" data-tab="testclas"' +
      '    class="rb-cp__tab" aria-selected="false" aria-controls="rb-cp-panel-body" tabindex="-1" title="Test Clas">' +
      '    <i class="bi bi-clipboard2-check rb-cp__tab-icon" aria-hidden="true"></i>' +
      '    <span class="rb-cp__tab-label">Test Clas</span></button>' +
      '</div>' +

      // Zona 2: Panel
      '<section class="rb-cp__panel" id="rb-cp-panel" aria-label="Panel Ingesta">' +
      '  <header class="rb-cp__panel-head">' +
      '    <button type="button" class="rb-cp__panel-head-collapse" id="rb-cp-back" aria-label="Volver al chat" title="Volver" style="order:-1">' +
      '      <i class="bi bi-arrow-left" aria-hidden="true"></i></button>' +
      '    <i class="bi bi-cloud-arrow-up-fill rb-cp__panel-head-icon" id="rb-cp-head-icon" aria-hidden="true"></i>' +
      '    <span class="rb-cp__panel-head-title" id="rb-cp-head-title">INGESTA</span>' +
      '    <span class="rb-cp__panel-head-brand">PRODIA</span>' +
      '    <button type="button" class="rb-cp__panel-head-collapse" id="rb-cp-collapse" aria-label="Colapsar panel">' +
      '      <i class="bi bi-dash-lg" aria-hidden="true"></i></button>' +
      '  </header>' +
      '  <div class="rb-cp__panel-body" role="tabpanel" id="rb-cp-panel-body" aria-labelledby="cp-tab-ingesta"></div>' +
      '</section>' +

      // Zona 3: Viewer
      '<section class="rb-cp__viewer" id="rb-cp-viewer" aria-label="Visualizador"></section>' +

      '</div></div>'
    );
  }

  // ---------- Render: Ingesta body (real upload card + real containers) ----------
  function renderIngestaBody() {
    return (
      '<div style="padding:1rem;">' +
      '  <div class="rb-cp-upcard">' +
      '    <div class="rb-cp-upcard__head">' +
      '      <i class="bi bi-cloud-arrow-up-fill" aria-hidden="true"></i>' +
      '      <div><strong>Cargar Reporte Diario</strong>' +
      '      <small>nombre con fecha YYYYMMDD</small></div>' +
      '      <span class="rb-cp-upcard__new" id="ingesta-mode-badge"></span>' +
      '    </div>' +
      '    <div style="padding:10px 12px;">' +
      '      <input type="file" id="ingesta-file" accept=".xlsm,.xlsx" hidden onchange="window.igOnFileInput(event)">' +
      '      <div id="ingesta-filezone"></div>' +
      '      <button id="ingesta-upload-btn" class="rb-cp-upcard__submit" disabled onclick="window.handleIngestaUpload()">' +
      '        <i class="bi bi-box-arrow-in-down" aria-hidden="true"></i> CARGAR E INGERIR</button>' +
      '    </div>' +
      '  </div>' +
      '  <div id="ingesta-sheets" class="mt-3"></div>' +
      '  <div id="ingesta-status" class="mt-3"></div>' +
      '</div>'
    );
  }

  // ---------- Render: placeholders Control / Análisis ----------
  function renderEmptyBody(tab) {
    return (
      '<div class="rb-cp-empty">' +
      '  <div class="rb-cp-empty__eyebrow">' + esc(tab.label) + '</div>' +
      '  <h6 class="rb-cp-empty__title"><i class="bi bi-' + tab.icon + '" aria-hidden="true"></i> ' + esc(tab.label) + '</h6>' +
      '  <p class="rb-cp-empty__sub">Contenedor reservado — sin contenido aún</p>' +
      '  <div class="rb-cp-empty__drop">' +
      '    <div><i class="bi bi-plus-square-dotted" aria-hidden="true"></i>' +
      '    <span>' + esc(tab.sub) + '</span></div>' +
      '  </div></div>'
    );
  }

  function renderControlBody() {
    return (
      '<div style="padding:1rem;">' +
      '  <div class="rb-cp-ctrl-head">' +
      '    <i class="bi bi-database-check" aria-hidden="true"></i>' +
      '    <div><strong>Reportes Ingeridos</strong>' +
      '    <small>Navegación por fecha</small></div>' +
      '  </div>' +
      '  <div id="control-tree" class="mt-3">' +
      '    <div class="d-flex align-items-center gap-2 p-3 text-muted">' +
      '      <div class="spinner-border spinner-border-sm"></div> Cargando árbol…</div>' +
      '  </div>' +
      '</div>'
    );
  }

  function fetchArbolReportes() {
    fetch("/api/tablas-hoja/arbol")
      .then(function (r) { return r.json(); })
      .then(function (data) { renderArbolTree(data); })
      .catch(function (e) {
        var box = el("control-tree");
        if (box) box.innerHTML = '<div class="alert alert-danger m-2">Error cargando árbol: ' + e + '</div>';
      });
  }

  var nfCtrl = function (x) { return Number(x).toLocaleString("es-CO"); };

  function renderArbolTree(data) {
    var box = el("control-tree");
    if (!box) return;
    if (!data || !data.length) {
      box.innerHTML = '<div class="p-3 text-muted"><i class="bi bi-inbox"></i> No hay reportes ingeridos.</div>';
      return;
    }

    var html = '<ul class="ct-tree">';
    data.forEach(function (anio) {
      html += '<li class="ct-node ct-year is-open">' +
        '<div class="ct-hd" onclick="window.__ctToggle(this)">' +
        '<i class="bi bi-chevron-right ct-chev"></i>' +
        '<i class="bi bi-calendar3"></i> <strong>' + anio.anio + '</strong></div>' +
        '<ul class="ct-kids">';
      anio.meses.forEach(function (mes) {
        html += '<li class="ct-node ct-month is-open">' +
          '<div class="ct-hd" onclick="window.__ctToggle(this)">' +
          '<i class="bi bi-chevron-right ct-chev"></i>' +
          '<i class="bi bi-calendar-month"></i> ' + esc(mes.mes_nombre) + '</div>' +
          '<ul class="ct-kids">';
        mes.dias.forEach(function (dia) {
          var badge = dia.tipo === "NEW"
            ? '<span class="ig-badge ig-badge--green">' + dia.tipo + '</span>'
            : '<span class="ig-badge ig-badge--blue">' + dia.tipo + '</span>';
          // Las hojas/tablas de este dia se cargan al expandir (window.__ctToggleDia), no aqui:
          // agregarlas para TODOS los dias de una sola vez escala mal cuando fact_tabla_hoja
          // tiene decenas de millones de filas (ver /tablas/arbol/<reporte_id>).
          html += '<li class="ct-node ct-day">' +
            '<div class="ct-hd" onclick="window.__ctToggleDia(this,' + dia.reporte_id + ')">' +
            '<i class="bi bi-chevron-right ct-chev"></i>' +
            '<i class="bi bi-file-earmark-spreadsheet"></i> <strong>' +
            String(dia.dia).padStart(2, "0") + '</strong> ' + badge +
            '<small class="ct-archivo" title="' + esc(dia.archivo) + '">' +
            esc((dia.archivo || "").substring(0, 30)) + '</small></div>' +
            '<ul class="ct-kids">' +
            '<li class="p-2 text-muted small">Clic para ver hojas…</li>' +
            '</ul></li>';
        });
        html += '</ul></li>';
      });
      html += '</ul></li>';
    });
    html += '</ul>';
    box.innerHTML = html;
  }

  window.__ctToggle = function (hd) {
    var li = hd.parentElement;
    if (li) li.classList.toggle("is-open");
  };

  function buildHojasHtml(reporteId, hojas) {
    var h = "";
    hojas.forEach(function (hoja) {
      h += '<li class="ct-node ct-hoja">' +
        '<div class="ct-hd ct-hd--leaf" onclick="window.__ctToggle(this)">' +
        '<i class="bi bi-chevron-right ct-chev"></i>' +
        '<i class="bi bi-file-earmark"></i> ' + esc(hoja.hoja) +
        ' <span class="ig-badge ig-badge--gray">' + hoja.tablas.length +
        (hoja.tablas.length === 1 ? " tabla" : " tablas") + '</span></div>' +
        '<ul class="ct-kids">';
      hoja.tablas.forEach(function (t) {
        h += '<li class="ct-leaf">' +
          '<button type="button" class="ig-trow" onclick="window.verTablaHoja(' +
          reporteId + ',\'' + esc(hoja.hoja).replace(/'/g, "\\'") + '\',' +
          t.tabla_idx + ',\'' + esc(t.tabla_label).replace(/'/g, "\\'") + '\')">' +
          '<i class="bi bi-table"></i>' +
          '<span class="ig-trow__name">' + esc(t.tabla_label) + '</span>' +
          '<span class="ig-badge ig-badge--gray">' + nfCtrl(t.filas) + ' filas</span>' +
          '</button></li>';
      });
      h += '</ul></li>';
    });
    return h;
  }

  // Carga perezosa de hojas/tablas al expandir un dia (evita agregar fact_tabla_hoja completa
  // por adelantado para los 86+ reportes -- ver /tablas/arbol/<reporte_id>). Solo hace fetch
  // la primera vez que se expande cada dia (dataset.loaded), luego reusa lo ya cargado.
  window.__ctToggleDia = function (hd, reporteId) {
    var li = hd.parentElement;
    if (!li) return;
    li.classList.toggle("is-open");
    if (li.dataset.loaded) return;
    li.dataset.loaded = "1";
    var kids = li.querySelector(".ct-kids");
    if (!kids) return;
    kids.innerHTML = '<li class="d-flex align-items-center gap-2 p-2 text-muted small">' +
      '<div class="spinner-border spinner-border-sm"></div> Cargando hojas…</li>';
    fetch("/api/tablas-hoja/arbol/" + reporteId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var hojas = (data && data.hojas) || [];
        kids.innerHTML = hojas.length
          ? buildHojasHtml(reporteId, hojas)
          : '<li class="p-2 text-muted small">Sin hojas modeladas para este reporte.</li>';
      })
      .catch(function () {
        kids.innerHTML = '<li class="p-2 text-danger small">Error cargando hojas.</li>';
        li.dataset.loaded = "";
      });
  };

  function saveIngestaDOM() {
    var body = el("rb-cp-panel-body");
    var viewer = el("rb-cp-viewer");
    if (body && body.firstChild && !state.ingestaBodyCache) {
      var frag = document.createDocumentFragment();
      while (body.firstChild) frag.appendChild(body.firstChild);
      state.ingestaBodyCache = frag;
    }
    if (viewer && viewer.firstChild && !state.ingestaViewerCache) {
      var frag2 = document.createDocumentFragment();
      while (viewer.firstChild) frag2.appendChild(viewer.firstChild);
      state.ingestaViewerCache = frag2;
    }
  }

  // Guarda los bloques de la pila de Consulta como nodos DOM (patrón de saveIngestaDOM). A diferencia
  // de esa, SIN la guarda "&& !state.consultaStackCache": cada salida debe reflejar el estado más
  // reciente de la pila, no solo la primera. El "if (stack.firstChild)" evita machacar un cache
  // bueno con uno vacío si esta función se invocara dos veces seguidas sin restaurar entre medias.
  // Los bloques del DOM se ANEXAN al cache (no lo reemplazan): mientras la pestaña está fuera de
  // pantalla, __cnStackEnsure encola ahí los paneles que van llegando — reemplazarlo los perdería.
  function saveConsultaStackDOM() {
    var stack = el("cn-stack");
    if (stack && stack.firstChild) {
      var frag = state.consultaStackCache || document.createDocumentFragment();
      while (stack.firstChild) frag.appendChild(stack.firstChild);
      state.consultaStackCache = frag;
    }
  }

  function renderPanelBody() {
    var body = el("rb-cp-panel-body");
    if (!body) return;

    // Layout por defecto (bloque con scroll+padding). Consulta lo cambia a chat flex-column.
    body.style.display = "";
    body.style.flexDirection = "";
    body.style.padding = "";
    body.style.overflow = "";

    if (state.activeTab === "ingesta") {
      if (state.ingestaBodyCache) {
        body.innerHTML = "";
        body.appendChild(state.ingestaBodyCache);
        state.ingestaBodyCache = null;
      } else {
        body.innerHTML = renderIngestaBody();
        if (window.igRenderDropzone) window.igRenderDropzone();
      }
    } else if (state.activeTab === "control") {
      body.innerHTML = renderControlBody();
      fetchArbolReportes();
    } else if (state.activeTab === "analisis") {
      body.innerHTML = renderAnalisisBody();
    } else if (state.activeTab === "consulta") {
      // El chat vive en el panel IZQUIERDO. Modo flex-column: mensajes scrollean, input fijo abajo.
      body.style.display = "flex";
      body.style.flexDirection = "column";
      body.style.padding = "0";
      body.style.overflow = "hidden";
      body.innerHTML = renderConsultaBody();
      __cnReplay();   // repinta el historial (o siembra el saludo inicial)
    } else if (state.activeTab === "testclas") {
      // [2026-07-30] Laboratorio del clasificador (Motor v2): chat de prueba propio (__tc*)
      body.style.display = "flex";
      body.style.flexDirection = "column";
      body.style.padding = "0";
      body.style.overflow = "hidden";
      body.innerHTML = renderTestClasBody();
      __tcReplay();
    } else {
      body.innerHTML = renderEmptyBody(tabDef(state.activeTab));
    }
  }

  // ---------- Viewer ----------
  function viewerEmpty(icon, eyebrow, hint, gold, headIcon, headTitle) {
    return (
      '<div class="rb-cp-vhead">' +
      '  <i class="bi bi-' + headIcon + '" aria-hidden="true"></i>' +
      '  <span class="rb-cp-vhead__title' + (gold ? " is-gold" : "") + '">' + esc(headTitle) + '</span></div>' +
      '<div class="rb-cp-vempty"><div class="rb-cp-vempty__inner">' +
      '  <div class="rb-cp-vempty__chip"><i class="bi bi-' + icon + '" aria-hidden="true"></i></div>' +
      '  <div class="rb-cp-vempty__eyebrow">' + esc(eyebrow) + '</div>' +
      '  <p class="rb-cp-vempty__hint">' + esc(hint) + '</p>' +
      '</div></div>'
    );
  }

  function renderViewer() {
    var viewer = el("rb-cp-viewer");
    if (!viewer) return;
    if (state.activeTab === "ingesta") {
      if (state.ingestaViewerCache) {
        viewer.innerHTML = "";
        viewer.appendChild(state.ingestaViewerCache);
        state.ingestaViewerCache = null;
      } else {
        viewer.innerHTML =
          '<div class="rb-cp-vhead">' +
          '  <i class="bi bi-clipboard2-data" aria-hidden="true"></i>' +
          '  <span class="rb-cp-vhead__title">Visualizador</span></div>' +
          '<div id="charts-display-area" style="flex:1;min-height:0;overflow:auto;padding:12px 14px;"></div>';
      }
    } else if (state.activeTab === "control") {
      viewer.innerHTML =
        '<div class="rb-cp-vhead">' +
        '  <i class="bi bi-clipboard2-data" aria-hidden="true"></i>' +
        '  <span class="rb-cp-vhead__title">Visualizador</span></div>' +
        '<div id="charts-display-area" style="flex:1;min-height:0;overflow:auto;padding:12px 14px;">' +
        '  <div class="rb-cp-vempty"><div class="rb-cp-vempty__inner">' +
        '    <div class="rb-cp-vempty__chip"><i class="bi bi-hand-index"></i></div>' +
        '    <div class="rb-cp-vempty__eyebrow">Selecciona una tabla</div>' +
        '    <p class="rb-cp-vempty__hint">Navega el árbol y haz clic en una tabla para ver sus datos</p>' +
        '  </div></div></div>';
    } else if (state.activeTab === "analisis") {
      viewer.innerHTML =
        '<div class="rb-cp-vhead">' +
        '  <i class="bi bi-clipboard2-data" aria-hidden="true"></i>' +
        '  <span class="rb-cp-vhead__title is-gold">Análisis Avanzado de Producción Diaria</span></div>' +
        '<div id="charts-display-area" style="flex:1;min-height:0;overflow:auto;padding:12px 14px;">' +
        '  <div class="rb-cp-vempty"><div class="rb-cp-vempty__inner">' +
        '    <div class="rb-cp-vempty__chip"><i class="bi bi-hand-index"></i></div>' +
        '    <div class="rb-cp-vempty__eyebrow">Selecciona un módulo</div>' +
        '    <p class="rb-cp-vempty__hint">Catálogo de entidades o Densidad temporal</p>' +
        '  </div></div></div>';
    } else if (state.activeTab === "consulta") {
      // Lienzo full-height: rail de análisis (previews) + canvas del análisis activo + pila de
      // resultados del Motor Q v2, apilados DEBAJO del análisis dentro del scroller único .cn-col.
      // El innerHTML de abajo DESTRUYE el #cn-stack actual: hay que salvar sus bloques primero. Sin
      // esto, un repintado que no venga de setActiveTab (p.ej. reabrir el panel colapsado) borraba
      // la pila en silencio.
      saveConsultaStackDOM();
      // SCROLL ÚNICO (2026-08-11): el análisis y la pila ya NO se excluyen — conviven dentro de
      // .cn-col, que es el único scroller. El análisis queda arriba (bloque permanente, SINGLETON:
      // pedir Filiales/Panorama/reporte-del-día lo REEMPLAZA en sitio, nunca añade una 2ª copia —
      // los IDs internos del reporte son fijos y dos copias romperían todos sus getElementById).
      viewer.innerHTML =
        '<div class="rb-cp-vhead"><i class="bi bi-chat-dots rb-cp-vhead__icon"></i>' +
        '  <span class="rb-cp-vhead__title is-gold">Consulta de Producción (v1)</span></div>' +
        '<div id="cn-viewer-area" style="flex:1;min-height:0;overflow:hidden;">' +
        '  <div class="cn-shell">' +
             // [2026-08-25] CN-WAFFLE · el riel de 158px pasó a un botón que abre un popover.
             // El BOTÓN va aquí (se repinta con la pestaña, es barato); el POPOVER vive en
             // document.body y se monta una sola vez — este innerHTML lo destruiría (H2).
             // [2026-08-30] La barra solo se pinta en la vista clásica. En MainChat el
             // botón se fue a la cabecera del panel Insights (lo inyecta acordeon.js
             // llamando a MultiTabShell.analisisBtnHtml), y así esos 51px van a los
             // gráficos. Ver __cnHayAcordeon.
        (__cnHayAcordeon() ? '' :
        '    <div class="cn-railbar">' + __cnAnMenuBtn() + '</div>') +
        '    <div class="cn-col" id="cn-col">' +
        '      <div class="cn-canvas" id="cn-canvas"></div>' +
        '      <div class="cn-stack" id="cn-stack"></div>' +
        '    </div>' +
        '  </div></div>';
      // [2026-08-25] CN-WAFFLE · el estado inicial ya no viaja en el markup del riel.
      __cnRailActiva = __cnLastIntent ? null : "desempeno";
      __cnAnMenuMontar();   // el popover vive en body: se monta una vez, aquí o al 1er clic
      // Al volver a la pestaña se repinta lo ÚLTIMO que estabas viendo. Antes repintaba siempre el
      // Panorama de la entidad (Densidad+Cobertura) aunque estuvieras en su Desempeño: perdías el
      // sitio. Mismo criterio que al resolver la entidad (rama B → panorama; A → Desempeño).
      // Va ANTES de restaurar la pila porque __cnAnalizar reescribe #cn-rail y el propio #cn-canvas.
      if (__cnLastIntent && __cnLastIntent.rama === "B") window.__cnDashboard(__cnLastIntent);
      else if (__cnLastIntent) window.__cnReanalizar();
      else window.__cnAnalizar(null);   // al cargar sin entidad → Desempeño GLOBAL del mes (no queda vacío)
      // Restaurar la pila DEBAJO del análisis. Se ANEXA (sin vaciar antes): el #cn-stack recién
      // creado está vacío, y vaciarlo destruiría cualquier bloque llegado entre su creación y aquí.
      if (state.consultaStackCache) {
        var _stk = el("cn-stack");
        if (_stk) {
          _stk.appendChild(state.consultaStackCache);
          state.consultaStackCache = null;   // solo se suelta si de verdad se restauró
          // [2026-08-13] Bloques "analiza_foco" que se encolaron con el fetch YA resuelto pero el
          // bloque desconectado (A6: Plotly.newPlot en un DocumentFragment queda sin dimensión real)
          // — ahora que están de vuelta en el DOM vivo, se pintan. __cnAnzEd/__cnAnzDd/__cnAnzSufijo
          // viven como propiedades JS del propio nodo (mismo patrón que elp.__cnRO), sobreviven al
          // moverlo entre el fragment y el DOM.
          _stk.querySelectorAll('[data-pend-paint="1"]').forEach(function (b) {
            if (b.__cnAnzEd && b.__cnAnzDd) __cnPaintFocoStk(b, b.__cnAnzEd, b.__cnAnzDd, b.__cnAnzSufijo || "");
            // [2026-08-25] QV2-PANEL-MES: los paneles mensuales (N3/N4) se encolan por la misma
            // vía. No los cubría __cnPaintFocoStk, que solo conoce #cn-foco-day-/#cn-foco-mon-
            // (:1844) — sin esta rama el bloque volvía del fragment con el host vacío.
            else if (b.__cnMesD) __cnPanelMesPintar(b, b.__cnMesD, b.__cnMesTipo);
            delete b.dataset.pendPaint;
          });
          // Vuelve al último resultado, como al preguntar. [2026-08-24] Vía __cnStackScroll para
          // que use el MISMO buscador de scroller (en MainChat el que desborda no es .cn-col) y
          // la misma doble medición: al restaurar la pila también se repinta Plotly.
          var _ult = _stk.lastElementChild;
          if (_ult) __cnStackScroll(_ult);
        }
      }
    } else if (state.activeTab === "testclas") {
      // [2026-07-30] Libreta tabulada del clasificador: pregunta · decisión · veredicto · fecha
      viewer.innerHTML =
        '<div class="rb-cp-vhead"><i class="bi bi-clipboard2-check rb-cp-vhead__icon"></i>' +
        '  <span class="rb-cp-vhead__title is-gold">Test Clas · Libreta del clasificador (Motor v2)</span></div>' +
        '<div id="tc-viewer" style="flex:1;min-height:0;overflow:auto;padding:12px 14px;">' +
        '  <div id="tc-resumen" class="tc-resumen"></div>' +
        '  <div class="tc-filtros" id="tc-filtros">' + __tcFiltrosHtml("todas") + '</div>' +
        // [2026-08-24] Gate del clasificador a un clic: el golden solo se podía correr por CLI
        // en el servidor, así que en la práctica no se corría al tocar patrones.
        '  <div class="tc-golden" id="tc-golden">' +
        '    <button type="button" class="tc-chip tc-golden__btn" onclick="window.__tcGolden()"' +
        '      title="Clasifica los casos del golden y compara contra lo esperado (gate ≥90%)">' +
        '      <i class="bi bi-shield-check"></i> Correr golden</button>' +
        '    <span id="tc-golden-out" class="tc-golden__out"></span>' +
        '  </div>' +
        '  <div class="tc-actions" id="tc-actions"></div>' +
        '  <div id="tc-tabla"><div class="text-muted small p-2">' +
        '    <div class="spinner-border spinner-border-sm"></div> Cargando la libreta…</div></div>' +
        '</div>';
      __tcCargarTabla(__tcFiltroActual);
    } else {
      viewer.innerHTML = viewerEmpty("graph-up-arrow", "Análisis",
        "Vistas y KPIs avanzados de producción", true,
        "clipboard2-data", "Análisis Avanzado de Producción Diaria");
    }
  }

  // ---------- Tab navigation ----------
  function setActiveTab(tabId) {
    var reopening = state.collapsed;
    if (reopening) {
      state.collapsed = false;
      var root0 = el("rb-cp");
      if (root0) root0.classList.remove("is-collapsed");
      // Re-abrir el panel colapsado con la MISMA pestaña activa se salta el early-return de abajo y
      // re-renderiza esa pestaña igualmente (renderPanelBody+renderViewer) → si es Consulta, hay que
      // salvar la pila ANTES de que renderViewer() reconstruya #cn-viewer-area desde cero.
      if (state.activeTab === "consulta") saveConsultaStackDOM();
    }
    if (!reopening && state.activeTab === tabId) return;
    if (state.activeTab === "ingesta" && tabId !== "ingesta") saveIngestaDOM();
    if (state.activeTab === "consulta" && tabId !== "consulta") saveConsultaStackDOM();
    state.activeTab = tabId;
    var def = tabDef(tabId);

    document.querySelectorAll("#rb-cp .rb-cp__tab").forEach(function (btn) {
      var active = btn.dataset.tab === tabId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
    });

    var headIcon = el("rb-cp-head-icon");
    var headTitle = el("rb-cp-head-title");
    var panel = el("rb-cp-panel");
    var body = el("rb-cp-panel-body");
    if (headIcon) headIcon.className = "bi bi-" + def.icon + " rb-cp__panel-head-icon";
    if (headTitle) headTitle.textContent = def.label.toUpperCase();
    if (panel) panel.setAttribute("aria-label", "Panel " + def.label);
    if (body) body.setAttribute("aria-labelledby", "cp-tab-" + tabId);

    renderPanelBody();
    renderViewer();
  }

  // Abre una pestaña del panel desde fuera del shell (accesos del waffle en mainchat.js).
  // setActiveTab ya des-colapsa el panel si hacía falta, así que basta con delegar.
  window.__rbAbrirTab = function (tabId) {
    if (!tabExiste(tabId)) return false;   // pestaña inexistente → el llamador decide qué hacer
    setActiveTab(tabId);
    var btn = document.querySelector('#rb-cp .rb-cp__tab[data-tab="' + tabId + '"]');
    if (btn) btn.focus();
    return true;
  };

  function onRailKeydown(e) {
    var keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (keys.indexOf(e.key) === -1) return;
    e.preventDefault();
    var idx = TABS.findIndex(function (t) { return t.id === state.activeTab; });
    var next = idx;
    if (e.key === "ArrowDown") next = (idx + 1) % TABS.length;
    else if (e.key === "ArrowUp") next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else next = TABS.length - 1;
    setActiveTab(TABS[next].id);
    var btn = document.querySelector('#rb-cp .rb-cp__tab[data-tab="' + TABS[next].id + '"]');
    if (btn) btn.focus();
  }

  function toggleCollapse() {
    state.collapsed = !state.collapsed;
    var root = el("rb-cp");
    if (root) root.classList.toggle("is-collapsed", state.collapsed);
    if (state.collapsed) {
      var activeBtn = document.querySelector("#rb-cp .rb-cp__tab.is-active");
      if (activeBtn) activeBtn.focus();
    }
  }

  // ---------- Mount / Unmount ----------
  function mount(initialTab) {
    if (state.mounted) return;

    // Save current UI state
    var twoPanel = document.querySelector(".two-panel-layout");
    var footer = document.querySelector(".app-footer");
    var welcome = document.querySelector(".chat-welcome-section");
    var banner = document.querySelector(".chat-banner");
    var chatInput = document.querySelector(".chat-input-container");

    state.savedState = {
      welcomeDisplay: welcome ? welcome.style.display : "",
      bannerDisplay: banner ? banner.style.display : "",
      chatInputDisplay: chatInput ? chatInput.style.display : "",
    };

    // Hide two-panel layout and footer
    if (twoPanel) twoPanel.style.display = "none";
    if (footer) footer.style.display = "none";

    // Rename conflicting IDs in the hidden two-panel layout so
    // getElementById finds the shell's elements, not the hidden originals
    var origArea = document.getElementById("charts-display-area");
    if (origArea) origArea.id = "_charts-display-area-hidden";

    // Inject and show shell
    var container = el("multitab-shell-container");
    if (!container) return;
    container.innerHTML = shellHTML();
    container.style.display = "block";

    // Bind rail tabs
    var root = el("rb-cp");
    if (root) {
      root.querySelectorAll(".rb-cp__tab").forEach(function (btn) {
        btn.addEventListener("click", function () { setActiveTab(btn.dataset.tab); });
        btn.addEventListener("keydown", onRailKeydown);
      });
    }

    // Bind collapse + back buttons
    var collapseBtn = el("rb-cp-collapse");
    if (collapseBtn) collapseBtn.addEventListener("click", toggleCollapse);
    var backBtn = el("rb-cp-back");
    if (backBtn) backBtn.addEventListener("click", unmount);

    // Panel body delegation (toggle sheets from renderIngestaProgress)
    var body = el("rb-cp-panel-body");
    if (body) {
      body.addEventListener("click", function (e) {
        var target = e.target.closest("[data-action]");
        if (!target) return;
        if (target.dataset.action === "toggle-sheet") {
          if (window.igToggleSheet) window.igToggleSheet(target);
        }
      });
    }

    // Initial render
    // Si se pide una pestaña inicial explícita (p.ej. "consulta" al entrar tras login), se arranca
    // directo ahí para no pintar "Ingesta" por un frame y luego saltar — evita el flash visible.
    var soloConsulta = __cnSoloConsulta();
    state.activeTab = soloConsulta ? "consulta" : (initialTab || "ingesta");
    state.collapsed = false;
    // Un montaje nuevo arranca con la pila de Consulta LIMPIA. unmount() ya la suelta; esto cubre el
    // primer mount de la página y cualquier salida del shell que no pase por unmount().
    state.consultaStackCache = null;
    __cnStackOn = false;
    __cnStackSeq = 0;

    // Sincroniza el rail y el header del panel con state.activeTab: el HTML estático de shellHTML()
    // trae "Ingesta" marcada como activa por defecto, así que si se arranca en otra pestaña hay que
    // reflejarlo aquí mismo (mismo trabajo que hace setActiveTab) antes del primer paint.
    var initialDef = tabDef(state.activeTab);
    if (root) {
      root.querySelectorAll(".rb-cp__tab").forEach(function (btn) {
        var active = btn.dataset.tab === state.activeTab;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
        btn.tabIndex = active ? 0 : -1;
      });
    }
    var headIcon0 = el("rb-cp-head-icon");
    var headTitle0 = el("rb-cp-head-title");
    var panel0 = el("rb-cp-panel");
    var body0 = el("rb-cp-panel-body");
    if (headIcon0) headIcon0.className = "bi bi-" + initialDef.icon + " rb-cp__panel-head-icon";
    if (headTitle0) headTitle0.textContent = initialDef.label.toUpperCase();
    if (panel0) panel0.setAttribute("aria-label", "Panel " + initialDef.label);
    if (body0) body0.setAttribute("aria-labelledby", "cp-tab-" + state.activeTab);

    renderPanelBody();
    renderViewer();

    // [2026-08-04] Si el usuario no es "Javier Guerrero": oculta todas las pestañas salvo Consulta.
    if (soloConsulta && root) {
      root.querySelectorAll(".rb-cp__tab").forEach(function (btn) {
        if (btn.dataset.tab !== "consulta") btn.style.display = "none";
      });
    }

    // Socket listener for ingesta progress
    if (window.ChatManager && window.ChatManager.socket && !window.__ingestaListenerSet) {
      window.__ingestaListenerSet = true;
      window.ChatManager.socket.on("ingesta_progress", function (ev) {
        if (window.renderIngestaProgress) window.renderIngestaProgress(ev);
      });
    }

    state.mounted = true;
  }

  function unmount() {
    if (!state.mounted) return;

    // La pila de Consulta NO se conserva al salir del shell: "Volver" cierra la sesión de análisis y
    // el mount siguiente arranca limpio (ver el reset en mount()). Guardarla aquí sería trabajo muerto
    // — el fragment quedaría retenido hasta que ese mismo reset lo descartara.
    // [2026-08-25] CN-WAFFLE · el menú de análisis vive en document.body (H2: el markup de
    // Consulta se regenera y lo destruiría), así que este innerHTML NO lo alcanza: sin esto
    // queda un panel flotante huérfano sobre la app al salir del shell (R2).
    // Se DESMONTA, no solo se oculta: el mount siguiente lo recrea con __cnAnMenuMontar().
    var _anpop = document.getElementById("cn-anpop");
    if (_anpop && _anpop.parentNode) _anpop.parentNode.removeChild(_anpop);
    __cnAnMenuMontado = false;   // permite que el próximo mount lo vuelva a crear
    var container = el("multitab-shell-container");
    if (container) { container.innerHTML = ""; container.style.display = "none"; }

    // Restore original charts-display-area ID
    var hiddenArea = document.getElementById("_charts-display-area-hidden");
    if (hiddenArea) hiddenArea.id = "charts-display-area";

    // Restore two-panel layout and footer
    var twoPanel = document.querySelector(".two-panel-layout");
    var footer = document.querySelector(".app-footer");
    if (twoPanel) twoPanel.style.display = "";
    if (footer) footer.style.display = "";

    // Restore chat panel elements
    if (state.savedState) {
      var welcome = document.querySelector(".chat-welcome-section");
      var banner = document.querySelector(".chat-banner");
      var chatInput = document.querySelector(".chat-input-container");
      if (welcome) welcome.style.display = state.savedState.welcomeDisplay;
      if (banner) banner.style.display = state.savedState.bannerDisplay;
      if (chatInput) chatInput.style.display = state.savedState.chatInputDisplay;
    }

    // Reset analytics panel
    var panelTitle = el("analytics-panel-title");
    if (panelTitle) panelTitle.textContent = "Análisis de Desempeño";
    var emptyState = el("analytics-empty-state");
    if (emptyState) emptyState.style.display = "";

    state.mounted = false;
    state.savedState = null;
    // Suelta la pila aquí (y no solo en mount): si quedó un panel encolado en el cache, sus nodos
    // seguirían retenidos todo el tiempo que el shell esté cerrado.
    state.consultaStackCache = null;
    __cnStackOn = false;
    __cnStackSeq = 0;
  }

  // ============ Pestaña ANÁLISIS (Objetivo Primario: catálogo + densidad) ============
  function renderAnalisisBody() {
    return (
      '<div style="padding:1rem;">' +
      '  <div class="rb-cp-ctrl-head">' +
      '    <i class="bi bi-graph-up-arrow" aria-hidden="true"></i>' +
      '    <div><strong>Análisis</strong><small>Fundación de datos</small></div>' +
      '  </div>' +
      '  <div class="mt-3 d-grid gap-2">' +
      '    <button type="button" class="ig-trow" onclick="window.__anShowCatalogo()">' +
      '      <i class="bi bi-diagram-3"></i><span class="ig-trow__name">Catálogo de entidades</span></button>' +
      '    <button type="button" class="ig-trow" onclick="window.__anShowDensidad()">' +
      '      <i class="bi bi-calendar-week"></i><span class="ig-trow__name">Densidad temporal</span></button>' +
      '    <button type="button" class="ig-trow" onclick="window.__anShowHuella()">' +
      '      <i class="bi bi-bar-chart-steps"></i><span class="ig-trow__name">Cobertura del reporte</span></button>' +
      '  </div>' +
      '</div>'
    );
  }

  function __anArea() { return el("charts-display-area"); }
  function __anLoading(msg) {
    var a = __anArea();
    if (a) a.innerHTML = '<div class="d-flex align-items-center gap-2 p-3 text-muted">' +
      '<div class="spinner-border spinner-border-sm"></div> ' + esc(msg) + '</div>';
  }
  function __anError(e) {
    var a = __anArea();
    if (a) a.innerHTML = '<div class="alert alert-danger m-2">Error: ' + esc(String(e)) + '</div>';
  }
  var __anSevBadge = { dura: "ig-badge--green", media: "ig-badge--blue", blanda: "ig-badge--gray" };
  var __anSemColor = { verde: "#198754", amarillo: "#fd7e14", rojo: "#dc3545" };
  var __anCat = null;   // catálogo cacheado para el explorador de entidades por nivel

  window.__anShowCatalogo = function () {
    __anLoading("Cargando catálogo…");
    fetch("/api/analisis/catalogo").then(function (r) { return r.json(); }).then(function (d) {
      var a = __anArea(); if (!a) return;
      __anCat = d;
      var kpis = d.cardinalidad.map(function (x) {
        return '<div onclick="window.__anVerNivel(\'' + x.nivel + '\')" title="Ver todas las entidades de este nivel" ' +
          'style="flex:1;min-width:90px;border:1px solid #dee2e6;border-radius:8px;padding:8px 10px;text-align:center;cursor:pointer;">' +
          '<div style="font-size:1.4rem;font-weight:700;">' + nfCtrl(x.n) + '</div>' +
          '<div class="text-muted" style="font-size:.72rem;text-transform:uppercase;">' + esc(x.nivel) + '</div></div>';
      }).join("");
      var rc = d.resumen_colisiones;
      var duras = d.colisiones.filter(function (c) { return c.severidad === "dura" || c.severidad === "media"; });
      var filas = duras.map(function (c) {
        return '<tr><td><strong>' + esc(c.nombre) + '</strong></td>' +
          '<td><span class="ig-badge ' + (__anSevBadge[c.severidad] || "ig-badge--gray") + '">' + c.severidad + '</span></td>' +
          '<td class="text-muted small">' + esc(c.niveles.join(", ")) + '</td></tr>';
      }).join("");
      var prods = d.productos_validos.map(function (p) {
        return '<span class="ig-badge ig-badge--green">' + esc(p.termino) + ' (' + esc(p.dim) + ')</span>';
      }).join(" ");
      a.innerHTML =
        '<h6 class="mb-2"><i class="bi bi-diagram-3"></i> Catálogo de entidades</h6>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;">' + kpis + '</div>' +
        '<div class="text-muted small mb-2" style="font-style:italic;">Clic en una tarjeta para ver TODAS las entidades de ese nivel.</div>' +
        '<div id="an-nivel-list" class="mb-2"></div>' +
        '<div class="text-muted small mb-2">Jerarquía ECP (VP→gerencia→activo→area→campo→fuente). ' +
        'Filiales aparte: ' + esc(d.filiales.join(", ")) + '.</div>' +
        '<div class="mb-2">Productos válidos (diario): ' + prods +
        ' <span class="text-muted small">— agua NO disponible a grano diario</span></div>' +
        '<div class="mb-2">Colisiones: <strong>' + rc.total + '</strong> total · ' +
        '<span class="ig-badge ig-badge--green">' + rc.dura + ' duras</span> ' +
        '<span class="ig-badge ig-badge--blue">' + rc.media + ' medias</span> ' +
        '<span class="ig-badge ig-badge--gray">' + rc.blanda + ' blandas</span></div>' +
        '<div class="text-muted small mb-1">Requieren contrapregunta (dura + media):</div>' +
        '<table class="table table-sm"><thead><tr><th>Nombre</th><th>Severidad</th><th>Niveles</th></tr></thead>' +
        '<tbody>' + filas + '</tbody></table>';
    }).catch(__anError);
  };

  // Explorador: lista COMPLETA de entidades de un nivel (al clicar su tarjeta).
  window.__anVerNivel = function (niv) {
    var box = el("an-nivel-list");
    if (!box || !__anCat || !__anCat.entidades_por_nivel) return;
    var lista = __anCat.entidades_por_nivel[niv] || [];
    // mapa nombre(UPPER) -> severidad, para marcar las que colisionan
    var sevMap = {};
    (__anCat.colisiones || []).forEach(function (c) { sevMap[c.nombre] = c.severidad; });
    var chips = lista.map(function (nom) {
      var sev = sevMap[String(nom).toUpperCase()];
      var badge = sev ? ' <span class="ig-badge ' + (__anSevBadge[sev] || "ig-badge--gray") +
        '" style="font-size:.6rem;">' + sev + '</span>' : '';
      return '<span style="display:inline-block;border:1px solid #dee2e6;border-radius:6px;' +
        'padding:2px 8px;margin:2px;background:#f8f9fa;">' + esc(nom) + badge + '</span>';
    }).join("");
    box.innerHTML =
      '<div style="border:1px solid #dee2e6;border-radius:8px;padding:8px 10px;background:#fff;">' +
      '<div class="mb-1"><strong>' + esc(niv) + '</strong> — <span class="text-muted">' + lista.length +
      ' entidades</span></div>' +
      '<div style="max-height:220px;overflow:auto;line-height:1.9;">' +
      (lista.length ? chips : '<span class="text-muted small">Sin entidades.</span>') + '</div></div>';
  };

  function __anRenderDensidad(d, slim) {   // slim = true (dashboard Consulta): sin semáforo ni nota larga
    if (d.aplica_ecp === false) {
      return '<div class="alert alert-warning small mb-0"><strong>' + esc(d.entidad || "") +
        '</strong> no tiene filas a grano diario ECP (<code>fact_produccion_dia_ecp</code>). ' +
        'Puede aparecer en reportes/hojas derivadas o de filiales (revísalo en <strong>Cobertura del reporte</strong>), ' +
        'pero no en el detalle diario de producción ECP.</div>';
    }
    var res = d.resumen;
    if (!res || !res.total_dias) return '<div class="text-muted small">Sin días con datos para esta entidad.</div>';
    var semBlock = "", notaBlock = "";
    if (!slim) {
      var semHtml = d.semaforo.map(function (s) {
        return '<div style="margin:2px 0;">' +
          '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
          (__anSemColor[s.nivel] || "#999") + ';margin-right:6px;"></span>' + esc(s.familia) +
          (s.necesita_continuidad ? ' <span class="text-muted small">(requiere días continuos)</span>' : '') +
          '</div>';
      }).join("");
      semBlock = '<div class="mb-2 small">Semáforo por familia: ' + semHtml + '</div>';
      notaBlock = '<div class="text-muted small mb-1">Cada celda es un <strong>día</strong>. Celda coloreada = ese día ' +
        '<strong>hubo dato</strong>; celda en blanco = <strong>día sin dato (hueco)</strong>. El color indica cuántos ' +
        'pozos/fuentes reportaron ese día (a nivel de un solo campo suele ser casi constante — lo relevante ahí es ' +
        'la <strong>presencia vs. el hueco</strong>).</div>';
    }
    var filas = d.por_mes.map(function (m) {
      return '<tr><td>' + esc(m.mes_nombre) + ' ' + m.anio + '</td>' +
        '<td>' + m.dias_con_data + ' / ' + m.dias_del_mes + '</td>' +
        '<td class="small text-muted">' + esc(m.rango[0]) + ' → ' + esc(m.rango[1]) + '</td></tr>';
    }).join("");
    return '<div class="mb-2">Días con data: <strong>' + nfCtrl(res.total_dias) + '</strong> · ' +
      'Rango: ' + esc(res.rango[0]) + ' → ' + esc(res.rango[1]) + ' · ' +
      'Huecos: <strong>' + res.huecos_totales + '</strong> · Racha máx: <strong>' + res.racha_maxima + '</strong> días</div>' +
      semBlock + notaBlock +
      '<div id="an-heatmap" style="width:100%;height:360px;"></div>' +
      '<table class="table table-sm mt-2"><thead><tr><th>Mes</th><th>Días</th><th>Rango</th></tr></thead>' +
      '<tbody>' + filas + '</tbody></table>';
  }

  window.__anShowDensidad = function () {
    __anLoading("Calculando densidad temporal…");
    fetch("/api/analisis/catalogo").then(function (r) { return r.json(); }).catch(function () { return null; })
      .then(function (cat) {
        var a = __anArea(); if (!a) return;
        a.innerHTML =
          '<h6 class="mb-2"><i class="bi bi-calendar-week"></i> Densidad temporal</h6>' +
          '<div class="mb-2"><strong>Filtrar por entidad:</strong> ' +
          '<select id="an-den-input" class="form-select form-select-sm d-inline-block" ' +
          'style="max-width:340px;vertical-align:middle;" onchange="window.__anDensidadEntidad(this.value)">' +
          __anEntidadOpts(cat, "— Global (toda la producción ECP) —") + '</select></div>' +
          '<div id="an-den-body"></div>';
        window.__anDensidadEntidad("");
      });
  };

  window.__anDensidadEntidad = function (nom) {
    var body = el("an-den-body"); if (!body) return;
    var q = (nom || "").trim();
    var url = "/api/analisis/densidad" + (q ? ("?entidad=" + encodeURIComponent(q)) : "");
    body.innerHTML = '<div class="text-muted small p-2"><div class="spinner-border spinner-border-sm"></div> Calculando…</div>';
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      body.innerHTML = __anRenderDensidad(d);
      if (d.aplica_ecp !== false && d.dias && d.dias.length) __anHeatmap(d.por_mes, d.dias);
    }).catch(function () { body.innerHTML = '<div class="alert alert-danger m-1 small">Error calculando la densidad.</div>'; });
  };

  function __anHeatmap(porMes, dias) {
    var cont = el("an-heatmap");
    if (!cont) return;
    if (!window.Plotly) { cont.innerHTML = '<div class="text-muted small">(Plotly no disponible; ver tabla)</div>'; return; }
    var mp = {}; dias.forEach(function (d) { mp[d.fecha] = d.fuentes; });   // color = # pozos (fuentes) con data ese día
    var y = porMes.map(function (m) { return m.mes_nombre + " " + m.anio; });
    var z = porMes.map(function (m) {
      var row = [];
      for (var day = 1; day <= 31; day++) {
        var key = String(m.anio) + "-" + String(m.mes).padStart(2, "0") + "-" + String(day).padStart(2, "0");
        row.push(mp[key] !== undefined ? mp[key] : null);
      }
      return row;
    });
    var x = []; for (var day = 1; day <= 31; day++) x.push(day);
    window.Plotly.newPlot(cont, [{
      type: "heatmap", z: z, x: x, y: y, colorscale: "YlGnBu", hoverongaps: false,
      showscale: false,
      hovertemplate: "%{y}, día %{x}<br>%{z} pozo(s) con dato<extra></extra>"
    }], { margin: { l: 70, r: 20, t: 10, b: 40 }, xaxis: { title: "Día del mes", dtick: 1 }, height: 360 },
      { displayModeBar: false });
  }

  // ============ Modulo COBERTURA DEL REPORTE (todas las hojas, filtrable por entidad = PRESENCIA) ============
  var __anCatColor = {
    "Producción ECP": "#0d6efd", "Filiales": "#20c997", "Comentarios": "#6f42c1",
    "Hojas modeladas (visor)": "#fd7e14", "Preservada en crudo (Bronze)": "#6c757d"
  };

  function __anRenderCobertura(cob, hideEmpty) {   // hideEmpty (dashboard): oculta hojas en 0 y categorías vacías
    if (!cob || !cob.categorias) return '<div class="text-muted small">Sin datos de cobertura.</div>';
    var ent = cob.entidad;
    var html = ent
      ? ('<h6 class="mb-1"><i class="bi bi-grid-3x3-gap"></i> Presencia de <strong>' + esc(ent) +
         '</strong> — aparece en ' + (cob.hojas_con_entidad || 0) + ' de ' + cob.total_hojas + ' hojas</h6>' +
         '<div class="text-muted small mb-2">Nº de reportes donde cada hoja contiene la entidad. RAW vía facts ' +
         '(exacto); resto vía <code>bronze.hoja_landing</code> (coincidencia por texto, puede sobre-emparejar nombres similares).</div>')
      : ('<h6 class="mb-1"><i class="bi bi-grid-3x3-gap"></i> Cobertura del reporte — ' + cob.total_hojas + ' hojas</h6>' +
         '<div class="text-muted small mb-2">TODAS las hojas ingeridas por categoría (fuente: <code>core.ingesta_log</code>). ' +
         'Escribe una entidad arriba para ver en cuántos reportes aparece por hoja.</div>');
    cob.categorias.forEach(function (c) {
      var hojas = c.hojas;
      if (hideEmpty && ent) {
        hojas = hojas.filter(function (h) { return (h.reportes_entidad || 0) > 0; });
        if (!hojas.length) return;   // categoría sin hojas con datos de la entidad → se omite
      }
      var col = __anCatColor[c.categoria] || "#6c757d";
      html += '<div style="margin:8px 0 2px;font-weight:600;">' +
        '<span style="display:inline-block;width:11px;height:11px;border-radius:2px;background:' + col +
        ';margin-right:6px;"></span>' + esc(c.categoria) +
        ' <span class="text-muted small">(' + hojas.length + (hojas.length === 1 ? ' hoja)' : ' hojas)') + '</span></div>';
      html += '<table class="table table-sm mb-1" style="font-size:.8rem;"><tbody>';
      hojas.forEach(function (h) {
        var rowStyle = "", right;
        if (ent) {
          var k = h.reportes_entidad || 0;
          if (k === 0) rowStyle = ' style="opacity:.4;"';
          right = '<td class="text-end">' + (k > 0 ? '<strong>' + k + '</strong>' : '0') +
            ' <span class="text-muted small">de ' + h.reportes_total + ' rep.</span></td>';
        } else {
          right = '<td class="text-end"><strong>' + h.reportes_total + '</strong> reportes</td>';
        }
        html += '<tr' + rowStyle + '><td>' + esc(h.hoja) + '</td>' + right + '</tr>';
      });
      html += '</tbody></table>';
    });
    return html;
  }

  var __anCobNivelLabel = {
    vicepresidencia: "Vicepresidencia", gerencia: "Gerencia", activo: "Activo",
    area: "Área", campo: "Campo", fuente: "Fuente (pozo/estación)"
  };

  // Opciones <option>/<optgroup> del desplegable de entidades (filiales + jerarquía ECP). Compartido
  // por Cobertura y Densidad. 'allLabel' = etiqueta de la primera opción (value="" = sin filtro).
  function __anEntidadOpts(cat, allLabel) {
    var opts = '<option value="">' + esc(allLabel) + '</option>';
    function grp(label, lst) {
      if (!lst || !lst.length) return;
      var arr = lst.slice().sort(function (x, y) { return String(x).localeCompare(String(y)); });
      opts += '<optgroup label="' + esc(label) + ' (' + arr.length + ')">';
      arr.forEach(function (nom) {
        var s = esc(String(nom));
        opts += '<option value="' + s + '">' + s + '</option>';
      });
      opts += '</optgroup>';
    }
    if (cat) {
      grp("Filial (empresa)", cat.filiales);   // eje aparte de la jerarquía ECP
      if (cat.entidades_por_nivel) {
        ["vicepresidencia", "gerencia", "activo", "area", "campo", "fuente"].forEach(function (niv) {
          grp(__anCobNivelLabel[niv] || niv, cat.entidades_por_nivel[niv]);
        });
      }
    }
    return opts;
  }

  window.__anShowHuella = function () {
    __anLoading("Cargando cobertura…");
    Promise.all([
      fetch("/api/analisis/cobertura").then(function (r) { return r.json(); }),
      fetch("/api/analisis/catalogo").then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      var cob = res[0], cat = res[1];
      var a = __anArea(); if (!a) return;
      var opts = __anEntidadOpts(cat, "— Todas las hojas —");
      a.innerHTML =
        '<div class="mb-2"><strong>Filtrar por entidad:</strong> ' +
        '<select id="an-cob-input" class="form-select form-select-sm d-inline-block" ' +
        'style="max-width:340px;vertical-align:middle;" onchange="window.__anCoberturaEntidad(this.value)">' +
        opts + '</select></div>' +
        '<div id="an-cob-body"></div>';
      var b = el("an-cob-body"); if (b) b.innerHTML = __anRenderCobertura(cob);
    }).catch(__anError);
  };

  window.__anCoberturaEntidad = function (nom) {
    var body = el("an-cob-body"); if (!body) return;
    var q = (nom || "").trim();
    var url = "/api/analisis/cobertura" + (q ? ("?entidad=" + encodeURIComponent(q)) : "");
    body.innerHTML = '<div class="text-muted small p-2"><div class="spinner-border spinner-border-sm"></div> ' +
      (q ? ('Buscando presencia de ' + esc(q) + '… (puede tardar ~10s)') : 'Cargando…') + '</div>';
    fetch(url).then(function (r) { return r.json(); }).then(function (cob) {
      body.innerHTML = __anRenderCobertura(cob);
    }).catch(function () { body.innerHTML = '<div class="alert alert-danger m-1 small">Error cargando la cobertura.</div>'; });
  };

  // ============ Pestaña CONSULTA (slot-filling v1) ============
  function renderConsultaBody() {   // zona 2 (panel IZQUIERDO): el chat completo (mismo formato que chat.js)
    return '' +
      // [2026-07-30] Selector de motor (v1 = slot-filling productivo · v2 = clasificador en construcción).
      // Switch en caliente, por pregunta; persiste en localStorage (sobrevive remount).
      // [2026-08-04] Solo "Javier Guerrero" ve el selector; el resto queda fijo en v2 (default).
      (__cnSoloConsulta() ? "" :
        '<div class="cn-motor" role="group" aria-label="Motor de consulta">' +
        '  <span class="cn-motor__lbl">Motor</span>' +
        '  <button type="button" id="cn-motor-v1" class="cn-motor__btn' + (__cnMotor === "v1" ? " is-active" : "") + '" ' +
        '    onclick="window.__cnSetMotor(\'v1\')">v1</button>' +
        '  <button type="button" id="cn-motor-v2" class="cn-motor__btn' + (__cnMotor === "v2" ? " is-active" : "") + '" ' +
        '    onclick="window.__cnSetMotor(\'v2\')">v2</button>' +
        '</div>') +
      '<div class="rb-chat" id="cn-messages" style="flex:1;min-height:0;" ' +
      'role="log" aria-live="polite" aria-label="Conversación"></div>' +
      // [2026-08-26] position:relative SÍ hace falta, pese a que .chat-input-container ya es
      // sticky en style.css:954 — en MainChat, acordeon.css:211-215 (#mc-chat-body
      // .chat-input-container) tiene más especificidad y lo pisa a `position:static` (apaga el
      // sticky a propósito, para no anclarse al scroller equivocado del acordeón). static NO
      // da contexto de posicionamiento a hijos absolute: sin este inline, #cn-hist-drop
      // calculaba su bottom:100% contra otro ancestro y aparecía fuera de la vista (BUG real,
      // verificado en vivo 2026-08-26). relative no reintroduce el problema que static evita:
      // ese era el auto-anclaje de sticky al scroll, algo que relative no hace.
      '<div class="chat-input-container" style="min-height:auto;padding:10px;border-radius:0;' +
      'position:relative;">' +
      // [2026-08-26] Historial de preguntas de ESTA conversación: se lee de __cnHistory (no
      // hace falta otro store) y se pinta bajo demanda al abrir, así que nunca se desincroniza.
      // Se vacía solo, junto con __cnHistory, al hacer "Nuevo chat" o restaurar otra conversación.
      '  <div class="cn-hist-drop" id="cn-hist-drop" hidden style="position:absolute;left:10px;' +
      'right:10px;bottom:100%;margin-bottom:6px;background:#fff;border:1px solid #d7ddd9;' +
      'border-radius:10px;box-shadow:0 -4px 16px rgba(0,0,0,.12);max-height:240px;' +
      'overflow-y:auto;z-index:20;"></div>' +
      '  <div class="input-group">' +
      '    <button class="btn btn-outline-secondary" type="button" id="cn-hist-btn" ' +
      '      style="margin-left:-3px" onclick="window.__cnHistToggle()" ' +
      '      title="Preguntas de esta conversación">' +
      '      <i class="bi bi-clock-history"></i></button>' +
      '    <input type="text" class="form-control" id="cn-input" autocomplete="off" ' +
      '      placeholder="Escribe tu pregunta de producción…" ' +
      '      onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();window.__cnPreguntar();}">' +
      '    <button class="btn btn-primary" type="button" id="cn-send-btn" onclick="window.__cnPreguntar()" ' +
      '      title="Preguntar"><i class="fas fa-paper-plane"></i></button>' +
      '  </div>' +
      '</div>';
  }

  // [2026-08-26] Plantillas de arranque (petición del usuario): dan un punto de partida a quien
  // no sabe qué preguntar. Llevan "…" donde va el dato (producto/campo/mes/año): clic RELLENA el
  // input (nunca envía, mismo contrato que el resto), así que el usuario edita el "…" antes de
  // preguntar.
  //
  // [2026-09-03 · MODAL-PREGUNTAS] De lista plana a CATEGORÍAS. Dos motivos:
  //   1. El desplegable plano mezclaba 8 plantillas sin jerarquía; con el modal hay sitio para
  //      agruparlas por lo que el usuario quiere HACER, no por cómo está construido el motor.
  //   2. Varias capacidades reales NO estaban aquí y por tanto nadie las descubría: distribución
  //      porcentual, campos de un ACTIVO, ranking de activos y la ventana móvil («últimos 30
  //      días») se habilitaron entre el 2026-09-01 y el 09-03 y ninguna tenía plantilla.
  // La estructura es [{cat, icono, items:[...]}, ...]; el orden de este array ES el orden del nav
  // del modal. "Histórico" NO va aquí: es la primera sección y sale de __cnHistory (ver
  // __cnPregModalPintar).
  var __cnHistSeed = [
    {
      cat: "Diagnóstico de causas",
      icono: "bi-graph-up-arrow",
      hint: "Por qué pasó: faltantes y causas del comportamiento",
      items: [
        { t: "Analiza el comportamiento de ", slot: "producto" },
        { t: "Analiza el comportamiento de la producción de ", slot: "producto", t2: " en ", slot2: "campo" },
        { t: "¿Qué campos explican el faltante de ", slot: "producto", t2: "?" },
        { t: "¿Cuáles son las causas de las diferidas en ", slot: "campo", t2: "?" }
      ]
    },
    {
      cat: "Cifras de producción",
      icono: "bi-123",
      hint: "El cuánto directo: volúmenes y acumulados",
      items: [
        { t: "¿Cuánto crudo produjo ", slot: "campo", t2: "?" },
        { t: "¿Cuál es la producción de ", slot: "activo", t2: "?" },
        { t: "¿Cuál es el acumulado del año de ", slot: "entidad", t2: "?" },
        { t: "¿Cuánto ha producido ", slot: "entidad", t2: " en lo que va del año?" },
        { t: "¿Cuál es el acumulado de gas de ", slot: "entidad", t2: "?" },
        { t: "¿Cuánto produjo ", slot: "entidad", t2: " el mes pasado?" }
      ]
    },
    {
      cat: "Cumplimiento vs metas",
      icono: "bi-bullseye",
      hint: "Real contra presupuesto, operativo, contable y promedio",
      items: [
        { t: "¿Cómo vamos este mes?" },
        { t: "¿Vamos a cerrar en meta?" },
        { t: "¿Cómo va ", slot: "entidad", t2: " frente al presupuesto este mes?" },
        { t: "¿Cuánto produjo ", slot: "entidad", t2: " en ", slot2: "mes", t3: " vs el operativo?" },
        { t: "¿Cuánto produjo ", slot: "entidad", t2: " en ", slot2: "mes", t3: " contra el contable?" },
        { t: "¿Cómo va ", slot: "entidad", t2: " frente al promedio del año?" }
      ]
    },
    {
      cat: "Rankings y contribución",
      icono: "bi-bar-chart-steps",
      hint: "Quién más o menos produce, y cómo se distribuye",
      items: [
        { t: "¿Cuáles son los 5 campos que más crudo producen?" },
        { t: "¿Cómo se distribuye la producción de crudo, %, entre los campos productores?" },
        { t: "¿Cuáles campos de ", slot: "activo", t2: " producen más crudo?" },
        { t: "¿Cuál es el activo que más crudo produce?" },
        { t: "¿Qué campos se quedaron más cortos vs presupuesto?" }
      ]
    },
    {
      cat: "Evolución en el tiempo",
      icono: "bi-calendar3",
      hint: "Día a día, mes a mes, tendencia y media móvil",
      items: [
        { t: "Muéstrame la producción de ", slot: "campo", t2: ", día a día en ", slot2: "mes" },
        { t: "Muéstrame la producción de ", slot: "campo", t2: ", mes a mes en ", slot2: "año" },
        { t: "¿Cuánto produjo ", slot: "entidad", t2: " en los últimos 30 días?" },
        { t: "Muéstrame la producción de ", slot: "producto", t2: " de los últimos 3 meses para ", slot2: "campo" },
        { t: "¿Cuál ha sido la variación porcentual de la producción de ", slot: "producto", t2: " mes a mes en 2026, para ", slot2: "campo", t3: "?" },
        { t: "¿Cuál fue el mejor día de ", slot: "entidad", t2: " este mes?" },
        { t: "¿Cuál es la tendencia de ", slot: "entidad", t2: "?" },
        { t: "¿A qué ritmo está declinando ", slot: "entidad", t2: "?" },
        { t: "Muéstrame la media móvil de ", slot: "entidad" },
        { t: "¿Cuál es la tendencia del gas de ", slot: "entidad", t2: "?" }
      ]
    },
    {
      cat: "Catálogo y jerarquía",
      icono: "bi-diagram-3",
      hint: "Campos, activos y a qué gerencia pertenecen",
      items: [
        { t: "¿Qué campos tiene ", slot: "activo", t2: "?" },
        { t: "¿A qué activo pertenece ", slot: "campo", t2: "?" },
        { t: "¿Cuántos pozos tiene ", slot: "entidad", t2: "?" }
      ]
    },
    {
      cat: "Eventos operativos",
      icono: "bi-tools",
      hint: "Mantenimientos y diferidas registradas",
      items: [
        { t: "¿Qué mantenimientos se han realizado en ", slot: "campo", t2: ", en el último mes?" },
        { t: "¿Qué diferidas hubo en ", slot: "entidad", t2: "?" }
      ]
    },
    {
      cat: "Comparar periodos",
      icono: "bi-arrow-left-right",
      hint: "Un periodo contra otro: mes vs mes, interanual y contra el programa",
      items: [
        { t: "¿Cuánto produjo ", slot: "campo", t2: " en ", slot2: "mes", t3: " vs ", slot3: "mes", t4: "?" },
        { t: "Compara ", slot: "mes", t2: " con ", slot2: "mes", t3: " en ", slot3: "campo" },
        { t: "¿Cuánto produjo ", slot: "campo", t2: " en ", slot2: "mes", t3: " vs el mes pasado?" },
        { t: "Compara ", slot: "campo", t2: " en ", slot2: "mes", t3: " contra el mismo mes del año pasado" },
        { t: "Muéstrame la producción de ", slot: "campo", t2: " mes a mes vs el presupuesto" }
      ]
    }
  ];

  // [2026-08-26] Desplegable "Preguntas de esta conversación" (clic = rellena, NO envía —
  // evita reenvíos accidentales de una pregunta vieja). Alcance = SOLO la conversación activa,
  // a propósito: el historial GLOBAL ya vive en el panel "Historial" (historial.js), y mezclar
  // ambos aquí duplicaría el concepto. `b.html` ya es `esc(textoOriginal)` (__cnBubble lo guarda
  // así para las burbujas de usuario) — inyectarlo vía innerHTML lo decodifica una vez, así que
  // `textContent` del botón devuelve el texto original SIN falta un unescape a mano. Las
  // plantillas de __cnHistSeed llegan SIN escapar → se escapan aquí, mismo mecanismo.
  //
  // [2026-08-26] Orden fijo (petición del usuario): las preguntas USADAS van ARRIBA (más
  // reciente primero) y las SUGERIDAS van SIEMPRE abajo, sin importar cuántas preguntas reales
  // ya haya — no se ocultan al aparecer historial real (antes sí, era "una fuente u otra").
  function __cnHistBoton(h) {
    return '<button type="button" class="cn-hist__item" onclick="window.__cnHistUsar(this)" ' +
      'style="display:block;width:100%;text-align:left;background:none;border:0;' +
      'border-bottom:1px solid #eef1ef;padding:8px 12px;font-size:13px;white-space:nowrap;' +
      'overflow:hidden;text-overflow:ellipsis;cursor:pointer;color:#1f2937;" ' +
      'onmouseover="this.style.background=\'#f1f4f1\'" onmouseout="this.style.background=\'none\'">' +
      h + '</button>';
  }
  // [MODAL-PREGUNTAS · rediseño] Pinta el modal categorizado. Solo existe en MainChat: el
  // markup vive en mainchat_layout.html, fuera de #mc-chat-body para que el repintado del
  // acordeón no lo destruya (mismo criterio que el modal de Admin).
  // 🔑 ESCAPADO, dos reglas distintas y deliberadas (ver el comentario de 2026-08-26 arriba):
  //    · el historial (b.html) YA viene escapado por __cnBubble -> se inyecta tal cual;
  //    · las plantillas de __cnHistSeed llegan crudas (t/slot/t2/slot2/t3) -> cada fragmento
  //      pasa por esc() antes de montar el HTML de la fila (ver __cnPregTextoHTML).
  //
  // [MODAL-PREGUNTAS · rediseño] El hueco "…" de cada plantilla ya no es texto libre: cada
  // pregunta es {t, slot, t2, slot2, t3} y el hueco se resalta como pastilla ámbar
  // (.mc-preg-slot) en vez de un carácter "…" perdido en medio de la frase. Dos vistas del
  // mismo dato: __cnPregTextoHTML() arma el HTML con la pastilla (para pintar la fila);
  // __cnPregTextoPlano() reconstruye el texto plano con "…" real (para el input del chat, el
  // desplegable clásico y el buscador de filtro) — NO se parsea con regex, se compone desde
  // los mismos fragmentos con nombre.
  function __cnPregSlotHTML(nombre) {
    return '<span class="mc-preg-slot"><i class="bi bi-pencil-fill" aria-hidden="true"></i>' + esc(nombre) + '</span>';
  }
  // [2026-09-03 · COMPARAR-PERIODOS] Tercer hueco (slot3/t4): las preguntas que comparan
  // dos periodos tienen TRES variables (la entidad y los dos periodos), y con solo dos
  // huecos había que dejar un mes escrito a mano — un ejemplo peor. Es aditivo: las
  // plantillas que no declaran slot3 se comportan exactamente igual que antes.
  function __cnPregTextoHTML(tpl) {
    var h = esc(tpl.t);
    if (tpl.slot) h += __cnPregSlotHTML(tpl.slot);
    h += esc(tpl.t2 || "");
    if (tpl.slot2) h += __cnPregSlotHTML(tpl.slot2);
    h += esc(tpl.t3 || "");
    if (tpl.slot3) h += __cnPregSlotHTML(tpl.slot3);
    h += esc(tpl.t4 || "");
    return h;
  }
  function __cnPregTextoPlano(tpl) {
    var s = tpl.t;
    if (tpl.slot) s += "…";
    s += (tpl.t2 || "");
    if (tpl.slot2) s += "…";
    s += (tpl.t3 || "");
    if (tpl.slot3) s += "…";
    s += (tpl.t4 || "");
    return s;
  }
  // Fila de catálogo (icono de categoría + texto con pastilla(s) + badge de categoría a la
  // derecha). `data-plano` guarda el texto reconstruido con "…" para insertarlo en el input
  // al hacer clic (ver __cnHistUsar) — el navegador des-escapa el atributo solo, no hace
  // falta un unescape manual (mismo mecanismo que ya usa __cnPregItem con b.html).
  function __cnPregFila(tpl, catLabel, catIcono) {
    return '<button type="button" class="mc-preg-row" data-plano="' + esc(__cnPregTextoPlano(tpl)) + '" onclick="window.__cnHistUsar(this)">' +
      '<i class="bi ' + catIcono + ' mc-preg-row__icon" aria-hidden="true"></i>' +
      '<span class="mc-preg-row__text">' + __cnPregTextoHTML(tpl) + '</span>' +
      '<span class="mc-preg-row__badge">' + esc(catLabel) + '</span>' +
      '</button>';
  }
  // Pinta la caja mc-preg-cat-IDX filtrando por `q` (substring, sin distinguir mayúsculas).
  // q="" pinta el catálogo completo de esa categoría. Devuelve cuántas filas quedaron
  // visibles (lo usa el pie y el conteo del sidebar).
  function __cnPregFiltrar(idx, q) {
    var cont = el("mc-preg-cat-" + idx);
    var cat = __cnHistSeed[idx];
    if (!cont || !cat) return 0;
    var qq = (q || "").trim().toLowerCase();
    var filtrados = qq
      ? cat.items.filter(function (tpl) { return __cnPregTextoPlano(tpl).toLowerCase().indexOf(qq) !== -1; })
      : cat.items;
    cont.innerHTML = filtrados.length
      ? filtrados.map(function (tpl) { return __cnPregFila(tpl, cat.cat, cat.icono); }).join("")
      : '<p class="mc-preg-vacio">Sin resultados' + (qq ? ' para «' + esc(q.trim()) + '»' : '') + '.</p>';
    return filtrados.length;
  }
  // Total de plantillas del catálogo (30 hoy), derivado — nunca hardcodeado.
  function __cnPregTotalCatalogo() {
    var t = 0;
    for (var i = 0; i < __cnHistSeed.length; i++) t += __cnHistSeed[i].items.length;
    return t;
  }
  function __cnPregPie(idx, n) {
    var pie = el("mc-preg-foot");
    if (!pie) return;
    var total = __cnPregTotalCatalogo();
    pie.textContent = n + " de " + total + (total === 1 ? " plantilla" : " plantillas");
  }
  // Sincroniza la ficha compartida (icono/nombre/hint) + el filtro + el pie con la pestaña
  // que esté activa AHORA MISMO (lee el DOM, no guarda estado propio). Si la activa es
  // Histórico (o cualquier cosa que no matchee "mc-preg-pane-N"), oculta ficha y pie: la
  // pestaña Histórico no es parte del catálogo, no tiene filtro ni pastillas.
  function __cnPregCatbarSync() {
    var barra = el("mc-preg-catbar"), pie = el("mc-preg-foot");
    if (!barra || !pie) return;
    var idx = __cnPregIdxActivo();
    if (idx === -1) {          // Histórico (o nada activo): sin ficha, sin filtro, sin pie
      barra.hidden = true;
      pie.hidden = true;
      return;
    }
    var cat = __cnHistSeed[idx];
    var icono = el("mc-preg-catbar-icon"); if (icono) icono.className = "bi " + cat.icono;
    var titulo = el("mc-preg-catbar-title"); if (titulo) titulo.textContent = cat.cat;
    var hint = el("mc-preg-catbar-hint"); if (hint) hint.textContent = cat.hint || "";
    var filtro = el("mc-preg-filtro"); if (filtro) filtro.value = "";
    barra.hidden = false;
    pie.hidden = false;
    __cnPregPie(idx, __cnPregFiltrar(idx, ""));
  }
  function __cnPregModalPintar() {
    var cont = el("mc-preg-hist");
    var qs = [];
    if (cont) {
      qs = __cnHistory.filter(function (b) { return b.role === "user"; })
                       .map(function (b) { return b.html; }).reverse();
      cont.innerHTML = qs.length
        ? qs.map(__cnPregItem).join("")
        : '<p class="mc-preg-vacio">Todavía no has preguntado nada en esta conversación.</p>';
    }
    var histCnt = el("mc-preg-navcount-hist");
    if (histCnt) histCnt.textContent = qs.length;
    // Las categorías son estáticas en el HTML; aquí se rellenan sus listas + el conteo del
    // sidebar. El índice del panel coincide con el del array porque el nav se escribe en el
    // mismo orden (ver mainchat_layout.html).
    for (var i = 0; i < __cnHistSeed.length; i++) {
      var n = __cnPregFiltrar(i, "");
      var cnt = el("mc-preg-navcount-" + i);
      if (cnt) cnt.textContent = n;
    }
    var totEl = el("mc-preg-total");
    if (totEl) {
      var total = __cnPregTotalCatalogo();
      totEl.textContent = total + (total === 1 ? " plantilla" : " plantillas");
    }
    __cnPregCatbarSync();
  }

  function __cnPregItem(h) {
    return '<button type="button" class="mc-preg-item" onclick="window.__cnHistUsar(this)">' +
      h + '</button>';
  }

  window.__cnHistToggle = function () {
    // [2026-09-03 · MODAL-PREGUNTAS] Dos caminos a propósito. multitab_shell.js lo montan LAS
    // DOS interfaces, pero el modal solo existe en /mainchat: si no está en el DOM se cae al
    // desplegable de siempre, que se conserva íntegro. Sin esta bifurcación el botón del reloj
    // quedaría muerto en la vista clásica — una regresión en una interfaz que nadie pidió tocar.
    var m = el("mc-preguntas-modal");
    if (m && typeof window.bootstrap !== "undefined" && window.bootstrap.Modal) {
      __cnPregModalPintar();
      window.bootstrap.Modal.getOrCreateInstance(m).show();
      return;
    }
    var d = el("cn-hist-drop"); if (!d) return;
    if (!d.hidden) { d.hidden = true; return; }
    var qs = __cnHistory.filter(function (b) { return b.role === "user"; })
                         .map(function (b) { return b.html; }).reverse();
    var cabeceraSeed = '<div style="padding:8px 12px 4px;color:#6E7C75;font-size:11px;' +
      'text-transform:uppercase;letter-spacing:.03em;">Preguntas de ejemplo — edita el "…" ' +
      'antes de enviar</div>';
    // [MODAL-PREGUNTAS · rediseño] __cnHistSeed ya no es plano ni de strings: se aplana aquí
    // reconstruyendo el texto de cada plantilla con __cnPregTextoPlano, para el desplegable de
    // la vista clásica, que sigue siendo una lista sin categorías ni pastillas.
    var planas = [];
    for (var i = 0; i < __cnHistSeed.length; i++) {
      for (var j = 0; j < __cnHistSeed[i].items.length; j++) {
        planas.push(__cnPregTextoPlano(__cnHistSeed[i].items[j]));
      }
    }
    d.innerHTML = qs.map(__cnHistBoton).join("") +
      cabeceraSeed + planas.map(esc).map(__cnHistBoton).join("");
    d.hidden = false;
  };
  window.__cnHistUsar = function (btn) {
    var inp = el("cn-input"); if (!inp || !btn) return;
    // [MODAL-PREGUNTAS · rediseño] Las filas de catálogo cargan su texto plano en
    // data-plano (con "…" real, ver __cnPregFila); el resto (Histórico real, desplegable
    // clásico) sigue usando textContent como siempre.
    inp.value = (btn.dataset && btn.dataset.plano) ? btn.dataset.plano : btn.textContent;
    var d = el("cn-hist-drop"); if (d) d.hidden = true;
    // [2026-09-03 · MODAL-PREGUNTAS] Cierra el modal si el clic vino de ahí. `getInstance`
    // (no `getOrCreateInstance`): si el modal nunca se abrió no hay nada que cerrar y crear
    // una instancia para nada sería un efecto colateral silencioso.
    var m = el("mc-preguntas-modal");
    if (m && typeof window.bootstrap !== "undefined" && window.bootstrap.Modal) {
      var inst = window.bootstrap.Modal.getInstance(m);
      if (inst) inst.hide();
    }
    inp.focus();
    // [MODAL-PREGUNTAS · rediseño] Deja seleccionado el primer "…" para que el usuario
    // escriba encima sin tener que borrarlo a mano.
    var idxPunto = inp.value.indexOf("…");
    if (idxPunto !== -1 && inp.setSelectionRange) { inp.setSelectionRange(idxPunto, idxPunto + 1); }
  };
  // [2026-09-03 · MODAL-PREGUNTAS-REDISEÑO] Dos listeners a nivel `document`, mismo criterio
  // que el listener de clic de más abajo y por el mismo motivo: se registran una vez al cargar
  // el script y resuelven los nodos por id EN CADA evento, así que no dependen del orden de
  // carga ni de que el nodo sobreviva a un repintado. `input` y `shown.bs.tab` burbujean,
  // así que la delegación los alcanza igual.
  //   · input        -> filtra SOLO la categoría activa y repinta su pie.
  //   · shown.bs.tab -> lo dispara Bootstrap al cambiar de pestaña; resincroniza ficha,
  //                     filtro (lo vacía) y pie. Por eso no hace falta limpiar el filtro
  //                     en ningún otro sitio.
  // __cnPregIdxActivo() devuelve el índice de la categoría activa, o -1 si la activa es
  // Histórico (que no es una categoría del catálogo).
  function __cnPregIdxActivo() {
    var activo = document.querySelector("#mc-preguntas-modal .mc-preg-nav__item.active");
    var destino = activo ? (activo.getAttribute("data-bs-target") || "") : "";
    var m = destino.match(/^#mc-preg-pane-(\d+)$/);
    if (!m) return -1;
    var idx = parseInt(m[1], 10);
    return __cnHistSeed[idx] ? idx : -1;
  }
  document.addEventListener("input", function (ev) {
    if (!ev.target || ev.target.id !== "mc-preg-filtro") return;
    var idx = __cnPregIdxActivo();
    if (idx === -1) return;
    __cnPregPie(idx, __cnPregFiltrar(idx, ev.target.value));
  });
  document.addEventListener("shown.bs.tab", function (ev) {
    if (!ev.target || !ev.target.closest || !ev.target.closest("#mc-preguntas-modal")) return;
    __cnPregCatbarSync();
  });
  // Cierra el desplegable al hacer clic fuera. Un solo listener a nivel documento (se registra
  // una vez al cargar el script): busca los nodos por id en cada clic, así que sigue funcionando
  // aunque renderConsultaBody() reconstruya el DOM al cambiar de pestaña.
  document.addEventListener("click", function (ev) {
    var d = el("cn-hist-drop"); if (!d || d.hidden) return;
    var dentro = (ev.target.closest && (ev.target.closest("#cn-hist-drop") || ev.target.closest("#cn-hist-btn")));
    if (!dentro) d.hidden = true;
  });
  var __cnCid = "cn-" + Math.floor(Math.random() * 1e9);   // conversation_id de la sesión
  var __cnHistory = [];   // [{role, html}] — persiste al cambiar de pestaña y se repinta en __cnReplay
  var __cnNivelLabel = {vicepresidencia: "Vicepresidencia", gerencia: "Gerencia", activo: "Activo",
    area: "Área", campo: "Campo", fuente: "Fuente (pozo)", operador: "Operador",
    filial: "Filial (empresa)", pozo: "Fuente (pozo)"};
  var __cnNivelIcon = {operador:"diagram-3", filial:"building", fuente:"geo-alt", pozo:"geo-alt",
    campo:"hexagon", area:"map", activo:"box-seam", gerencia:"diagram-2", vicepresidencia:"building"};
  // Género del nivel, solo para la concordancia del título ("del Campo" vs "de la Gerencia").
  // "Área" es femenino pero lleva artículo masculino ("el área" → "del Área"), de ahí el "el".
  var __cnNivelArt = {vicepresidencia:"la", gerencia:"la", activo:"el", area:"el", campo:"el",
    fuente:"la", operador:"el", filial:"la", pozo:"la"};

  // [2026-07-29] D-A5 en el PANEL: el título debe decir el nivel. "Desempeño de CASTILLA" era
  // ambiguo — el Campo CASTILLA (6,9M bbl) y el Activo CASTILLA (CASTILLA + CASTILLA NORTE, 11,7M)
  // se mostraban con el MISMO título. Es el principio que el chat aplica desde el 16-jul ("el Campo
  // APIAY" vs "el Activo APIAY"); faltaba trasladarlo al panel. Sin nivel, degrada al texto anterior.
  function __cnTituloEnt(entidad, nivel) {
    var lbl = __cnNivelLabel[nivel];
    if (!lbl) return '<i class="bi bi-bar-chart-line-fill"></i> Desempeño de ' + esc(entidad);
    var prep = (__cnNivelArt[nivel] === "la") ? "de la" : "del";
    return '<i class="bi bi-' + (__cnNivelIcon[nivel] || "bar-chart-line-fill") + '"></i> ' +
      'Desempeño ' + prep + ' ' + lbl + ' ' + esc(entidad);
  }
  function __cnOptIcon(o) {   // usa o.icon si el backend lo manda; si no, lo deriva del nivel (prefijo de o.id)
    if (o.icon) return o.icon;
    var niv = String(o.id || "").split("::")[0];
    return __cnNivelIcon[niv] || "diagram-3";
  }

  // Personalización con el nombre del usuario logueado (window.USER_FIRST_NAME viene de la sesión
  // Flask, expuesto en main.html). Se usa en momentos de trato directo (saludo y preguntas), no en
  // cada burbuja. Si no hay nombre, degrada limpio al texto original.
  function __cnNombre() { return (window.USER_FIRST_NAME || "").trim(); }
  // [2026-08-25] Hora del turno, 24h determinista. NO se usa toLocaleTimeString('es-CO'):
  // ese locale es de 12 horas por defecto ("8:31 p. m."). Mismo patrón que historial.js:93.
  function __cnHora() {
    var f = new Date(), dd = function (n) { return (n < 10 ? "0" : "") + n; };
    return dd(f.getHours()) + ":" + dd(f.getMinutes());
  }
  function __cnConNombre(texto) {   // "Nombre, " + minúscula inicial del texto, si hay nombre
    var n = __cnNombre();
    if (!n || !texto) return texto;
    return n + ", " + texto.charAt(0).toLowerCase() + texto.slice(1);
  }

  var __cnMesAbr = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function __cnFmtFecha(iso) {   // "2025-11-26" -> "26-nov-2025"
    if (!iso) return "";
    var p = String(iso).split("-");
    if (p.length !== 3) return esc(iso);
    return parseInt(p[2], 10) + "-" + (__cnMesAbr[parseInt(p[1], 10) - 1] || p[1]) + "-" + p[0];
  }
  // Botones de siguiente paso: placeholders mientras se diseña la fase de ejecución (D1: el número es Fase 3).
  window.__cnEnDiseno = function (el0) {
    if (!el0 || el0.dataset.noted) return;
    el0.dataset.noted = "1";
    var n = document.createElement("div");
    n.className = "small text-warning mb-2";
    n.innerHTML = '<i class="fas fa-screwdriver-wrench me-1"></i>En diseño — pronto.';
    el0.insertAdjacentElement("afterend", n);
  };

  // Días con reporte por entidad (poblados desde /densidad del dashboard). El <input type=date> nativo
  // solo acota por rango min/max — NO puede deshabilitar días sueltos (huecos). Validamos al seleccionar.
  var __cnDiasByEnt = {};   // {ENTIDAD_UPPER: Set(fechas ISO con dato)}
  window.__cnValidarDia = function (input) {
    if (!input) return;
    var wrap = input.parentNode;
    var prev = wrap.querySelector(".cn-dia-msg"); if (prev) prev.remove();
    var set = __cnDiasByEnt[(input.dataset.ent || "").toUpperCase()];
    var v = input.value;
    if (!v || !set) return;   // aún sin lista (densidad no cargó) → solo aplica el rango min/max
    if (!set.has(v)) {
      input.value = "";       // rechaza el día sin reporte
      var m = document.createElement("div");
      m.className = "cn-dia-msg small text-danger mt-1";
      m.innerHTML = '<i class="fas fa-circle-xmark me-1"></i>Ese día no tiene reporte — elige uno con dato.';
      wrap.appendChild(m);
    }
  };

  var __cnLastIntent = null;   // último intent resuelto → para repintar el dashboard al volver a la pestaña
  var __cnNivel = null, __cnPeriodo = null;   // nivel/periodo del análisis activo (para los 3 fetches)
  function __cnViewerArea() { return el("cn-canvas") || el("cn-viewer-area"); }

  // Pila acumulativa de paneles Motor Q v2 (#cn-stack, DEBAJO de #cn-canvas dentro del scroller
  // .cn-col). Nunca se destruye salvo por renderViewer, que la salva antes en state.consultaStackCache.
  var __cnStackOn  = false;   // true = ya llegó al menos un panel (la pila tiene contenido)
  var __cnStackSeq = 0;       // nº incremental de bloque
  var __CN_STACK_MAX = 100;   // tope silencioso: al superarlo se descarta el bloque más antiguo

  // Aviso guía en el panel derecho (estado pendiente / previo a resolver). Escribe SOLO dentro de
  // #cn-viewer-area; la cabecera verde del viewer la mantiene renderViewer.
  function __cnDashHint(texto) {
    var a = __cnViewerArea(); if (!a) return;
    __cnStackHide();   // render v1 en el lienzo → si la pila estaba activa, descúbrela (D6)
    a.innerHTML =
      '<div class="rb-cp-vempty"><div class="rb-cp-vempty__inner">' +
      '  <div class="rb-cp-vempty__chip"><i class="bi bi-hand-index"></i></div>' +
      '  <div class="rb-cp-vempty__eyebrow">Panorama</div>' +
      '  <p class="rb-cp-vempty__hint">' + esc(texto) + '</p>' +
      '</div></div>';
  }

  // Dashboard de la entidad resuelta. USA intent.rama CRUDO ("A"/"B") — NO el texto de display de __cnRender.
  window.__cnDashboard = function (intent) {
    __cnLastIntent = intent;
    var a = __cnViewerArea(); if (!a || !intent) return;
    __cnStackHide();   // render v1 en el lienzo → si la pila estaba activa, descúbrela (D6)
    var ent = intent.valor || intent.entidad;
    var esFilial = (intent.rama === "B");
    var nivelLabel = __cnNivelLabel[intent.nivel] || intent.nivel;

    a.innerHTML =
      '<div class="rb-pano">' +
      '  <div class="rb-pano__subhead"><i class="bi bi-bar-chart-line-fill"></i>' +
      '    <span class="rb-pano__subhead-title">Panorama de <strong>' + esc(ent) + '</strong></span>' +
      '    <span class="rb-pano__subhead-tipo">· ' + esc(nivelLabel) + (esFilial ? " (filial)" : "") + '</span></div>' +
      '  <div class="rb-pano__body">' +
      '    <div id="cn-dash-densidad"><div class="rb-pano__loading">Calculando densidad…</div></div>' +
      '    <div id="cn-dash-cobertura"><div class="rb-pano__loading">Cobertura…</div></div>' +
      '  </div>' +
      '</div>';

    // Densidad: SOLO rama A (ECP). Rama B (filial) → nota, sin heatmap (coherente con _huella).
    // La cobertura (consulta PESADA ~10s, payload::text ILIKE full-scan) se carga SECUENCIALMENTE
    // DESPUÉS de la densidad — NO en paralelo — para no juntar los dos picos de RAM (8GB) que cerraban
    // el navegador. Resultado: ambos reportes quedan con datos, sin clic extra.
    var dEl = el("cn-dash-densidad");
    var cEl = el("cn-dash-cobertura");
    if (esFilial) {
      if (dEl) dEl.innerHTML = '<div class="rb-pano__empty"><i class="bi bi-building"></i>' +
        'Es una <strong>empresa filial</strong>: su producción es <strong>cifra consolidada</strong> ' +
        '(sin grano diario ECP). Revisa su presencia abajo, en <strong>Cobertura del reporte</strong>.</div>';
      window.__cnLoadCobertura(ent);
    } else {
      if (cEl) cEl.innerHTML = '<div class="rb-pano__loading">Cobertura en cola (se carga tras la densidad)…</div>';
      fetch("/api/analisis/densidad?entidad=" + encodeURIComponent(ent))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (dEl) dEl.innerHTML = __cnPanoDensidad(d);   // KPIs + dot-matrix (CSS, sin Plotly)
          if (d.aplica_ecp !== false && d.dias && d.dias.length) {
            __cnDiasByEnt[String(ent).toUpperCase()] =    // CONSERVAR: valida el selector de "un día"
              new Set(d.dias.map(function (x) { return x.fecha; }));
          }
        })
        .catch(function () { if (dEl) dEl.innerHTML = '<div class="rb-pano__empty">Error calculando la densidad.</div>'; })
        .then(function () { window.__cnLoadCobertura(ent); });
    }
  };

  // Carga de la cobertura (secuencial tras densidad). entArg explícito evita carreras si el usuario
  // resuelve otra entidad mientras la densidad previa aún cargaba; si falta, cae al último intent.
  window.__cnLoadCobertura = function (entArg) {
    var ent = entArg;
    if (!ent) { var it = __cnLastIntent; if (!it) return; ent = it.valor || it.entidad; }
    var cEl = el("cn-dash-cobertura"); if (!cEl) return;
    cEl.innerHTML = '<div class="text-muted small p-2"><span class="spinner-border spinner-border-sm"></span> ' +
      'Buscando presencia de ' + esc(ent) + '… (~10s)</div>';
    fetch("/api/analisis/cobertura?entidad=" + encodeURIComponent(ent))
      .then(function (r) { return r.json(); })
      .then(function (cob) { var c2 = el("cn-dash-cobertura"); if (c2) c2.innerHTML = __cnPanoCobertura(cob); })
      .catch(function () { var c2 = el("cn-dash-cobertura"); if (c2) c2.innerHTML =
        '<div class="alert alert-danger small mb-0">Error cargando la cobertura.</div>'; });
  };

  // ============================================================
  // Consulta · "Ver el reporte de un día": 2 tarjetas (árbol + visor de tabla) en el panel DERECHO.
  // Reusa /api/ingesta/check_existing (fecha→reporte_id), /api/tablas-hoja/arbol/<id> y renderTablaAncha.
  // ============================================================

  // onchange del <input type=date>. Valida (reusa __cnValidarDia), resuelve reporte_id y pinta las 2 tarjetas.
  window.__cnVerReporteDia = function (input) {
    if (!input) return;
    window.__cnValidarDia(input);          // valida y limpia el value si el día no tiene reporte
    var v = input.value;                    // ISO YYYY-MM-DD; queda "" si fue rechazado
    if (!v) return;
    var yyyymmdd = v.replace(/-/g, "");      // [F1] check_existing exige \d{8} SIN guiones
    var a = __cnViewerArea(); if (!a) return;
    __cnStackHide();   // render v1 en el lienzo → si la pila estaba activa, descúbrela (D6)
    // El reporte del día es un DRILL-DOWN desde el análisis de la entidad → volver = a ese análisis
    // (no al global: te sacaría del contexto que acabas de pedir). El rótulo dice a dónde va.
    var entVolver = __cnLastIntent ? (__cnLastIntent.valor || __cnLastIntent.entidad || "") : "";
    var volver = entVolver
      ? '<button type="button" class="cn-rep__back" onclick="window.__cnReanalizar()">' +
        '<i class="bi bi-arrow-left"></i> Volver al análisis de ' + esc(entVolver) + '</button>'
      : '<button type="button" class="cn-rep__back" onclick="window.__cnVolverPanorama()">' +
        '<i class="bi bi-arrow-left"></i> Volver al panorama</button>';
    a.innerHTML =
      '<div class="cn-rep">' +
      '  <div class="cn-rep__bar">' + volver +
      '    <span class="cn-rep__date"><i class="bi bi-calendar-event"></i> Reporte del ' + esc(__cnFmtFecha(v)) + '</span>' +
      '  </div>' +
      '  <div class="cn-rep__grid">' +
      '    <div class="cn-rep__tree">' +
      '      <div class="cn-rep__card-hd"><i class="bi bi-diagram-3"></i> Hojas del reporte</div>' +
      '      <div id="cn-rep-tree" class="cn-rep__tree-body">' +
      '        <div class="d-flex align-items-center gap-2 p-2 text-muted small">' +
      '          <div class="spinner-border spinner-border-sm"></div> Cargando hojas…</div></div>' +
      '    </div>' +
      '    <div class="cn-rep__table">' +
      '      <div class="cn-rep__card-hd" id="cn-rep-thd"><i class="bi bi-table"></i> Selecciona una tabla</div>' +
      '      <div id="cn-rep-tabla" class="cn-rep__table-body">' +
      '        <div class="rb-cp-vempty"><div class="rb-cp-vempty__inner">' +
      '          <div class="rb-cp-vempty__chip"><i class="bi bi-hand-index"></i></div>' +
      '          <div class="rb-cp-vempty__eyebrow">Selecciona una tabla</div>' +
      '          <p class="rb-cp-vempty__hint">Haz clic en una tabla del árbol para ver sus datos.</p>' +
      '        </div></div></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';
    fetch("/api/ingesta/check_existing?fecha=" + yyyymmdd)
      .then(function (r) { return r.json(); })
      .then(function (info) {
        var treeEl = el("cn-rep-tree");
        if (!info || !info.exists || info.reporte_id == null) {
          if (treeEl) treeEl.innerHTML = '<div class="p-2 text-muted small">No hay reporte ingerido para esta fecha.</div>';
          return;
        }
        return fetch("/api/tablas-hoja/arbol/" + info.reporte_id)
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var hojas = (data && data.hojas) || [];
            var t2 = el("cn-rep-tree"); if (!t2) return;
            t2.innerHTML = hojas.length
              ? '<ul class="ct-root">' + __cnBuildHojas(info.reporte_id, hojas) + '</ul>'
              : '<div class="p-2 text-muted small">Sin hojas modeladas para este reporte.</div>';   // [F6]
          });
      })
      .catch(function () {
        var t3 = el("cn-rep-tree");
        if (t3) t3.innerHTML = '<div class="p-2 text-danger small">Error cargando el reporte.</div>';
      });
  };

  // "Volver al panorama" = el Desempeño GLOBAL, el mismo con el que abre la charla (2026-07-16).
  // Antes iba al Panorama de la ENTIDAD (Densidad + Cobertura): un residuo de cuando esa era la vista
  // por defecto al resolverla. Cambiamos el default al Desempeño y el botón se quedó apuntando a la
  // huella, así que "volver" te llevaba a una TERCERA pantalla que nunca habías visto, no al inicio.
  // La huella sigue viva, ahora se pide hablando: "¿qué información hay de APIAY?" (meta.py).
  window.__cnVolverPanorama = function () {
    window.__cnAnalizar(null);
  };

  // Gráfico de EVOLUCIÓN mensual de una filial con DOBLE eje Y: Crudo/Blancos en bbl (eje izq),
  // Gas en MSCF (eje der). El mes en curso (proyectado_idx) se marca con un anillo hueco + línea
  // punteada vertical + anotación "proyección", para no confundir la proyección con dato cerrado.
  function __cnFilSeriePlot(serie) {
    var elp = el("cn-fil-serie"); if (!elp || !serie) return;
    if (!window.Plotly) { elp.innerHTML = '<div class="text-muted small p-2">(Plotly no disponible)</div>'; return; }
    var meses = serie.meses || [], S = serie.series || {};
    if (!meses.length || !Object.keys(S).length) { elp.innerHTML = '<div class="text-muted small p-2">Sin serie mensual.</div>'; return; }
    var NOM = { CRUDO: "Crudo (bbl)", BLANCOS: "Blancos (bbl)", GAS: "Gas (MSCF)" };
    var pidx = serie.proyectado_idx;
    var traces = [];
    ["CRUDO", "BLANCOS", "GAS"].forEach(function (p) {
      if (!S[p]) return;
      var isGas = (p === "GAS");
      var pc = __cnProdCol(p);   // identidad de color por producto (única fuente: __CP_PROD)
      traces.push({
        x: meses, y: S[p], name: NOM[p], type: "scatter", mode: "lines+markers",
        yaxis: isGas ? "y2" : "y", connectgaps: false,
        line: { color: pc, width: 2.5, shape: "spline", smoothing: 0.8 }, marker: { color: pc, size: 7 },
        hovertemplate: "%{x}<br>" + NOM[p] + ": %{y:,.0f}<extra></extra>"
      });
      if (pidx != null && S[p][pidx] != null) {   // anillo hueco sobre el mes proyectado
        traces.push({
          x: [meses[pidx]], y: [S[p][pidx]], type: "scatter", mode: "markers",
          yaxis: isGas ? "y2" : "y", showlegend: false, hoverinfo: "skip",
          marker: { color: "#fff", size: 11, symbol: "circle", line: { color: pc, width: 2 } }
        });
      }
    });
    var shapes = [], anns = [];
    if (pidx != null) {
      shapes.push({ type: "line", x0: meses[pidx], x1: meses[pidx], y0: 0, y1: 1, yref: "paper",
                    line: { color: "#c2cbc6", width: 1, dash: "dot" } });
      anns.push({ x: meses[pidx], y: 1, yref: "paper", yanchor: "bottom", showarrow: false,
                  text: "proyección", font: { size: 10, color: "#8a978f" } });
    }
    var layout = {
      margin: { l: 62, r: 58, t: 22, b: 30 }, height: 300, hovermode: "x unified",
      showlegend: true, legend: { orientation: "h", y: -0.16, x: 0, font: { size: 11 } },
      xaxis: { tickfont: { size: 11 }, showgrid: false },
      yaxis: { title: { text: "bbl", font: { size: 11 } }, tickfont: { size: 10 }, rangemode: "tozero",
               separatethousands: true, gridcolor: "#eef1ef", zeroline: false },
      yaxis2: { title: { text: "MSCF", font: { size: 11 } }, tickfont: { size: 10 }, overlaying: "y",
                side: "right", rangemode: "tozero", separatethousands: true, showgrid: false, zeroline: false },
      shapes: shapes, annotations: anns, plot_bgcolor: "#fff", paper_bgcolor: "#fff"
    };
    window.Plotly.newPlot(elp, traces, layout, { displayModeBar: false, responsive: true });
  }

  // Panel EXCLUSIVO de UNA filial (Hocol/America/Permian): SOLO su información — proyección de cierre
  // por producto vs su PROPIO promedio 2026. NO el panorama de las 3, NO "Hocol como operador ECP".
  // Reusa /analisis/tendencia_filial (mismo motor _fil_tendencia del chat y del desglose por filial) →
  // la cifra coincide con la burbuja y con el acordeón. "Volver" regresa al panorama de filiales.
  window.__cnTendenciaFilial = function (empresa) {
    var a = __cnViewerArea(); if (!a) return;
    __cnStackHide();   // render v1 en el lienzo → si la pila estaba activa, descúbrela (D6)
    var nom = empresa || "";
    a.innerHTML =
      '<div class="cn-desemp">' +
      '  <div class="cn-rep__bar">' +
      '    <button type="button" class="cn-rep__back" onclick="window.__cnAnalizar(null,\'filiales\')">' +
      '      <i class="bi bi-arrow-left"></i> Volver a filiales</button>' +
      '    <span class="cn-rep__date"><i class="bi bi-building"></i> Desempeño de ' + esc(nom) + '</span>' +
      '  </div>' +
      '  <div class="cn-desemp__scroll"><div id="cn-fil-top" class="cn-ejec-top">' +
      '    <div class="d-flex align-items-center gap-2 p-3 text-muted small">' +
      '      <div class="spinner-border spinner-border-sm"></div> Calculando el desempeño de ' + esc(nom) + '…</div>' +
      '  </div></div></div>';
    fetch("/api/analisis/tendencia_filial?empresa=" + encodeURIComponent(nom))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var host = el("cn-fil-top"); if (!host) return;
        if (!d || d.encontrada === false) {
          host.innerHTML = '<div class="p-3 text-muted small">No reconocí «' + esc(nom) + '» como filial.</div>'; return; }
        if (d.sin_datos) {
          host.innerHTML = '<div class="p-3 text-muted small">Sin datos de producción para ' + esc(nom) + '.</div>'; return; }
        if (d.sin_tendencia) {
          host.innerHTML = '<div class="p-3 text-muted small">' + esc(nom) + ' aún no tiene meses completos de 2026 para comparar la tendencia.</div>'; return; }
        var nm = (d.n_meses != null) ? d.n_meses : d.n_base;   // n_meses = meses reales (n_base era productos)
        var nota = (nm != null && nm < 3)
          ? '<p class="rb-chat__note">El promedio 2026 se basa en ' + nm + ' mes' + (nm === 1 ? '' : 'es') +
            ' completo' + (nm === 1 ? '' : 's') + ' (poca historia todavía).</p>'
          : '';
        var serieHtml = (d.serie_mensual && (d.serie_mensual.meses || []).length)
          ? '<div class="cn-fil-serie-wrap">' +
              '<div class="cn-fil-serie-hd"><i class="bi bi-graph-up"></i> Evolución mensual · ' +
              'Crudo/Blancos en bbl (eje izq.) · Gas en MSCF (eje der.)</div>' +
              '<div id="cn-fil-serie" class="cn-fil-serie"></div>' +
              '<p class="rb-chat__note">Meses completos en línea sólida; el mes en curso (marcado ○) es la ' +
              'proyección de cierre, no el acumulado parcial.</p>' +
            '</div>'
          : '';
        host.innerHTML =
          '<div class="cn-ejec__hd"><span class="cn-ejec__hd-ic"><i class="bi bi-building"></i></span>' +
          '  ' + esc(nom) + ' · ' + esc(d.periodo || "") + ' · proyección · ' + (d.ndias || 0) + '/' + (d.dim || 0) + ' días</div>' +
          '<p class="rb-chat__note">Comparo la proyección de cierre del mes contra el promedio mensual 2026 de esta filial. ' +
          'Las filiales no manejan presupuesto: la referencia es su propia historia del año.</p>' +
          '<div class="cn-kpi__row">' + __cnTarjetasKpiHtml(d.tarjetas || [], d.periodo) + '</div>' + nota + serieHtml;
        __cnFilSeriePlot(d.serie_mensual);
      })
      .catch(function () {
        var host = el("cn-fil-top");
        if (host) host.innerHTML = '<div class="alert alert-danger m-3">Error calculando el desempeño de la filial.</div>';
      });
  };

  // [F3] Clon de buildHojasHtml (Control) pero con onclick a __cnVerTabla (NO verTablaHoja, atado a
  // #charts-display-area). Reusa __ctToggle (genérico) y los estilos .ct-*/.ig-trow/.ig-badge.
  function __cnBuildHojas(reporteId, hojas) {
    var h = "";
    hojas.forEach(function (hoja) {
      h += '<li class="ct-node ct-hoja">' +
        '<div class="ct-hd ct-hd--leaf" onclick="window.__ctToggle(this)">' +
        '<i class="bi bi-chevron-right ct-chev"></i>' +
        '<i class="bi bi-file-earmark"></i> ' + esc(hoja.hoja) +
        ' <span class="ig-badge ig-badge--gray">' + hoja.tablas.length +
        (hoja.tablas.length === 1 ? " tabla" : " tablas") + '</span></div>' +
        '<ul class="ct-kids">';
      hoja.tablas.forEach(function (t) {
        h += '<li class="ct-leaf">' +
          '<button type="button" class="ig-trow" onclick="window.__cnVerTabla(' +
          reporteId + ',\'' + esc(hoja.hoja).replace(/'/g, "\\'") + '\',' +
          t.tabla_idx + ',\'' + esc(t.tabla_label).replace(/'/g, "\\'") + '\')">' +
          '<i class="bi bi-table"></i>' +
          '<span class="ig-trow__name">' + esc(t.tabla_label) + '</span>' +
          '<span class="ig-badge ig-badge--gray">' + nfCtrl(t.filas) + ' filas</span>' +
          '</button></li>';
      });
      h += '</ul></li>';
    });
    return h;
  }

  // [F2] Render de la tabla elegida en la tarjeta DERECHA del reporte. Reusa renderTablaAncha (chat.js).
  window.__cnVerTabla = function (reporteId, hoja, tablaIdx, label) {
    var area = el("cn-rep-tabla"); if (!area) return;
    var thd = el("cn-rep-thd");
    if (thd) thd.innerHTML = '<i class="bi bi-table"></i> ' + esc(hoja) + ' — ' + esc(label);
    area.innerHTML = '<div class="d-flex align-items-center gap-2 p-3">' +
      '<div class="spinner-border spinner-border-sm"></div> Cargando tabla…</div>';
    var url = "/api/tablas-hoja/datos?reporte_id=" + encodeURIComponent(reporteId) +
              "&hoja=" + encodeURIComponent(hoja) + "&tabla_idx=" + encodeURIComponent(tablaIdx);
    fetch(url)
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
      .then(function (res) {
        if (!res.ok) {
          area.innerHTML = '<div class="alert alert-danger m-3">Error: ' +
            esc(String(res.data.error || res.data.detail || res.status)) + '</div>';
          return;
        }
        window.renderTablaAncha(area, res.data, hoja + " — " + label);
      })
      .catch(function (e) {
        area.innerHTML = '<div class="alert alert-danger m-3">Fallo de red: ' + esc(String(e)) + '</div>';
      });
  };

  // ============================================================
  // Consulta · "Analizar {entidad}": Desempeño del mes (Producción ECP) en el panel DERECHO.
  // Módulos MVP: KPIs REAL vs PPTO + barras Real/Presupuesto + curva diaria REAL (Plotly).
  // ============================================================
  var __cnDesempData = null;   // cache del payload para el selector de producto de la curva
  // Cachés de sesión (persisten entre reconstrucciones del DOM del visor; se limpian solo al recargar
  // la página). Evitan regenerar el desempeño y — sobre todo — el Titular IA (LLM) al interactuar.
  var __cnDesempCache = {};    // /desempeno por entidad ("__global__" = global)
  var __cnInsCache = {};       // /desempeno_insight (LLM) por entidad
  // Bloque "en curso" (Mayo · valle + eventos + Real/PPTO diario) OCULTO por decisión de UX: es
  // redundante con las tarjetas KPI + Focos de atención de arriba. NO se elimina — poner en true
  // para volver a mostrarlo (recupera el bloque completo tal cual, incluidos sus fetches).
  var __CN_DESEMP_VISIBLE = false;
  var __cnComportEnt = null;   // entidad activa del bloque "Comportamiento diario" (null = global)
  var __cnEjecCache = {};      // /analisis/ejecutivo por entidad ("__global__" = global). Cacheado como __cnDesempCache.
  var __cnEjecData = null;     // payload actual, para el selector de producto de los gráficos
  var __cnEjecProd = null;     // producto seleccionado en los gráficos (CRUDO/GAS/BLANCOS)
  var __cnEjecD = null;        // último payload de /ejecutivo, para la carga lazy de "Series completas" (focos)
  var __cnSeg = "ecp";         // "ecp" | "filiales" — segmento activo del panel apilado
  // Entidad ECP (rama A) que el panel DERECHO está analizando ahora mismo; null = panorama global /
  // Filiales / una filial (rama B) → en todos esos casos "Desempeño Filiales" SÍ aplica. (2026-07-24)
  var __cnPanelEntidad = null;
  function __cnEsFil() { return __cnSeg === "filiales"; }
  // ¿El payload de /ejecutivo es de filiales? Solo el de filiales trae por_filial (Hocol/America/Permian).
  function __cnPayloadEsFil(d) { return !!(d && d.por_filial && d.por_filial.length); }
  // querystring común a los 3 fetches del panel (entidad + segmento). En filiales v1 NUNCA hay entidad.
  function __cnSegQS(entidad) {
    var qs = [];
    if (entidad && !__cnEsFil()) qs.push("entidad=" + encodeURIComponent(entidad));
    if (__cnEsFil()) qs.push("segmento=filiales");
    if (!__cnEsFil() && __cnNivel) qs.push("nivel=" + encodeURIComponent(__cnNivel));
    if (!__cnEsFil() && __cnPeriodo) qs.push("periodo=" + encodeURIComponent(__cnPeriodo));
    return qs.length ? "?" + qs.join("&") : "";
  }

  // Clave de caché = TODO lo que identifica la petición (segmento + entidad + nivel + periodo).
  // 🔑 2026-07-16: antes era solo `segmento|entidad`, así que el zoom a Activo daba CACHE HIT sobre
  // la respuesta del Campo: la burbuja decía "el Activo APIAY · 577.362 · 108.8%" mientras el panel
  // seguía pintando el Campo (269.035 · 50.7% · Foco). Dos verdades distintas en la misma pantalla.
  // El fetch ya mandaba `nivel` (ver __cnSegQS); era la caché la que cortaba antes de salir.
  function __cnCacheKey(entidad) {
    return __cnSeg + "|" + (entidad || "__global__") +
           "|" + (__cnNivel || "-") + "|" + (__cnPeriodo || "-");
  }

  // ── Prefetch del panel global "Desempeño del mes" (ECP) al CARGAR LA PÁGINA, antes de que el usuario
  // abra el shell. Pide los MISMOS endpoints que pinta el panel y los guarda en las MISMAS cachés con la
  // MISMA clave global → al abrir Consulta es cache-HIT (instantáneo) y, aunque no alcance a terminar,
  // deja a Gemma caliente. Clave verificada: al abrir Consulta sin entidad corre __cnAnalizar(null) →
  // __cnSeg="ecp", __cnNivel=null, __cnPeriodo=null → "ecp|__global__|-|-" y querystring vacío.
  //
  // 🔒 REGLAS (no relajar):
  //  1) NO toca el DOM: el shell aún no está montado. Solo fetch + validación + caché. Tampoco fija
  //     __cnEjecD / __cnDesempData (son estado de pintado; los setea paint cuando el panel se abre).
  //  2) Guardas de "no cachear errores" IDÉNTICAS a las del panel: un error cacheado dejaría el panel
  //     mostrando basura sin reintentar.
  //  3) SECUENCIAL (desempeño → ejecutivo), no paralelo: el servidor Flask usa async_mode="threading"
  //     con proxies `requests` bloqueantes, así que cada fetch en vuelo ocupa un hilo (el de ejecutivo
  //     hasta 200s). Encadenarlos mantiene 1 hilo a la vez por usuario.
  //  4) NO se precarga /analisis/desempeno_insight: window.__cnDesempInsight NO tiene call sites y su
  //     host #cn-ins no existe en el DOM actual (bloque oculto, __CN_DESEMP_VISIBLE=false) → sería una
  //     llamada LLM cara que nadie consume.
  var __cnPrewarmed = false;
  function __cnPrewarmGlobal() {
    if (__cnPrewarmed) return;
    __cnPrewarmed = true;
    // [2026-08-24] El prewarm queda inerte A PROPÓSITO. Antes precargaba
    // /analisis/desempeno y /analisis/ejecutivo con la clave global para que el panel
    // fuera cache-HIT y "dejar a Gemma caliente". Desde que el panorama GLOBAL muestra
    // solo el compromiso P50 (/president), esos dos endpoints ya NO se consumen en el
    // arranque: precargarlos sería pagar Gemma (~180s, hasta ~342s en frío) por un
    // payload que nadie pinta — justo el costo que este cambio elimina.
    //
    // NO se precarga /president en su lugar: __cnPaintP50Header() lo pide al montar el
    // panel y es SQL puro (rápido, timeout 30s), así que no hay nada que anticipar.
    //
    // Se conserva la función (y MultiTabShell.prewarm, :5374) porque templates/main.html
    // la invoca al cargar; convertirla en no-op es más seguro que quitar el call site.
  }

  // ---- Multi-tab de análisis (rail de previews). v1: 1 real + 3 placeholders. ----
  // Previews ESTÁTICAS (SVG inline): cero render, cero red, protege la RAM en dev.
  var __CN_ANALISIS = [
    { key: "desempeno", titulo: "Desempeño del mes", estado: "activo",
      svg: '<svg viewBox="0 0 80 46" preserveAspectRatio="none"><polyline points="4,34 16,22 28,28 40,14 52,24 64,10 76,18" fill="none" stroke="#1f6b4a" stroke-width="2.5"/></svg>' },
    { key: "filiales", titulo: "Desempeño Filiales", estado: "activo",
      svg: '<svg viewBox="0 0 80 46"><g fill="#1f6b4a"><rect x="6" y="20" width="7" height="20"/><rect x="15" y="12" width="7" height="28"/></g><g fill="#8fbf7f"><rect x="34" y="26" width="7" height="14"/><rect x="43" y="18" width="7" height="22"/></g><g fill="#1f6b4a"><rect x="62" y="16" width="7" height="24"/><rect x="71" y="24" width="6" height="16"/></g></svg>' },
  ];

  // [2026-08-25] CN-WAFFLE · Clave del análisis activo. Antes vivía SOLO en el DOM (la clase
  // .is-active de la tarjeta); al colapsar el riel en un popover que se monta y desmonta,
  // el DOM deja de ser un sitio fiable para guardarla.
  var __cnRailActiva = "desempeno";

  // [2026-08-30] Este shell lo montan DOS vistas con layouts distintos:
  //   - /mainchat  → tiene acordeón (.mc-shell): el waffle va en la cabecera del panel
  //                  Insights, que lo pinta acordeon.js. No hace falta barra propia.
  //   - /          → NO carga acordeon.js: no hay cabecera donde alojarlo, así que
  //                  conserva la barra .cn-railbar de siempre.
  // Sin esta distinción, la vista clásica se quedaría SIN waffle y sin acceso a los
  // análisis. La marca .mc-shell existe solo en la plantilla de MainChat.
  function __cnHayAcordeon() {
    return !!document.querySelector(".mc-shell");
  }

  // [2026-08-30] Es un <span role="button">, NO un <button>: en MainChat vive dentro de
  // .mc-cabecera, que a su vez ES un <button> (el que colapsa el panel), y un botón
  // anidado dentro de otro es HTML inválido — el parser lo expulsaría fuera de su padre
  // y rompería el layout de la cabecera.
  // Al no ser un <button> hay que reponer a mano lo que este daba gratis: tabindex para
  // el foco, y Enter/Espacio, que se manejan en el listener de document.
  // Sirve igual en la vista clásica, donde sigue dentro de .cn-railbar.
  function __cnAnMenuBtn() {
    var act = __cnRailActiva;
    var cfg = act ? __CN_ANALISIS.filter(function (a) { return a.key === act; })[0] : null;
    var etiq = cfg ? ("Análisis · " + cfg.titulo) : "Análisis";
    return '<span role="button" tabindex="0" class="cn-anbtn' + (act ? " is-active" : "") + '"' +
      ' id="cn-anbtn" aria-haspopup="true" aria-expanded="false"' +
      ' title="' + esc(etiq) + '" aria-label="' + esc(etiq) + '">' +
      '<i class="bi bi-grid-3x3-gap-fill"></i></span>';
  }

  // activeKey: clave a resaltar al construir (o null = ninguna, p.ej. cuando se muestra el Panorama). F1.
  function __cnRailCards(activeKey) {
    // Filiales NO aplica mientras el panel derecho analiza una entidad ECP específica (campo/activo/…);
    // en el panorama GLOBAL, en Filiales o en una filial (rama B), SÍ aplica. (2026-07-24)
    var filDisabled = !!__cnPanelEntidad;
    return __CN_ANALISIS.map(function (a) {
      var disabled = (a.key === "filiales" && filDisabled);
      var badge = disabled
        ? '<span class="cn-railcard__prox">No aplica</span>'
        : (a.estado === "activo"
          ? '<span class="cn-railcard__chk"><i class="bi bi-check-circle-fill"></i> Activo</span>'
          : (a.estado === "beta"
            ? '<span class="cn-railcard__beta">EN PRUEBAS</span>'
            : '<span class="cn-railcard__prox">Próximamente</span>'));
      var cls = 'cn-railcard' + (a.key === activeKey ? " is-active" : "") + (disabled ? " is-disabled" : "");
      // [2026-08-25] CN-WAFFLE · al elegir se cierra el popover. __cnAnalisisTab es el
      // MISMO handler de siempre (H6): la lógica de análisis no cambia.
      var handler = disabled ? ''
        : ' onclick="window.__cnAnalisisTab(\'' + a.key + '\', this); window.__cnAnMenuCerrar();"';
      return '<button type="button" class="' + cls + '" data-key="' + a.key + '"' +
        (disabled ? ' disabled aria-disabled="true"' : '') + handler + '>' +
        '<div class="cn-railcard__thumb">' + a.svg + '</div>' +
        '<div class="cn-railcard__meta"><span class="cn-railcard__title">' + esc(a.titulo) + '</span>' +
        badge + '</div></button>';
    }).join("");
  }

  // [2026-08-25] CN-WAFFLE · ÚNICO punto que refresca el estado del riel. Antes había 4
  // sitios haciendo `el("cn-rail").innerHTML = __cnRailCards(...)` y un 5º manipulando
  // .is-active a mano (H1): con el riel dentro de un popover que puede estar cerrado, cada
  // uno tendría que saber si el popover existe. Centralizado, los 5 llaman aquí.
  // Refresca DOS cosas: el botón (punto indicador + title) y, si el popover está abierto,
  // su rejilla.
  function __cnRailSync(activeKey) {
    __cnRailActiva = activeKey || null;
    // 1. El botón: se repinta entero (es un solo nodo, más simple que mutar clases).
    //    [2026-08-30] Se busca por id, no por su contenedor: puede estar en la barra
    //    (vista clásica) o en la cabecera del panel Insights (MainChat), que además
    //    acordeon.js reconstruye en cada colapsar/expandir. Se reemplaza el nodo en su
    //    sitio, sea cual sea, y así vale para los dos casos.
    var btnViejo = document.getElementById("cn-anbtn");
    if (btnViejo && btnViejo.parentNode) {
      var tmp = document.createElement("div");
      tmp.innerHTML = __cnAnMenuBtn();
      btnViejo.parentNode.replaceChild(tmp.firstChild, btnViejo);
    }
    // 2. La rejilla del popover, SOLO si está montado y visible (si está cerrado se
    //    repinta al abrirlo — __cnAnMenuAbrir siempre llama a __cnRailCards).
    var pop = document.getElementById("cn-anpop");
    if (pop && !pop.hidden) {
      var grid = pop.querySelector(".cn-anpop__grid");
      if (grid) grid.innerHTML = __cnRailCards(__cnRailActiva);
    }
  }

  // [2026-08-25] CN-WAFFLE · Popover de análisis. Clon adaptado del waffle de usuario
  // (MainChat/static/js/mainchat.js, WAFFLE-NAV 2026-08-25), que ya resolvió los tres
  // problemas difíciles: recorte por overflow de los ancestros, medir antes de situar, y
  // cierre por clic fuera / Escape / resize.
  //
  // 🔒 REGLAS (no relajar):
  //  1) Vive en document.body, NO en #cn-viewer-area: ese contenedor se regenera entero
  //     con innerHTML al volver a la pestaña (:422) y destruiría el nodo y sus listeners (H2).
  //  2) position:fixed, NO absolute: la cadena de ancestros acumula varios overflow:hidden
  //     (#cn-viewer-area inline, .cn-rail, y los del shell) que lo recortarían (H3).
  //  3) Se monta UNA sola vez (guarda __cnAnMenuMontado). El listener de document también.
  var __cnAnMenuMontado = false;
  var __CN_AN_MARGEN = 8;   // separación respecto al botón y a los bordes del viewport

  function __cnAnMenuMontar() {
    if (__cnAnMenuMontado) return;
    __cnAnMenuMontado = true;
    var pop = document.createElement("div");
    pop.id = "cn-anpop";
    pop.className = "cn-anpop";
    pop.hidden = true;
    pop.setAttribute("role", "menu");
    pop.innerHTML = '<div class="cn-anpop__hd">Análisis disponibles</div>' +
                    '<div class="cn-anpop__grid"></div>';
    document.body.appendChild(pop);

    // Delegación en document: el botón se repinta con la pestaña (H2), así que un
    // getElementById fijo apuntaría a un nodo muerto. Mismo criterio que mainchat.js:64-72.
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || typeof t.closest !== "function") return;
      if (t.closest("#cn-anbtn")) { e.stopPropagation(); __cnAnMenuAbrir(pop.hidden); return; }
      if (!pop.hidden && !pop.contains(t)) __cnAnMenuAbrir(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !pop.hidden) { __cnAnMenuAbrir(false); return; }
      // [2026-08-30] Enter y Espacio sobre el waffle. Un <button> los traía de serie,
      // pero ahora es un <span role="button"> (ver __cnAnMenuBtn), así que hay que
      // manejarlos. Va aquí, en la delegación de document, y no en el nodo: la cabecera
      // que lo contiene se reconstruye entera en cada colapsar/expandir.
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      var t = e.target;
      if (!t || typeof t.closest !== "function" || !t.closest("#cn-anbtn")) return;
      e.preventDefault();   // Espacio, si no, hace scroll de la página
      __cnAnMenuAbrir(pop.hidden);
    });
    window.addEventListener("resize", function () {
      if (!pop.hidden) __cnAnMenuSituar();
    });
  }

  // Coloca el popover bajo el botón. Requiere que YA esté visible: con hidden, offsetWidth
  // devuelve 0 y quedaría mal situado. __cnAnMenuAbrir garantiza ese orden.
  function __cnAnMenuSituar() {
    var btn = document.getElementById("cn-anbtn");
    var pop = document.getElementById("cn-anpop");
    if (!btn || !pop) return;
    var r = btn.getBoundingClientRect();
    var alto = pop.offsetHeight, ancho = pop.offsetWidth;
    // Hacia ABAJO desde el botón (está arriba-izquierda del panel); si no cabe, hacia arriba.
    var top = r.bottom + __CN_AN_MARGEN;
    if (top + alto > window.innerHeight - __CN_AN_MARGEN) {
      top = r.top - alto - __CN_AN_MARGEN;
      if (top < __CN_AN_MARGEN) top = __CN_AN_MARGEN;
    }
    // Alineado al borde izquierdo del botón, sin salirse del viewport.
    var left = r.left;
    if (left + ancho > window.innerWidth - __CN_AN_MARGEN) {
      left = window.innerWidth - ancho - __CN_AN_MARGEN;
    }
    if (left < __CN_AN_MARGEN) left = __CN_AN_MARGEN;
    pop.style.top = top + "px";
    pop.style.left = left + "px";
  }

  function __cnAnMenuAbrir(mostrar) {
    __cnAnMenuMontar();
    var pop = document.getElementById("cn-anpop");
    if (!pop) return;
    if (mostrar) {
      // Se repinta SIEMPRE al abrir: __cnPanelEntidad pudo cambiar mientras estaba cerrado
      // (p.ej. se analizó un campo → "Filiales" deja de aplicar).
      var grid = pop.querySelector(".cn-anpop__grid");
      if (grid) grid.innerHTML = __cnRailCards(__cnRailActiva);
    }
    pop.hidden = !mostrar;
    var btn = document.getElementById("cn-anbtn");
    if (btn) btn.setAttribute("aria-expanded", mostrar ? "true" : "false");
    if (mostrar) __cnAnMenuSituar();   // medir DESPUÉS de quitar hidden
  }

  // Expuesto porque lo invoca el onclick inline de las tarjetas (__cnRailCards).
  window.__cnAnMenuCerrar = function () { __cnAnMenuAbrir(false); };

  // Cambia el análisis activo del rail. 'desempeno' = real; el resto = "Próximamente".
  window.__cnAnalisisTab = function (key, cardEl) {
    if (key === "filiales" && __cnPanelEntidad) return;   // Filiales no aplica mientras se analiza una entidad ECP
    __cnStackHide();   // clic en el riel = render v1 en el lienzo → si la pila estaba activa, descúbrela (D6)
    // [2026-08-25] CN-WAFFLE · el activo ya no se marca mutando el DOM del riel (que puede
    // no existir si el popover está cerrado): se guarda en __cnRailActiva y __cnRailSync
    // repinta botón y rejilla. `cardEl` queda sin uso — se conserva en la firma porque el
    // onclick inline de las tarjetas lo sigue pasando (`this`).
    __cnRailSync(key);
    var canvas = el("cn-canvas"); if (!canvas) return;
    if (key === "desempeno") {
      // "Desempeño del mes" = ECP. Si la entidad activa es una filial (rama B), NO se analiza como
      // entidad ECP (sería "Hocol operador", confuso) → global. Su panel propio es "Analizar {filial}".
      var esFilB = !!(__cnLastIntent && __cnLastIntent.rama === "B");
      var ent = (__cnLastIntent && !esFilB) ? (__cnLastIntent.valor || __cnLastIntent.entidad || null) : null;
      window.__cnAnalizar(ent, "ecp", esFilB ? null : (__cnLastIntent && __cnLastIntent.nivel),
                          esFilB ? null : (__cnLastIntent && __cnLastIntent.periodo));
    } else if (key === "filiales") {
      window.__cnAnalizar(null, "filiales");   // v1: vista fija de las 3 filiales (global)
    } else {
      var cfg = __CN_ANALISIS.filter(function (a) { return a.key === key; })[0] || {};
      canvas.innerHTML =
        '<div class="cn-prox"><div class="cn-prox__ic"><i class="bi bi-cone-striped"></i></div>' +
        '<div class="cn-prox__tt">' + esc(cfg.titulo || "Análisis") + '</div>' +
        '<div class="cn-prox__sub">Este análisis está en diseño. Pronto podrás explorarlo aquí.</div></div>';
    }
  };

  window.__cnAnalizar = function (entidad, segmento, nivel, periodo) {
    __cnSeg = (segmento === "filiales") ? "filiales" : "ecp";   // fija el segmento del panel
    __cnNivel = __cnEsFil() ? null : (nivel || null);
    __cnPeriodo = __cnEsFil() ? null : (periodo || null);
    var a = __cnViewerArea(); if (!a) return;
    __cnStackHide();   // render v1 en el lienzo → si la pila estaba activa, descúbrela (D6)
    var esGlobal = !entidad;   // sin entidad → desempeño GLOBAL, p. ej. al cargar
    // Entidad ÚNICA (campo/activo/pozo/…, no global ni filiales): se muestra SOLO el "Comportamiento
    // diario" (curva diaria + valle + eventos) del bloque que escondimos — llena el hueco "Sin
    // desglose por campo". Global/filiales siguen escondidos (allí "Series completas" ya desglosa).
    var soloComp = !esGlobal && !__cnEsFil();
    __cnComportEnt = esGlobal ? null : entidad;   // el gráfico izquierdo de comportamiento seguirá al foco #1
    // Ámbito del panel → gobierna si "Desempeño Filiales" aplica, y repinta el riel al cambiar de vista
    // (p. ej. "Volver al panorama" reactiva Filiales; analizar un campo lo desactiva).
    __cnPanelEntidad = (!__cnEsFil() && entidad) ? entidad : null;
    __cnRailSync(__cnEsFil() ? "filiales" : "desempeno");
    var titulo = __cnEsFil()
      ? '<i class="bi bi-bar-chart-line-fill"></i> Desempeño Filiales · Hocol · America · Permian'
      : (esGlobal
        ? '<i class="bi bi-bar-chart-line-fill"></i> Desempeño del mes · Global (toda la producción ECP)'
        : __cnTituloEnt(entidad, __cnNivel));
    // "Volver al panorama" (= Desempeño global) solo si NO estás ya en el global (sería un bucle a sí
    // mismo) y no es filiales (F5: allí no aplica). Antes la condición era __cnLastIntent, que sigue
    // vivo en el global → el botón se pintaba apuntando a la pantalla que ya estabas viendo.
    var backBtn = (!__cnEsFil() && !esGlobal)
      ? '<button type="button" class="cn-rep__back" onclick="window.__cnVolverPanorama()">' +
        '<i class="bi bi-arrow-left"></i> Volver al panorama</button>'
      : '';
    a.innerHTML =
      '<div class="cn-desemp">' +
      '  <div class="cn-rep__bar">' + backBtn +
      '    <span class="cn-rep__date">' + titulo + '</span>' +
      '  </div>' +
      '  <div class="cn-desemp__scroll">' +
      '    <div id="cn-ejec-top" class="cn-ejec-top">' +
      '      <div class="d-flex align-items-center gap-2 p-3 text-muted small">' +
      '        <div class="spinner-border spinner-border-sm"></div> Calculando análisis ejecutivo…</div></div>' +
      '    <div id="cn-desemp-body" class="cn-desemp__body"' + ((__CN_DESEMP_VISIBLE || soloComp) ? '' : ' style="display:none"') + '>' +
      '      <div class="d-flex align-items-center gap-2 p-3 text-muted small">' +
      '        <div class="spinner-border spinner-border-sm"></div> Calculando desempeño del mes…</div></div>' +
      '  </div>' +
      '</div>';
    // [2026-08-24] Panorama GLOBAL ECP: SOLO el compromiso P50 (determinista, /president).
    // Los focos y gráficos por producto (/ejecutivo, potencialmente Gemma) se omiten aquí
    // para que el panorama cargue instantáneo. Se excluye a Filiales (__cnEsFil): también
    // llega con entidad=null, pero su render vive en __cnRenderEjecutivo y lo perdería.
    // En drill-down a una ENTIDAD (Insight de una pregunta de Análisis) NO cambia nada.
    if (esGlobal && !__cnEsFil()) {
      var topG = el("cn-ejec-top");
      if (topG) {
        // .cn-ejec-body: el CSS lo espera como hijo (colapsable.css:1328, width:100%).
        // --solo: anula el border-bottom de .cn-ejec-top, que sin los focos debajo
        // quedaría como una línea colgando (colapsable.css:1327).
        topG.classList.add("cn-ejec-top--solo");
        topG.innerHTML =
          '<div class="cn-ejec-body">' +
          '  <div class="cn-p50hd__lbl"><i class="bi bi-flag-fill"></i> ECP · Cumplimiento del compromiso corporativo ' +
          '  <b>(P50)</b> <span class="cn-p50hd__u">· promedio del mes en kbpe</span></div>' +
          '  <div class="cn-kpi__row" id="cn-p50-row"><div class="cn-p50hd__load">Cargando compromiso P50…</div></div>' +
          '</div>';
      }
      __cnPaintP50Header();
      return;   // corta ANTES del fetch de /desempeno (:1600): el global termina aquí
    }

    // ARRIBA: brief ejecutivo (focos). Las gráficas de comportamiento viven DENTRO de cada foco
    // (acordeón por foco), así que el desempeño se pide para la ENTIDAD (y para Filiales) para
    // poder pintarlas.
    window.__cnAnalisisEjecutivo(entidad);
    if (__cnEsFil()) return;
    var cacheKey = __cnCacheKey(entidad);
    if (__cnDesempCache[cacheKey]) { __cnPaintDesemp(__cnDesempCache[cacheKey], entidad, esGlobal, soloComp); return; }   // caché → sin refetch ni LLM
    fetch("/api/analisis/desempeno" + __cnSegQS(entidad))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var body = el("cn-desemp-body"); if (!body) return;
        if (!d || d.encontrada === false) { body.innerHTML = '<div class="p-3 text-muted small">No reconocí «' + esc(entidad || "") + '» como entidad con producción ECP.</div>'; return; }
        if (d.sin_datos) { body.innerHTML = '<div class="p-3 text-muted small">Sin datos de producción.</div>'; return; }
        if (d.sin_cierre) { body.innerHTML = '<div class="p-3 text-muted small">' + esc((d.mes||{}).nombre||"") + ' ' + ((d.mes||{}).anio||"") + ' aún no tiene cierre mensual (REAL/PPTO).</div>'; return; }   // H5
        __cnDesempCache[cacheKey] = d;   // solo cacheamos payloads válidos (tras pasar los checks de error)
        __cnPaintDesemp(d, entidad, esGlobal, soloComp);
      })
      .catch(function () {
        var body = el("cn-desemp-body");
        if (body) body.innerHTML = '<div class="alert alert-danger m-3">Error calculando el desempeño.</div>';
      });
  };

  // Pinta el desempeño desde el payload (fetch o caché). Idéntico resultado en ambos caminos.
  function __cnPaintDesemp(d, entidad, esGlobal, soloComp) {
    __cnDesempData = d;
    if (esGlobal) __cnSaludoDesdeDesemp(d);   // E1: el saludo se ancla a las cifras del mes
    // 2026-07-24: el "Comportamiento diario" ya no es un bloque aparte; sus gráficas viven DENTRO de
    // cada foco (acordeón por foco). Este contenedor queda vacío; las gráficas se pintan por foco
    // cuando ejecutivo (focos) y desempeño (curva/ritmo) están ambos listos.
    var body = el("cn-desemp-body"); if (body) body.innerHTML = "";
    __cnPaintFocoCharts();
  }

  // Panel IZQUIERDO del "Comportamiento diario": sigue al producto del FOCO #1 (coherente con los focos).
  // Se llama desde el fetch de ejecutivo Y el de desempeño; pinta solo cuando AMBOS están listos (sin race).
  // Crudo (o sin focos) -> valle anotado de crudo (fetch /desempeno_insight, como antes). GAS/BLANCOS ->
  // curva diaria del producto + línea de promedio 2026 + diagnóstico tomado del foco. Sin duplicar backend.
  // Pinta las gráficas de CADA foco (uno por foco, decisión del usuario 2026-07-24): la sección 1 del
  // acordeón de cada foco lleva su par de gráficas (diaria + mensual) DE SU PRODUCTO. Espera a que
  // ejecutivo (focos) Y desempeño (curva/ritmo) estén listos. No aplica a filiales (sin grano diario).
  function __cnPaintFocoCharts() {
    if (__cnEsFil()) return;
    var ed = __cnEjecD, dd = __cnDesempData;
    if (!ed || !ed.focos || !dd || !dd.curva) return;
    ed.focos.forEach(function (f) {
      var day = el("cn-foco-day-" + f.rank), mon = el("cn-foco-mon-" + f.rank);
      if (day) __cnDailyInto(f.producto, day, dd, ed.tarjetas);   // ed.tarjetas → línea de PPTO diario
      if (mon) __cnGapCampoInto(f.producto, mon, ed, dd, f);   // panel derecho = producido vs producción esperada por campo
    });
  }
  // Compat: los callers antiguos siguen llamando __cnPaintComportIzq → ahora reparte por foco.
  function __cnPaintComportIzq() { __cnPaintFocoCharts(); }

  // [2026-08-13] Versión SCOPED de __cnPaintFocoCharts para el bloque "analiza_foco" apilado en
  // Consulta: NO lee __cnEjecD/__cnDesempData (globales del TABLERO — pertenecen a la vista que el
  // tablero tiene abierta AHORA MISMO, que puede ser una entidad distinta a la de este bloque, A7),
  // y busca los IDs DENTRO de `blk` (querySelector, no getElementById) para no pisar al tablero ni a
  // otro bloque apilado si ambos tuvieran, por error, el mismo rank+sufijo. `ed`/`dd` = payloads
  // propios de ESTE bloque; `ed.focos` YA viene filtrado por producto (D1) antes de llamar aquí.
  function __cnPaintFocoStk(blk, ed, dd, sufijo) {
    if (!blk || !ed || !ed.focos || !dd || !dd.curva) return;
    ed.focos.forEach(function (f) {
      var day = blk.querySelector("#cn-foco-day-" + f.rank + sufijo);
      var mon = blk.querySelector("#cn-foco-mon-" + f.rank + sufijo);
      if (day) __cnDailyInto(f.producto, day, dd, ed.tarjetas);   // ed.tarjetas → línea de PPTO diario
      if (mon) __cnGapCampoInto(f.producto, mon, ed, dd, f);
    });
  }

  // Gráfica DIARIA (curva del producto) + línea de referencia = PROMEDIO DIARIO 2026 (del REAL mensual)
  // dibujada POR ENCIMA, con texto explicativo al pie. La referencia sale de d.ritmo_mensual.promedio_dia.
  // [2026-08-31] +tarjetas: se añade una 2ª línea de referencia con el PPTO DIARIO del producto.
  // Viene de `ed.tarjetas` (payload de /ejecutivo), NO de `d` (payload de /desempeno) — son dos
  // endpoints distintos; por eso entra como parámetro opcional y los dos call sites lo pasan.
  // Se usa k.bopd.requerido, que es el MISMO dato y la MISMA unidad que la curva (bbl/día, MSCF/día),
  // el que ya muestra la tarjeta "Ejecución diaria vs PPTO" de al lado. Sin conversiones inventadas.
  // ⚠️ BLANCOS queda fuera a propósito: el backend manda bopd:null porque su fact diario y su mensual
  // modelan cosas distintas (corrientes físicas vs "GAS CONVERTIDO MME") y NO reconcilian —
  // 2,10× ó 3,06× según el criterio, ver HALLAZGO_concepto_multiplicidad.md §4bis. Ponerle una línea
  // exigiría inventar un factor de corrección. Queda pendiente de la decisión de negocio (§5 Paso 3).
  // [2026-09-03 · CURVA-VENTANA] "2026-07-25" -> "25/07". Sin Date: `new Date("2026-07-25")`
  // parsea como UTC y en un navegador al oeste de Greenwich devuelve el día ANTERIOR — el
  // clásico off-by-one de zona horaria, que aquí correría la etiqueta del rango un día.
  function __cnFechaCorta(iso) {
    var s = String(iso || "");
    return (s.length >= 10) ? (s.slice(8, 10) + "/" + s.slice(5, 7)) : s;
  }

  function __cnDailyInto(prod, hostEl, d, tarjetas) {
    var serie = (d.curva && d.curva.series && d.curva.series[prod]) || [];
    var fechas = (d.curva && d.curva.fechas) || [];
    var nombre = prod.charAt(0).toUpperCase() + prod.slice(1).toLowerCase();
    var rm = d.ritmo_mensual || {};
    // PPTO diario del producto. null si no aplica (BLANCOS, o entidad sin PPTO/PROGRAMA formal).
    var tj = (tarjetas || []).filter(function (k) { return k.producto === prod; })[0];
    var pptoDia = (tj && tj.bopd && tj.bopd.requerido != null) ? tj.bopd.requerido : null;
    var mesNom = (d.mes && d.mes.nombre) || "";   // mes dinámico = último mes de datos cargados
    // [2026-09-03 · CURVA-VENTANA] `curva_ventana` lo emite /desempeno cuando la curva NO es la
    // del mes. Rotular "del mes de agosto" sobre 30 días a caballo entre julio y agosto sería
    // afirmar algo falso sobre lo que el usuario está viendo.
    var cvVen = d.curva_ventana || null;
    // Referencia = PROMEDIO DIARIO 2026, SOLO si el producto reconcilia día↔mes (GAS/CRUDO → promedio_dia).
    // BLANCOS NO reconcilia: su curva diaria suma 4 conceptos-copia → ×4 vs el mensual (ver
    // INGESTA/Rep_Prod/HALLAZGO_concepto_multiplicidad.md). Sin referencia 2026 → se compara contra el
    // promedio de su propio mes y el título NO dice "vs promedio diario 2026" (no contradice la tarjeta KPI).
    var prom2026 = (rm.promedio_dia && rm.promedio_dia[prod] != null) ? rm.promedio_dia[prod] : null;
    // [2026-08-31] Fallback del PPTO para el panel de CAMPO (cuant_dia_panel), que se pinta SIN
    // tarjetas (se les pasa [] a propósito: hablaban del mes y la pregunta era de un día, ver :3813).
    // `d.por_producto[].ppto` es el PPTO MENSUAL ya filtrado por la entidad consultada —el mismo
    // `where()` que escala la curva y el promedio 2026—, así que en una pregunta por CHICHIMENE es
    // el PPTO de CHICHIMENE, no el de CRUDO entero. Se divide por los DÍAS DEL MES (no por los días
    // con reporte): es la meta diaria de plan, no cambia al avanzar el mes, y es el mismo criterio
    // que usa `requerido_dia` en la tarjeta de producto.
    // ppto = 0 → sin línea: hay campos que producen sin meta asignada (15 de 128 en crudo) y no se
    // les inventa una (misma regla que `campos_sin_meta` en el backend).
    // ⚠️ El guard `prom2026 != null` NO es decorativo: BLANCOS sí tiene PPTO en `por_producto`, así
    // que sin él el fallback le dibujaría una línea que su curva diaria no puede comparar (mide
    // corrientes físicas; el mensual mide "GAS CONVERTIDO MME" — no reconcilian, 2,10-3,06×).
    // `promedio_dia` es null exactamente cuando el backend detecta esa no-reconciliación, así que
    // sirve de semáforo: si él no se fía del mensual para este producto, el PPTO tampoco vale.
    // 🔑 Va DESPUÉS de declarar prom2026: con `var` el hoisting lo dejaría en undefined y la guarda
    // sería siempre falsa — el fallback no se ejecutaría nunca y el fallo sería silencioso.
    if (pptoDia == null && prom2026 != null) {
      var dimMes = (d.mes && d.mes.dias_del_mes) || 0;
      var pp = (d.por_producto || []).filter(function (x) { return x.producto === prod; })[0];
      if (dimMes && pp && pp.ppto) pptoDia = pp.ppto / dimMes;
    }
    var delMes = cvVen
      ? (' · ' + __cnFechaCorta(cvVen.ini) + ' a ' + __cnFechaCorta(cvVen.fin))
      : (mesNom ? (' del mes de ' + esc(mesNom)) : ' del mes');
    var hd = esc(nombre) + ' · producción diaria' + delMes + (prom2026 != null ? ' vs promedio diario 2026' : '');
    hostEl.innerHTML =
      '<div class="cn-ins__card"><div class="cn-ins__card-hd"><i class="bi bi-graph-up"></i> ' + hd + '</div>' +
      '<div class="cn-ins__plot" data-p></div>' +
      '<div class="cn-ins__cap" data-cap></div></div>';
    var elp = hostEl.querySelector("[data-p]");
    if (!fechas.length) { elp.innerHTML = '<div class="p-2 text-muted small">Sin curva diaria para este producto.</div>'; return; }
    // [2026-09-03 · CURVA-VENTANA] Con ventana el eje X pasa a DD/MM. `__cnDailyPlot` mapea la
    // fecha al día del mes como categoría (:3867), así que en una ventana jul→ago saldría
    // "25,26,...,31,1,2,...,23" sin decir de qué mes es cada tramo. Se reescriben las etiquetas
    // ANTES de pintar; la serie de valores no se toca.
    if (cvVen && fechas.length) {
      fechas = fechas.map(function (f) { return __cnFechaCorta(f); });
    }
    var vd = serie.filter(function (v) { return v != null && v > 0; });
    var promMes = vd.length ? vd.reduce(function (a, b) { return a + b; }, 0) / vd.length : 0;   // media del mes (fallback)
    var ref = prom2026 != null ? prom2026 : promMes;    // referencia: promedio 2026 (REAL mensual) o media del mes
    var U = { CRUDO: "bbl", GAS: "MSCF", BLANCOS: "bbl" }[prod] || "";
    // [2026-08-25] El panel «Comportamiento {Producto}» (.cn-compprod__grid) pide más aire sobre
    // la curva y NO lleva pie de texto. Se detecta por el DOM y no por parámetro porque el pintor
    // (__cnPaintFocoStk) es COMPARTIDO con el panel de Focos: así sus dos call sites (:1670, :1688)
    // quedan intactos y el panel de Focos conserva su holgura de 1.12 y su caption.
    var esCompProd = !!hostEl.closest(".cn-compprod__grid");
    __cnDailyPlot(elp, fechas, serie, ref, U, prod === "GAS", prom2026 != null, __cnProdCol(prod),
                  esCompProd ? 1.30 : undefined,
                  esCompProd ? { x: "Día" + (mesNom ? " de " + mesNom : " del mes"),
                                 y: "Producción (" + (U || "unidades") + "/día)" } : undefined,
                  pptoDia,
                  // [2026-08-31] 4ª referencia: la media real de ESTE mes, que ya se calculaba para
                  // el pie. Solo se dibuja si hay una referencia anual con la que contrastarla; si
                  // `ref` YA es promMes (fallback sin prom2026) serían la misma línea dos veces.
                  prom2026 != null ? promMes : null,
                  // [2026-08-31] Leyenda en vez de etiquetas sobre las líneas — SOLO en el panel de
                  // Focos (vista por producto), decisión del usuario. Con 4 referencias en un panel
                  // estrecho las etiquetas se montaban: el promedio 2026 (2.852.019) y la media del
                  // mes (2.829.436) distan 0,8% y sus textos se solapaban por completo.
                  !esCompProd);
    var cap = hostEl.querySelector("[data-cap]");
    if (cap && !esCompProd) {
      cap.innerHTML = __cnDailyCap(promMes, ref, prom2026 != null, U, prod === "GAS", (d.mes && d.mes.nombre) || "El mes", pptoDia);
    }
  }

  // Texto explicativo bajo la curva diaria: media real del mes vs promedio 2026, con la brecha.
  function __cnDailyCap(promMes, ref, esAnio, unidad, esGas, mesNom, pptoDia) {
    var fmtD = esGas ? __cnGasM : function (v) { return __cnMilesEC(Math.round(v)); };
    var u = unidad ? (" " + unidad) : "";
    var media = '<b>' + fmtD(promMes) + u + '/día</b>';
    // [2026-08-31] Frase del PPTO: se añade solo si hay dato, y dice si la media va por debajo o por
    // encima de la meta diaria. Se construye aparte para no duplicar las dos ramas de abajo.
    var ppto = "";
    if (pptoDia) {
      var gp = (promMes / pptoDia - 1) * 100;
      ppto = ' Frente al <b>PPTO diario</b>, va <b>~' + Math.abs(Math.round(gp)) + '% ' +
        (gp < 0 ? "por debajo" : "por encima") + '</b>.';
    }
    if (!esAnio || !ref) return 'La curva verde es la producción real día a día (media ' + media + ').' + ppto;
    var gap = ref ? (promMes / ref - 1) * 100 : 0;
    var dir = gap < 0 ? "por debajo" : "por encima";
    // [2026-08-31] "punteada ámbar": desde que el PPTO también es punteado, decir solo "la línea
    // punteada" ya no identifica a ninguna de las dos. El color es lo que las separa en el texto.
    // [2026-08-31] El pie ya no describe qué es cada línea ni repite sus valores: eso lo dice la
    // leyenda del gráfico. Se queda con lo que la leyenda NO puede dar — la lectura: cuánto se
    // separa el mes del ritmo del año y del presupuesto.
    return esc(mesNom) + ' corre <b>~' + Math.abs(Math.round(gap)) + '% ' + dir +
      '</b> del ritmo del año (media del mes ' + media + ').' + ppto;
  }

  // Curva diaria (línea + markers + área) + LÍNEA punteada de referencia (promedio 2026 o, en fallback,
  // media del mes). El eje Y se estira para dejar la referencia POR ENCIMA de la curva.
  // esGas: el gas se grafica en MSCF (÷1e6).
  // [2026-08-11] +col: color YA RESUELTO por el caller (vía __cnProdCol) para la identidad de
  // producto. esGas NO cambia de rol — sigue gobernando solo la conversión de unidades a MSCF.
  // [2026-08-31] +pptoDia: 2ª línea de referencia (PPTO diario). Mismo tratamiento de unidades que
  // `ref` — el gas se divide por 1e6 igual. null → no se dibuja (BLANCOS y entidades sin PPTO).
  function __cnDailyPlot(elp, fechas, valores, ref, unidad, esGas, refEsAnio, col, holgura, ejes, pptoDia, promMesRef, conLeyenda) {
    if (!elp) return;
    if (!window.Plotly) { elp.innerHTML = '<div class="text-muted small p-2">(Plotly no disponible)</div>'; return; }
    var uni = unidad ? (" " + unidad) : "";
    var fmtD = esGas ? __cnGasM : function (v) { return __cnMilesEC(Math.round(v)); };
    var yPlot = esGas ? valores.map(function (v) { return v == null ? null : v / 1e6; }) : valores;
    var refPlot = esGas ? ref / 1e6 : ref;
    var pptoPlot = (pptoDia != null) ? (esGas ? pptoDia / 1e6 : pptoDia) : null;
    var promMesPlot = (promMesRef != null && promMesRef > 0) ? (esGas ? promMesRef / 1e6 : promMesRef) : null;
    // Eje X categórico = número de día del mes ("2026-05-01" → "1"). El hover conserva la fecha completa.
    var xcat = fechas.map(function (f) {
      var s = String(f).slice(0, 10).split("-");   // ["2026","05","01"]
      var dd = s.length === 3 ? parseInt(s[2], 10) : NaN;
      return isNaN(dd) ? String(f) : String(dd);
    });
    var cd = valores.map(function (v, i) { return [fechas[i], fmtD(v)]; });   // [fecha ISO, valor fmt]
    var shapes = [], anns = [];
    // [2026-08-31] `conLeyenda` (panel de Focos): las referencias se identifican en una leyenda al
    // pie en vez de con etiquetas sobre las líneas. Con 4 referencias en un panel estrecho las
    // etiquetas se montaban —el promedio 2026 y la media del mes distan 0,8% en CRUDO— y ni
    // reposicionarlas alcanzaba. `refLeyenda` acumula una traza fantasma (sin puntos: x/y vacíos)
    // por referencia: Plotly las lista en la leyenda con su color y su patrón reales, sin dibujar
    // nada en el área del gráfico. Cuando no hay leyenda, se emiten las anotaciones de siempre.
    var trazasLey = [];
    function refLeyenda(nombre, valor, color, patron) {
      trazasLey.push({ x: [null], y: [null], type: "scatter", mode: "lines", name: nombre + " · " + fmtD(valor) + uni + "/día",
                       line: { color: color, width: 1.5, dash: patron }, hoverinfo: "skip", showlegend: true });
    }
    if (refPlot) {
      shapes.push({ type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: refPlot, y1: refPlot,
        line: { color: "#BA7517", width: 1.5, dash: "dash" } });
      var refNom = refEsAnio ? "promedio diario 2026" : "promedio del mes";
      if (conLeyenda) refLeyenda(refNom, ref, "#BA7517", "dash");
      else anns.push({ x: 0, y: refPlot, xref: "paper", yref: "y", xanchor: "left", yanchor: "bottom",
        text: refNom + " · " + fmtD(ref) + uni + "/día",
        showarrow: false, font: { size: 10, color: "#BA7517" } });
    }
    // [2026-08-31] PPTO diario: línea sólida azul, para no confundirse con la punteada ámbar del
    // promedio. Su etiqueta ancla a la DERECHA (xanchor:right) porque la del promedio ya ocupa la
    // izquierda: si ambas nacieran en x=0 se solaparían cuando los dos valores quedan cerca.
    // [2026-08-31] Verde corporativo (--primary-forest, el de las tarjetas del chat) y punteado
    // fino, en vez del azul sólido inicial — decisión del usuario. El punteado hace el trabajo que
    // antes hacía el contraste de color: la curva es #1f6b4a, así que dos verdes sólidos se
    // confundirían. `dot` (puntos) se distingue además del `dash` (rayas) del promedio 2026.
    if (pptoPlot) {
      shapes.push({ type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: pptoPlot, y1: pptoPlot,
        line: { color: "#004236", width: 1.5, dash: "dot" } });
      if (conLeyenda) refLeyenda("PPTO diario", pptoDia, "#004236", "dot");
      else anns.push({ x: 1, y: pptoPlot, xref: "paper", yref: "y", xanchor: "right", yanchor: "bottom",
        text: "PPTO · " + fmtD(pptoDia) + uni + "/día",
        showarrow: false, font: { size: 10, color: "#004236" } });
    }
    // [2026-08-31] Media real de ESTE mes. Gris azulado: verde y ámbar ya están tomados por las
    // otras tres líneas, y los cálidos (#B04A38, ámbar) significan alerta en este tablero — el
    // promedio es un dato neutro, no un estado. El azul se descartó por la misma razón por la que
    // se le quitó al PPTO. `dashdot` se distingue del `dash` del promedio anual y del `dot` del PPTO.
    // Etiqueta CENTRADA (x:0.5): izquierda y derecha ya las ocupan las otras dos.
    if (promMesPlot) {
      shapes.push({ type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: promMesPlot, y1: promMesPlot,
        line: { color: "#5A6B7A", width: 1.5, dash: "dashdot" } });
      if (conLeyenda) refLeyenda("media del mes", promMesRef, "#5A6B7A", "dashdot");
      else anns.push({ x: 0.5, y: promMesPlot, xref: "paper", yref: "y", xanchor: "center", yanchor: "bottom",
        text: "media del mes · " + fmtD(promMesRef) + uni + "/día",
        showarrow: false, font: { size: 10, color: "#5A6B7A" } });
    }
    // Eje Y desde 0, con techo = max(curva, referencia) + holgura → la referencia queda con aire.
    // [2026-08-25] `holgura` es ADITIVO y por defecto 1.12: el panel de Focos no cambia. El panel
    // «Comportamiento {Producto}» pasa 1.30 — su curva es casi plana (la producción diaria varía
    // poco) y con el 12% quedaba pegada al borde superior.
    // [2026-08-31] El PPTO entra en el max: suele estar POR ENCIMA de la curva (es la meta), así que
    // sin esto su línea quedaba fuera del área visible — justo el caso de CRUDO (PPTO 3,49M vs curva
    // 2,83M) y de GAS (3,1 vs 2,3).
    // [2026-08-31] El eje ya NO arranca en 0: se ajusta a la banda donde viven de verdad los datos.
    // Motivo medido (CASTILLA·mayo): curva ~210-225k, promedio 220.918, PPTO 215.460 → las tres
    // series se diferencian en ~2% pero el eje llegaba a 250k, así que ocupaban el 12% superior y
    // se pisaban entre sí. Con la banda ajustada pasan a usar todo el alto y se separan.
    // El mínimo y el máximo salen de LAS TRES series, no solo de las referencias: si se tomaran
    // solo promedio y PPTO, los días que caen por debajo (210k) quedarían cortados fuera del área.
    // Se descartó la escala logarítmica: comprime diferencias GRANDES, y aquí son del 2% — en
    // espacio log promedio y PPTO distan 0,011 sobre un eje de ~5,4, o sea aún más juntas. Además
    // log(0) es -infinito, así que tampoco podría arrancar en 0.
    var vals = yPlot.filter(function (v) { return v != null; });
    var refs = [refPlot, pptoPlot, promMesPlot].filter(function (v) { return v != null && v > 0; });
    var todos = vals.concat(refs);
    var dataMax = todos.length ? Math.max.apply(null, todos) : 0;
    var dataMin = todos.length ? Math.min.apply(null, todos) : 0;
    // Margen = 12% del RANGO (no del valor), con un piso del 2% del máximo para cuando la banda es
    // casi plana: sin ese piso, una serie constante daría rango 0 y el eje colapsaría a una línea.
    var span = dataMax - dataMin;
    var margen = Math.max(span * 0.12, dataMax * 0.02) || 1;
    var top = dataMax + margen;
    // El suelo nunca baja de 0 (no hay producción negativa) — con eso, una serie que sí arranque
    // cerca de cero conserva el comportamiento de antes.
    var bottom = Math.max(0, dataMin - margen);
    // `holgura` (1.30 en «Comportamiento {Producto}») ya no hace falta para dar aire arriba: el
    // margen es proporcional al rango real. Se sigue aceptando por firma para no tocar su call site.
    var lineCol = col || "#1f6b4a";
    var ejX = (ejes || {}).x || "", ejY = (ejes || {}).y || "";
    // Con título de eje hacen falta ~16px más abajo y ~10px a la izquierda; sin él, márgenes de siempre.
    // [2026-08-31] +34px abajo con leyenda: va bajo el eje X (y:-0.30) y sin ese margen Plotly la
    // recorta contra el borde del contenedor.
    var mrg = { l: ejY ? 62 : 52, r: 10, t: 14, b: (ejX ? 46 : 30) + (conLeyenda ? 34 : 0) };
    // [2026-08-31] Sin `fill: tozeroy`: con el eje ya no anclado en 0, el área rellenaba hasta el
    // borde inferior del recorte, que no es un cero ni ninguna otra referencia — pintaba una masa
    // de color que no significaba nada y tapaba las líneas de PPTO y promedio.
    // [2026-08-31] `spline`: une los puntos con curvas suaves en vez de rectas quebradas —
    // decisión del usuario. smoothing 0.8 (el máximo de Plotly es 1.3) da la curva sin que se
    // desvíe de más: el spline INTERPOLA, así que entre dos días puede dibujar valores que ningún
    // día tuvo y rebasar un poco los extremos. Los marcadores siguen en el dato exacto, y el hover
    // lee de `customdata`, no del trazo, así que las cifras que se leen no cambian.
    Plotly.newPlot(elp, [{ x: xcat, y: yPlot, type: "scatter", mode: "lines+markers",
      line: { color: lineCol, width: 2, shape: "spline", smoothing: 0.8 },
      marker: { color: lineCol, size: 4 },
      name: "producción real", showlegend: !!conLeyenda,
      customdata: cd,
      hovertemplate: "%{customdata[0]}<br>%{customdata[1]}" + uni + "/día<extra></extra>" }].concat(trazasLey), {
      autosize: true, margin: mrg, shapes: shapes, annotations: anns,
      // [2026-08-25] showlegend:false — este plot tiene UN solo trace y sin `name`, así que la
      // leyenda solo podía decir "trace 0": no aportaba nada y el encabezado de la tarjeta ya
      // nombra la serie. Aplica a los dos paneles (Focos y Comportamiento) por eso mismo. El
      // marcador de día de __cnCompProdMarcarDia ya traía su propio showlegend:false.
      // [2026-08-31] Con `conLeyenda` sí se muestra: ya no hay un solo trace sin nombre, sino la
      // curva + una traza fantasma por referencia, todas con `name`. Horizontal y BAJO el eje X
      // (y negativo), para no robar ancho al área de dibujo — el panel de Focos es estrecho.
      showlegend: !!conLeyenda,
      legend: conLeyenda ? { orientation: "h", x: 0, xanchor: "left", y: -0.30, yanchor: "top",
                             font: { size: 9 }, bgcolor: "rgba(0,0,0,0)" } : undefined,
      // [2026-08-25] Títulos de eje: sin ellos no se sabía qué representa cada uno. `ejes` es
      // ADITIVO — sin él (panel de Focos) no se emite ninguno y el layout queda byte-idéntico.
      // La unidad del eje Y es la REAL del plot: en gas los valores van ÷1e6, así que el rótulo
      // dice MSCF (no PC), coherente con `uni` del hover.
      xaxis: { type: "category", tickangle: -45, tickfont: { size: 9 },
               title: ejX ? { text: ejX, font: { size: 10, color: "#6E7C75" }, standoff: 6 } : undefined },
      yaxis: { tickfont: { size: 9 }, separatethousands: true, range: [bottom, top],
               title: ejY ? { text: ejY, font: { size: 10, color: "#6E7C75" }, standoff: 6 } : undefined },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)"
    }, { displayModeBar: false, responsive: true }).then(function () { __cnPlotResize(elp); });
  }

  function __cnMilesEC(n) { return Number(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 }); }
  // [2026-08-11] SIN CONSUMIDORES desde que las pestañas del ejecutivo pasaron a colorearse por
  // PRODUCTO (D1) — era su único uso. Se conserva por si vuelve a hacer falta el semáforo por
  // cumplimiento; las clases is-ok/is-warn/is-bad que devuelve siguen vivas en el CSS de otros
  // componentes (19 reglas), así que la función es válida, solo que hoy nadie la llama.
  function __cnSemColor(pct) { return pct == null ? "" : (pct >= 90 ? "is-ok" : (pct >= 75 ? "is-warn" : "is-bad")); }
  // Reajusta un plot al ancho REAL de su contenedor (el grid puede no haber asentado su ancho al pintar).
  // Doble disparo (rAF + timeout) para capturar el layout ya asentado aunque el 1er intento llegue temprano.
  function __cnPlotResize(elp) {
    if (!window.Plotly || !elp) return;
    var doit = function () {
      // El div puede haber sido removido (cambio de panel/pestaña) o quedar oculto (grid reflow):
      // en ese caso Plotly.Plots.resize RECHAZA la promesa ("Resize must be passed a displayed plot
      // div element") y el try/catch no la atrapa (es asíncrona). Guardas + .catch para silenciarlo.
      if (!elp.isConnected) {   // removido del DOM → soltar el observer para no seguir disparando
        if (elp.__cnRO) { try { elp.__cnRO.disconnect(); } catch (e) {} elp.__cnRO = null; }
        return;
      }
      if (!elp.offsetWidth || !elp.offsetHeight) return;   // oculto o sin tamaño → no redimensionar
      try {
        var p = window.Plotly.Plots.resize(elp);
        if (p && typeof p.catch === "function") p.catch(function () {});
      } catch (e) {}
    };
    window.requestAnimationFrame(doit);
    window.setTimeout(doit, 200);
    // Observador: reajusta ante CUALQUIER cambio de tamaño del contenedor (p.ej. cuando el resumen
    // del LLM despliega y reflowea el grid de 3 columnas) — fix definitivo del "hueco" de la curva.
    if (window.ResizeObserver && !elp.__cnRO) {
      elp.__cnRO = new ResizeObserver(doit);
      elp.__cnRO.observe(elp);
    }
  }

  // [2026-08-25] QV2-PANEL-MES · curva MENSUAL de N3 ("producción mes a mes").
  // Gemela de __cnDailyPlot (:1909) y NO una reactivación de __cnMonthlyPlot (:2362): aquél indexa
  // `rm.series[producto]` y decide `esGas` comparando con la clave LITERAL "GAS", y el Motor Q v2
  // manda el producto en MINÚSCULA ("gas") — daría serie vacía y gas sin escalar, las dos cosas en
  // SILENCIO (la doble convención está documentada en :2628-2632, y prohíbe indexar por clave).
  // Aquí, como en el molde, todo entra por parámetro: arrays + escalares + `esGas` booleano del
  // caller. Lo único que se reusa de __cnMonthlyPlot es su mecánica de corte sólido/punteado
  // (:2389-2401), que sí está probada.
  // `ref` es el promedio de meses CERRADOS que ya calcula el backend (AF-3.3): NO se recalcula
  // aquí como media de la serie, porque la serie incluye el mes en curso (proyección) y saldría
  // un número distinto al del tablero.
  function __cnSerieMesPlot(elp, meses, valores, nums, mesActual, ref, refTxt, unidad, esGas, col, ejes) {
    if (!elp) return;
    if (!window.Plotly) { elp.innerHTML = '<div class="text-muted small p-2">(Plotly no disponible)</div>'; return; }
    var uni = unidad ? (" " + unidad) : "";
    var fmtD = esGas ? __cnGasM : function (v) { return __cnMilesEC(Math.round(v)); };
    // El gas se grafica en MSCF (÷1e6); el hover formatea el valor ORIGINAL con __cnGasM (que ya
    // divide), nunca el ya escalado — ese doble escalado es el bug documentado en :3650-3652.
    var yPlot = esGas ? valores.map(function (v) { return v == null ? null : v / 1e6; }) : valores;
    var refPlot = (esGas && ref) ? ref / 1e6 : ref;
    // Índice del mes EN CURSO = el punto que es proyección de cierre (HE4/AF-3.3). Llega por
    // número de mes desde el backend: el nombre viene abreviado ("Ago") y invertirlo en JS sería
    // un mapa duplicado y frágil.
    var idxProy = (nums && mesActual != null) ? nums.indexOf(mesActual) : -1;
    var cd = valores.map(function (v, i) {
      return [fmtD(v), (i === idxProy) ? " · proyección de cierre" : ""];
    });
    var hoverMes = "%{x}<br>%{customdata[0]}" + uni + "/mes%{customdata[1]}<extra></extra>";
    var shapes = [], anns = [];
    if (refPlot) {
      shapes.push({ type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: refPlot, y1: refPlot,
        line: { color: "#BA7517", width: 1.5, dash: "dash" } });
      anns.push({ x: 0, y: refPlot, xref: "paper", yref: "y", xanchor: "left", yanchor: "bottom",
        text: (refTxt || "promedio mensual") + " · " + fmtD(ref) + uni + "/mes",
        showarrow: false, font: { size: 10, color: "#BA7517" } });
    }
    var lineCol = col || "#1f6b4a";
    var rgb = __cnHexRgb(lineCol);
    // Fábrica de trazas: el archivo es ES5 (ni un `let`/`const`/arrow en 7000 líneas), así que
    // nada de Object.assign para clonar el común — una función explícita y ya.
    function trazo(xs, ys, cds, punteado, alpha) {
      return { type: "scatter", mode: "lines+markers", fill: "tozeroy", hovertemplate: hoverMes,
               x: xs, y: ys, customdata: cds,
               line: punteado ? { color: lineCol, width: 2.5, dash: "dot", shape: "spline", smoothing: 0.8 }
                              : { color: lineCol, width: 2.5, shape: "spline", smoothing: 0.8 },
               marker: { color: lineCol, size: 6 },
               fillcolor: "rgba(" + rgb + "," + alpha + ")" };
    }
    var traces;
    // Tramo cerrado SÓLIDO + tramo punteado hacia el mes en curso. El punteado arranca en
    // idxProy-1 para que los dos segmentos queden unidos (mismo criterio que :2397).
    if (idxProy > 0) {
      traces = [
        trazo(meses.slice(0, idxProy), yPlot.slice(0, idxProy), cd.slice(0, idxProy), false, "0.15"),
        trazo(meses.slice(idxProy - 1), yPlot.slice(idxProy - 1), cd.slice(idxProy - 1), true, "0.07")
      ];
    } else {
      traces = [trazo(meses, yPlot, cd, false, "0.15")];
    }
    // Eje Y desde 0 con techo = max(serie, referencia) + holgura, para que la línea del promedio
    // no quede pegada al borde (mismo criterio que el molde, :1931).
    var vv = yPlot.filter(function (v) { return v != null; });
    var top = Math.max(vv.length ? Math.max.apply(null, vv) : 0, refPlot || 0) * 1.18 || 1;
    var ejX = (ejes || {}).x || "", ejY = (ejes || {}).y || "";
    Plotly.newPlot(elp, traces, {
      autosize: true, margin: { l: ejY ? 62 : 52, r: 10, t: 14, b: ejX ? 46 : 30 },
      shapes: shapes, annotations: anns, showlegend: false,
      xaxis: { type: "category", tickfont: { size: 10 },
               title: ejX ? { text: ejX, font: { size: 10, color: "#6E7C75" }, standoff: 6 } : undefined },
      yaxis: { tickfont: { size: 9 }, separatethousands: true, range: [0, top],
               title: ejY ? { text: ejY, font: { size: 10, color: "#6E7C75" }, standoff: 6 } : undefined },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)"
    }, { displayModeBar: false, responsive: true }).then(function () { __cnPlotResize(elp); });
  }

  // [2026-08-25] QV2-PANEL-MES · WATERFALL de la variación mes a mes (N4).
  // Gemela de __cnWaterfallSVG (:4626) y NO una llamada a ella: aquélla lleva el esquema EBITDA
  // cableado —bandas de fondo con índices fijos (:4681), formato $/KUSD (:4665) y márgenes para 17
  // componentes—. De ahí se reusan la mecánica de acumulado, el dominio/escala y los conectores
  // punteados; se descarta todo lo demás.
  // Diferencias deliberadas con el molde:
  //  🔑 Etiquetas X HORIZONTALES y cortas (el mes destino). El molde las rota -40° y por eso
  //     reserva VMB=120, que aquí dejaría 215px de 375 para las barras. Con VMB=38 el área útil
  //     sube a ~330px. NADA de overflow:auto si aprieta — la regla de oro (:1403) lo prohíbe.
  //  🔑 Sobre la barra va el %, que es lo que se pregunta ("variación porcentual"); el volumen
  //     absoluto va al hover.
  //  🔑 El gas se escala UNA sola vez aquí (÷1e6) y se formatea con una función local: pasar por
  //     __cnGasM lo dividiría otra vez, que es el bug documentado en :3795-3797.
  function __cnVarWaterfallSVG(serie, deltas, esGas, col, proyMes, W, H) {
    var VML = 58, VMR = 12, VMT = 30, VMB = 38;
    var esc1 = esGas ? 1e6 : 1;
    function fmt(v) {
      var a = Math.abs(v);
      if (esGas) return (v < 0 ? "-" : "") + a.toFixed(a >= 1 ? 1 : 2).replace(".", ",");
      return (v < 0 ? "-" : "") + __cnMilesEC(Math.round(a));
    }
    // Componentes: nivel de partida (total) · un delta por salto · nivel de cierre (total).
    // 🔑 Los deltas se rotulan "→Feb" y los totales "Feb" a secas. Medido (2026-08-25): con el
    // mes pelado en ambos, el último salto y el nivel de cierre salían como dos "Ago" seguidos
    // y no se distinguía la transición del nivel. La flecha lo resuelve sin gastar ancho (las
    // etiquetas miden ~17px sobre un paso de barra de ~90px).
    var pasos = [{ tipo: "total", label: serie[0].mes, valor: serie[0].valor / esc1, pct: null }];
    deltas.forEach(function (x) {
      pasos.push({ tipo: "delta", label: "→" + x.a, mes: x.a, valor: x.delta / esc1, pct: x.pct,
                   proy: (x.a === proyMes) });
    });
    var ult = serie[serie.length - 1];
    pasos.push({ tipo: "total", label: ult.mes, valor: ult.valor / esc1, pct: null,
                 proy: (ult.mes === proyMes) });

    var n = pasos.length;
    var viw = W - VML - VMR, vih = H - VMT - VMB;
    var barW = viw / n, barInner = barW * 0.62, barPad = (barW - barInner) / 2;
    // Acumulado: un "total" fija el nivel; un "delta" flota sobre el acumulado (molde :4638-4649).
    var acum = 0, bars = [];
    pasos.forEach(function (s) {
      if (s.tipo === "total") {
        bars.push({ s: s, lo: 0, hi: s.valor, neg: s.valor < 0 });
        acum = s.valor;
      } else {
        var lo = s.valor < 0 ? acum + s.valor : acum;
        var hi = s.valor < 0 ? acum : acum + s.valor;
        bars.push({ s: s, lo: lo, hi: hi, neg: s.valor < 0 });
        acum += s.valor;
      }
    });
    var edges = [0];
    bars.forEach(function (b) { edges.push(b.lo, b.hi); });
    var maxV = Math.max.apply(null, edges), minV = Math.min.apply(null, edges);
    var rango = (maxV - minV) || 1;
    function sY(v) { return VMT + ((maxV - v) / rango) * vih; }
    var zeroY = sY(0);

    var VERDE = "#1E9E5A", ROJO = "#C5311E";   // mismos tokens que .cq-delta.is-up/.is-down
    var p = ['<svg class="cn-wf__svg cn-wf__svg--var" viewBox="0 0 ' + W + ' ' + H + '" ' +
             'preserveAspectRatio="xMidYMid meet" role="img" ' +
             'aria-label="Variación mes a mes de la producción">'];
    // grid + eje de valores
    var tk = [], paso = rango / 4;
    for (var i = 0; i <= 4; i++) tk.push(minV + paso * i);
    tk.forEach(function (t) {
      var y = sY(t).toFixed(1);
      p.push('<line x1="' + VML + '" y1="' + y + '" x2="' + (W - VMR) + '" y2="' + y +
             '" stroke="#ecf1f6" stroke-width="1"/>');
      p.push('<text class="cn-wf__tick" x="' + (VML - 6) + '" y="' + y +
             '" text-anchor="end" dominant-baseline="central">' + esc(fmt(t)) + '</text>');
    });
    p.push('<line x1="' + VML + '" y1="' + zeroY.toFixed(1) + '" x2="' + (W - VMR) + '" y2="' +
           zeroY.toFixed(1) + '" stroke="#d1d5db" stroke-width="1"/>');
    // conectores punteados entre el fin de una barra y el arranque de la siguiente
    function fin(b) { return b.s.tipo === "total" ? b.hi : (b.neg ? b.lo : b.hi); }
    bars.forEach(function (b, i) {
      if (i > 0 && b.s.tipo !== "total") {
        var y = sY(fin(bars[i - 1])).toFixed(1);
        p.push('<line x1="' + (VML + (i - 1) * barW + barW / 2).toFixed(1) + '" y1="' + y +
               '" x2="' + (VML + i * barW + barW / 2).toFixed(1) + '" y2="' + y +
               '" stroke="#9ca3af" stroke-width="1" stroke-dasharray="3 3"/>');
      }
    });
    // barras: totales en el color del PRODUCTO (identidad del panel), deltas verde/rojo por signo
    bars.forEach(function (b, i) {
      var s = b.s;
      var bx = VML + i * barW + barPad;
      var yHi = sY(b.hi), yLo = sY(b.lo);
      var yTop = Math.min(yHi, yLo), bh = Math.max(Math.abs(yLo - yHi), 2);
      var color = s.tipo === "total" ? (col || "#13355A") : (b.neg ? ROJO : VERDE);
      // Un decimal SIEMPRE en el %: el backend redondea a 1 (niveles.py:83) y JSON entrega 6.0
      // como 6, así que sin toFixed saldría "+6%" al lado de "+5,4%".
      var etq = (s.pct == null) ? fmt(s.valor)
                                : ((s.pct >= 0 ? "+" : "-") + Math.abs(s.pct).toFixed(1).replace(".", ",") + "%");
      var hov = (s.tipo === "total" ? "nivel de " + s.label : "cambio a " + (s.mes || s.label));
      var val = fmt(s.valor) + (s.pct != null ? "  (" + etq + ")" : "");
      p.push('<rect class="cn-wf__bar-rect" x="' + bx.toFixed(1) + '" y="' + yTop.toFixed(1) +
             '" width="' + barInner.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="3" fill="' + color +
             '"' + (s.proy ? ' stroke="#ffffff" stroke-width="1.5" stroke-dasharray="4 3"' : '') +
             ' data-label="' + esc(hov) + '" data-val="' + esc(val) + '" data-color="' + color + '"/>');
      p.push('<text class="cn-wf__val" x="' + (bx + barInner / 2).toFixed(1) + '" y="' +
             (yTop - 6).toFixed(1) + '" text-anchor="middle" fill="' +
             (s.tipo === "total" ? "#004236" : (b.neg ? ROJO : "#15794C")) + '">' + esc(etq) + '</text>');
      var cls = s.tipo === "total" ? "cn-wf__xlbl is-total" : "cn-wf__xlbl";
      p.push('<text class="' + cls + '" x="' + (VML + i * barW + barW / 2).toFixed(1) + '" y="' +
             (H - VMB + 14) + '" text-anchor="middle">' + esc(s.label) + '</text>');
    });
    p.push('</svg>');
    return p.join("");
  }

  // Monta la tarjeta del waterfall de N4. El hover NO se cablea aquí (el constructor de HTML es
  // puro): lo hace __cnPanelMesPintar con __cnEbBindHover, el mismo mecanismo del waterfall de
  // EBITDA — una tarjeta fija en la esquina, no un tooltip que sigue al cursor.
  function __cnVarMesInto(hostEl, d) {
    var serie = d.serie || [], deltas = d.deltas || [];
    var prod = String(d.producto || "");
    var nombre = prod.charAt(0).toUpperCase() + prod.slice(1).toLowerCase();
    var unidad = d.unidad || "bbl";
    var hd = esc(nombre) + ' · variación mes a mes ' + (d.anio || "") +
             ' <span class="cn-ins__hdu">(' + esc(unidad) + ')</span>';
    hostEl.innerHTML =
      '<div class="cn-ins__card"><div class="cn-ins__card-hd"><i class="bi bi-bar-chart-steps"></i> ' + hd + '</div>' +
      '<div class="cn-ins__plot cn-wf__svgwrap" data-p></div>' +
      '<div class="cn-ins__cap" data-cap></div></div>';
    var elp = hostEl.querySelector("[data-p]");
    if (serie.length < 2 || !deltas.length) {
      elp.innerHTML = '<div class="p-2 text-muted small">Sin suficientes meses para calcular la variación.</div>';
      return;
    }
    var esGas = String(prod).toUpperCase() === "GAS";
    // [2026-08-26] El lienzo se MIDE, ya no es fijo. Antes iba a 880×430 con
    // preserveAspectRatio="xMidYMid meet": el dibujo se escalaba hasta caber entero conservando
    // su 2,05:1 y se centraba. Como la tarjeta es bastante más apaisada (~3:1), el factor que
    // mandaba era el ALTO -> el dibujo salía a ~695 px dentro de ~1045 disponibles y dejaba unos
    // 175 px muertos a CADA lado (un tercio del ancho). Con el viewBox igual a la caja, la escala
    // queda en 1:1 y no hay bandas.
    // Mismo patrón que __cnEbRender (:5112), el otro waterfall del archivo — no se inventa nada.
    var W = Math.max(560, Math.round(elp.clientWidth || elp.getBoundingClientRect().width || 900));
    // El alto también se mide, con tope: la caja la reparte el flex de .cn-ins__plot y podría
    // llegar aplastada (min-height:120px en algunos contextos). Fuera del rango se cae a `meet`
    // y el dibujo se centra, que es el comportamiento previo — nunca un gráfico ilegible.
    // El default baja de 430 a 350: el hueco bajo la escalera de deltas es real (los cambios son
    // ±10% frente a un nivel del 100%) y se cierra ENCUADRANDO. NO se toca el máximo del eje Y —
    // subirlo un 30% hundiría las barras y encogería los deltas otro 23%, al revés de lo buscado
    // (las anclas ya ocupan el 97% del alto útil: 352 px de 362).
    var Hm = Math.round(elp.clientHeight || elp.getBoundingClientRect().height || 0);
    var H = (Hm >= 320 && Hm <= 430) ? Hm : 350;
    elp.innerHTML = __cnVarWaterfallSVG(serie, deltas, esGas, __cnProdCol(prod),
                                        d.proyeccion_mes, W, H) +
                    '<div class="cn-wf__hover" style="display:none"></div>';
  }

  // Monta la tarjeta del panel mensual y pinta la curva. Gemela de __cnDailyInto (:1853): el host
  // llega por parámetro y la función no busca nada fuera de él.
  function __cnSerieMesInto(hostEl, d) {
    var serie = d.serie || [];
    var prod = String(d.producto || "");
    // Title Case + resto en minúsculas, el MISMO tono que el título del panel diario (:1856):
    // no hay `text-transform` en .cn-ins__card-hd, así que lo que se escribe es lo que se ve.
    var nombre = prod.charAt(0).toUpperCase() + prod.slice(1).toLowerCase();
    var unidad = d.unidad || "bbl";
    var hayProm = d.promedio != null;
    var hd = esc(nombre) + ' · producción mensual ' + (d.anio || "") + (hayProm ? ' vs promedio' : '');
    hostEl.innerHTML =
      '<div class="cn-ins__card"><div class="cn-ins__card-hd"><i class="bi bi-graph-up"></i> ' + hd + '</div>' +
      '<div class="cn-ins__plot" data-p></div>' +
      '<div class="cn-ins__cap" data-cap></div></div>';
    var elp = hostEl.querySelector("[data-p]");
    if (!serie.length) {
      elp.innerHTML = '<div class="p-2 text-muted small">Sin serie mensual para este producto.</div>';
      return;
    }
    // Normalizar el caso ANTES de comparar: el producto llega "gas" del Motor Q v2 y "GAS" del
    // análisis v1 (:2730). __CP_PROD no lleva el nombre del producto, así que la identidad de gas
    // se resuelve sobre el string normalizado, nunca indexando el mapa con la clave cruda.
    var esGas = String(prod).toUpperCase() === "GAS";
    __cnSerieMesPlot(elp, serie.map(function (p) { return p.mes; }),
                     serie.map(function (p) { return p.valor; }),
                     serie.map(function (p) { return p.num; }),
                     d.mes_actual, d.promedio,
                     "promedio mensual " + (d.anio || ""), unidad, esGas,
                     __cnProdCol(prod),
                     { x: "Mes", y: "Producción (" + unidad + "/mes)" });
  }

  // ============ Sección "Diferidas" del acordeón (histórico de frecuencia por causa) ============
  // Datos de ECP_DIFERIDAS (SQLite) vía /api/diferidas/frecuencia. Frecuencia = INCIDENTES (no días), en %.
  // Se dispara lazy desde __cnFilialToggle al abrir la sección (contenedor .cn-dif con data-ent/niv/campos).
  // Caché de datos en el FRONTEND por ámbito (ent|niv|campos): los datos son históricos/estáticos, así
  // que al re-renderizar el panel (cambiar de pestaña y volver) la sección se repinta al INSTANTE desde
  // memoria — sin "Cargando…", sin re-fetch y sin rehacer la construcción de las gráficas desde cero.
  var __cnDifCache = {};
  function __cnDiferidasInto(host) {
    if (!host) return;
    var ent = host.dataset.ent || "", niv = host.dataset.niv || "", campos = host.dataset.campos || "";
    var key = ent + "|" + niv + "|" + campos;
    if (__cnDifCache[key]) { __cnDifRender(host, __cnDifCache[key]); return; }   // ya cargado → instantáneo
    host.innerHTML = '<div class="cn-desemp__pend">Cargando diferidas…</div>';
    var qs = [];
    if (ent) qs.push("entidad=" + encodeURIComponent(ent));
    if (niv) qs.push("nivel=" + encodeURIComponent(niv));
    if (campos) qs.push("campos=" + encodeURIComponent(campos));
    fetch("/api/diferidas/frecuencia" + (qs.length ? "?" + qs.join("&") : ""), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && !d.motivo) __cnDifCache[key] = d;   // cachea éxito o vacío GENUINO; NO fallos transitorios (motivo)
        __cnDifRender(host, d);
      })
      .catch(function () {
        host.dataset.loaded = "0";   // fallo de red → permitir reintento al reabrir la sección
        host.innerHTML = '<div class="cn-desemp__pend">No se pudo cargar diferidas. Reabre la sección para reintentar.</div>';
      });
  }

  function __cnDifRender(host, d) {
    var m = (d && d.meta) || {};
    if (!d || d.sin_datos) {
      // 'motivo' presente = fallo transitorio (BD no disponible / error de lectura) → reintentable al reabrir.
      // sin_datos SIN motivo = entidad genuinamente sin diferidas (estado terminal, no reintentar).
      if (d && d.motivo) host.dataset.loaded = "0";
      host.innerHTML = '<div class="cn-desemp__pend">Sin diferidas registradas' +
        (m.scope_label ? ' para ' + esc(m.scope_label) : '') + ' en 2023–2025.' +
        (d && d.motivo ? ' <span style="opacity:.7">(' + esc(d.motivo) + ' — reabre para reintentar)</span>' : '') + '</div>';
      return;
    }
    var sub = esc(m.rango || "ene-2023 → jul-2025") +
      (m.total_incidentes != null ? " · " + __cnMilesEC(m.total_incidentes) + " incidentes" : "") +
      (m.pozos_total != null ? " en " + m.pozos_total + " pozos" : "") +
      " · independiente del mes en curso";
    // [2026-07-25] Layout POR PRODUCTO (decisión del usuario): se retira "Tipos de mayor frecuencia".
    // CRUDO/GAS muestran IMPACTO (volumen perdido por causa NV04, bbl/MSCF); BLANCOS no tiene columna de
    // volumen perdido → conserva "Pozos afectados por grupo". "Comportamiento por tipo" queda igual en ambos.
    var prod = (host.dataset.prod || "").toUpperCase();
    var esGas = (prod === "GAS"), esBlancos = (prod === "BLANCOS");
    var conImpacto = !esBlancos;   // impacto solo donde hay dato de volumen (crudo/gas)
    var uni = esGas ? "MSCF" : "bbl";
    var cardImpacto = '<div class="cn-dif__c"><div class="cn-dif__ct">Pérdida por causa (NV04)</div>' +
      '<div class="cn-dif__note">Volumen perdido · ' + uni + ' · histórico 2023–25</div>' +
      '<div class="cn-dif__impacto"></div></div>';
    var cardTend = '<div class="cn-dif__c"><div class="cn-dif__ct">Comportamiento por tipo</div>' +
      '<div class="cn-dif__note">Solo tipos que empeoran · % de incidentes · 2025 vs 2024</div>' +
      '<div class="cn-dif__tend"></div></div>';
    var cardPozos = '<div class="cn-dif__c"><div class="cn-dif__ct">Pozos afectados por grupo</div>' +
      '<div class="cn-dif__note">Pozos distintos por grupo · conteo</div>' +
      '<div class="cn-dif__pozos"></div></div>';
    host.innerHTML =
      '<div class="cn-dif__hd"><b>Diferidas históricas</b>' + (m.scope_label ? " · " + esc(m.scope_label) : "") +
      '<span class="cn-dif__sub">' + sub + '</span></div>' +
      '<div class="cn-dif__cols">' + (conImpacto ? (cardImpacto + cardTend) : (cardTend + cardPozos)) + '</div>';
    __cnDifTendenciaTabla(host.querySelector(".cn-dif__tend"), d.tendencia || []);
    if (conImpacto) {
      __cnDifImpacto(host.querySelector(".cn-dif__impacto"), (d.impacto && d.impacto[prod]) || null, prod);
    } else {
      __cnDifPozos(host.querySelector(".cn-dif__pozos"), d.pozos_por_grupo || [], m);
    }
  }

  // [2026-08-26] Panel de pila "analiza_dif". Preguntar DIRECTO por las diferidas de un campo
  // («¿cuáles son las causas de las diferidas de Akacias?») devolvía SOLO texto: este panel ya
  // existía, pero únicamente como pestaña del acordeón de foco de `causal` — nadie llegaba a él
  // por esa puerta. Constructor PURO (no toca el DOM): emite el host vacío con el scope en
  // data-attrs, y __cnDifPanelCargar() dispara el lazy YA existente después de insertar el
  // bloque (mismo patrón asíncrono que "analiza_foco" y "cuant_dia_panel").
  // 🔑 Se reusa __cnDiferidasInto tal cual — mismo endpoint, misma caché por ámbito, mismo
  // render. Un segundo camino de pintado sería un gemelo que se desincroniza.
  function __cnDifPanelHtml(d) {
    var dd = d || {};
    var campos = (dd.campos && dd.campos.length) ? dd.campos.join("|") : "";
    // Un solo producto: elige la columna de volumen perdido (ACEITE vs GAS) que pinta
    // __cnDifRender. El backend ya resuelve el default (CRUDO); esto es la red de seguridad.
    var prod = String(dd.producto || "CRUDO").toUpperCase();
    // data-prod en la RAÍZ para que el dispatcher (:3742) herede el filete de color del bloque.
    return '<div class="cn-difblk" data-prod="' + esc(prod) + '">' +
      '<div class="cp-foco__phd"><i class="bi bi-droplet-half"></i><b>Diferidas</b>' +
      '<span class="cp-foco__pmeta">· histórico 2023–2025</span></div>' +
      '<div class="cn-dif" data-loaded="0" data-ent="' + esc(dd.entidad || "") +
      '" data-niv="' + esc(dd.nivel || "") + '" data-campos="' + esc(campos) +
      '" data-prod="' + esc(prod) + '"></div></div>';
  }

  function __cnDifPanelCargar(blk) {
    var h = blk && blk.querySelector(".cn-dif[data-loaded='0']");
    if (!h) return;
    h.dataset.loaded = "1";
    // No espera a blk.isConnected (a diferencia de analiza_foco): __cnDifRender escribe HTML
    // plano —tablas y barras CSS, sin Plotly— así que pinta correcto dentro de un fragment.
    try { __cnDiferidasInto(h); } catch (e) {}
  }

  // [2026-08-13] Mantenimientos: mismo patrón lazy que Diferidas (data-loaded="0", caché por scope,
  // 'motivo' presente = fallo transitorio reintentable, sin_datos sin motivo = vacío genuino).
  var __cnMttoCache = {};
  function __cnManttoInto(host) {
    if (!host) return;
    var ent = host.dataset.ent || "", niv = host.dataset.niv || "",
        campos = host.dataset.campos || "", per = host.dataset.per || "";
    var key = ent + "|" + niv + "|" + campos + "|" + per;
    if (__cnMttoCache[key]) { __cnManttoRender(host, __cnMttoCache[key]); return; }
    host.innerHTML = '<div class="cn-desemp__pend">Cargando mantenimientos…</div>';
    var qs = [];
    if (ent) qs.push("entidad=" + encodeURIComponent(ent));
    if (niv) qs.push("nivel=" + encodeURIComponent(niv));
    if (campos) qs.push("campos=" + encodeURIComponent(campos));
    if (per) qs.push("periodo=" + encodeURIComponent(per));
    fetch("/api/mantenimientos/eventos" + (qs.length ? "?" + qs.join("&") : ""), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && !d.motivo) __cnMttoCache[key] = d;   // no cachea fallos transitorios (patrón Diferidas)
        __cnManttoRender(host, d);
      })
      .catch(function () {
        host.dataset.loaded = "0";                     // permite reintentar al reabrir
        host.innerHTML = '<div class="cn-desemp__pend">No se pudo cargar mantenimientos. Reabre la sección para reintentar.</div>';
      });
  }
  function __cnManttoRender(host, d) {
    if (!host) return;
    if (!d || d.sin_datos) {
      host.innerHTML = '<div class="cn-desemp__pend">' +
        esc(d && d.motivo ? d.motivo : "Sin eventos de servicio a pozo en este alcance y periodo.") +
        '</div>';
      return;
    }
    var meta = d.meta || {};
    var cnt = (meta.total > meta.mostrados)
      ? (meta.mostrados + " de " + meta.total + " eventos")
      : (meta.total + " evento" + (meta.total === 1 ? "" : "s"));
    var cap = '<div class="cp-foco__mock"><i class="bi bi-info-circle"></i> ' +
      esc(meta.periodo || "") + ' · ' + cnt +
      (meta.abiertos ? (" · " + meta.abiertos + " abierto" + (meta.abiertos === 1 ? "" : "s")) : "") +
      '</div>';
    // title= conserva el texto completo cuando el CSS lo recorta con ellipsis (pozo/tipo largos reales)
    var rows = (d.eventos || []).map(function (m) {
      var abierto = m.estado === "abierto";
      return '<div class="cp-foco__mrow">' +
        '<span class="cp-foco__mpozo" title="' + esc(m.pozo) + '">' + esc(m.pozo) + '</span>' +
        '<span class="cp-foco__mtipo" title="' + esc(m.tipo) + '">' + esc(m.tipo) + '</span>' +
        '<span class="cp-foco__mest ' + (abierto ? "is-ejec" : "is-prog") + '">' +
          '<i class="cp-foco__mdot"></i>' + (abierto ? "Abierto" : "Cerrado") + '</span>' +
        '<span class="cp-foco__mfin">' + esc(abierto ? m.inicio : m.fin) + '</span></div>';
    }).join("");
    host.innerHTML = cap + '<div class="cp-foco__mtbl">' + rows + '</div>';
  }

  // Impacto por causa (N4): VOLUMEN perdido por tipo, barras horizontales ordenadas desc (top-6 + Otros).
  // Crudo = bbl reales (__cnMilesEC); Gas = MSCF (__cnGasM, ÷1e6 — misma escala que la producción,
  // verificado). Reusa la barra de __cnDifPozos (.cn-dif__ptrack/__pfill); etiqueta = volumen + %.
  function __cnDifImpacto(el, imp, prod) {
    if (!el) return;
    var causas = (imp && imp.causas) || [];
    if (!imp || !imp.total || !causas.length) {
      el.innerHTML = '<div class="cn-desemp__pend">Sin volumen perdido registrado en el histórico.</div>';
      return;
    }
    var esGas = (prod === "GAS");
    var uni = esGas ? "MSCF" : "bbl";
    var fmt = esGas ? function (v) { return __cnGasM(v); } : function (v) { return __cnMilesEC(Math.round(v)); };
    var max = causas.reduce(function (a, c) { return Math.max(a, c.vol || 0); }, 0) || 1;
    var rows = causas.map(function (c) {
      var w = (Math.max(c.vol || 0, 0) / max * 100).toFixed(1);
      var pct = (c.pct != null ? String(c.pct).replace(".", ",") : "0") + "%";
      var lab = esc(c.causa) + (c.n_otros ? " (" + c.n_otros + " tipos)" : "");
      return '<div class="cn-dif__irow"><div class="cn-dif__ilab" title="' + esc(c.causa) + '">' + lab + '</div>' +
        '<div class="cn-dif__ptrack"><div class="cn-dif__pfill" style="width:' + w + '%"></div></div>' +
        '<div class="cn-dif__ival">' + fmt(c.vol) + ' ' + uni + '<span class="cn-dif__ipct">' + pct + '</span></div></div>';
    }).join("");
    el.innerHTML =
      '<p class="cn-dif__kpi">Total perdido: <b>' + fmt(imp.total) + ' ' + uni + '</b></p>' +
      '<div class="cn-dif__plist">' + rows + '</div>';
  }

  // Pareto de grupos (N2): barras apiladas por año, % de incidentes; rótulo = % total sobre cada barra.
  function __cnDifParetoPlot(elp, pareto, total) {
    if (!elp) return;
    if (!window.Plotly) { elp.innerHTML = '<div class="text-muted small p-2">(Plotly no disponible)</div>'; return; }
    if (!pareto.length || !total) { elp.innerHTML = '<div class="cn-desemp__pend">Sin datos.</div>'; return; }
    var grupos = pareto.map(function (g) { return g.grupo; });
    var years = ["2023", "2024", "2025"];
    var colors = { "2023": "#1f5c43", "2024": "#8ba23a", "2025": "#e7b21f" };
    var traces = years.map(function (y) {
      return {
        name: y, type: "bar", x: grupos,
        y: pareto.map(function (g) { return (g.anios && g.anios[y] || 0) / total * 100; }),
        marker: { color: colors[y] },
        hovertemplate: y + " · %{x}<br>%{y:.1f}% de incidentes<extra></extra>"
      };
    });
    var anns = pareto.map(function (g) {
      return {
        x: g.grupo, y: g.total / total * 100, yshift: 3, showarrow: false,
        text: String(g.pct != null ? g.pct : Math.round(g.total / total * 100)).replace(".", ",") + "%",
        xanchor: "center", yanchor: "bottom", font: { size: 10, color: "#1c231f" }
      };
    });
    Plotly.newPlot(elp, traces, {
      barmode: "stack", autosize: true, margin: { l: 30, r: 6, t: 18, b: 42 },
      showlegend: true, legend: { orientation: "h", y: 1.16, x: 0, font: { size: 9 } },
      xaxis: { tickfont: { size: 9 }, tickangle: 0 },
      yaxis: { ticksuffix: "%", tickfont: { size: 8 }, rangemode: "tozero" },
      annotations: anns, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)"
    }, { displayModeBar: false, responsive: true }).then(function () { __cnPlotResize(elp); });
  }

  // Tabla de tendencia por tipo (N4): % por año + semáforo (▼ mejora / ▲ empeora / ● estable).
  function __cnDifTendenciaTabla(el, tend) {
    if (!el) return;
    var pf = function (x) { return (x == null ? 0 : x).toFixed(1).replace(".", ",") + "%"; };
    if (!(tend || []).length) {   // ninguna causa se deterioró 2025 vs 2024 (estado terminal, no error)
      el.innerHTML = '<div class="cn-desemp__pend">Ningún tipo empeoró en 2025 frente a 2024.</div>';
      return;
    }
    var rows = (tend || []).map(function (t) {
      var s = t.tendencia || "estable";
      var cls = s === "mejora" ? "up" : (s === "empeora" ? "down" : "flat");
      var ic = s === "mejora" ? "▼" : (s === "empeora" ? "▲" : "●");
      var p = t.pct || {};
      return '<tr' + (t.otros ? ' class="otros"' : "") + '><td>' + esc(t.causa) + '</td>' +
        '<td class="dim">' + pf(p["2023"]) + '</td><td class="dim">' + pf(p["2024"]) + '</td>' +
        '<td class="cur">' + pf(p["2025"]) + '</td>' +
        '<td class="semcell"><span class="cn-dif__sem cn-dif__sem--' + cls + '">' + ic + " " + s + '</span></td></tr>';
    }).join("");
    el.innerHTML = '<div class="cn-dif__tblscroll"><table class="cn-dif__tbl"><thead><tr>' +
      '<th>Tipo (NV04)</th><th>2023</th><th>2024</th><th class="cur">2025</th><th class="c">Tend.</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  // Pozos afectados por grupo (CONTEO de COMPLETION distintos): barras horizontales.
  function __cnDifPozos(el, pozos, m) {
    if (!el) return;
    var max = pozos.reduce(function (a, g) { return Math.max(a, g.pozos || 0); }, 0) || 1;
    var rows = (pozos || []).map(function (g) {
      var w = (g.pozos / max * 100).toFixed(1);
      return '<div class="cn-dif__prow"><div class="cn-dif__plab">' + esc(g.grupo) + '</div>' +
        '<div class="cn-dif__ptrack"><div class="cn-dif__pfill" style="width:' + w + '%"></div></div>' +
        '<div class="cn-dif__pval">' + g.pozos + '</div></div>';
    }).join("");
    el.innerHTML =
      '<p class="cn-dif__kpi"><b>' + (m.pozos_total != null ? m.pozos_total : "—") + '</b> pozos con diferidas en el histórico</p>' +
      '<div class="cn-dif__plist">' + rows + '</div>' +
      '<p class="cn-dif__pnote">Un pozo puede tener varias causas → los conteos suman más que el total. Solo pozos que <b>sí</b> tuvieron diferida.</p>';
  }

  // __cnRenderDesemp: ELIMINADO (2026-07-24). El comportamiento diario ahora vive dentro de cada
  // foco (acordeón por foco); ver __cnFocosHtml (rama ECP) + __cnPaintFocoCharts + __cnDaily/MonthlyInto.

  // Ritmo diario por mes del producto elegido (Plotly). [A5] un solo producto a la vez (escalas dispares).
  // El detector de valle en JS se retiró con la curva diaria (2026-07-23): el valle se sigue anotando en
  // el panel izquierdo, que lo recibe ya calculado del backend (_detectar_valle).
  // Panel DERECHO del foco (2026-07-24): "Atribución del gap por campo" — bullet Meta vs Real, SOLO
  // detractores. Reemplaza la antigua "Producción mensual". Reusa __ejecBullet (barra azul = Real del
  // campo, marca = Meta, etiqueta roja "faltó X"). El dato ya viene calculado en ejecutivo.gap_por_producto.
  // [2026-07-26] Color de la barra por banda de cumplimiento (decisión del usuario): ≥90% verde
  // sólido · 60–<90% el mismo verde difuminado al 50% · <60% amarillo. Sin meta → verde sólido.
  function __cnGpmBand(cumpl, sinMeta) {
    if (sinMeta) return "gpm__fill--ok";
    return cumpl >= 0.9 ? "gpm__fill--ok" : (cumpl >= 0.6 ? "gpm__fill--mid" : "gpm__fill--low");
  }
  function __cnGapCampoInto(prod, hostEl, ed, dd, foco) {
    var g = (ed && ed.gap_por_producto && ed.gap_por_producto[prod]) || null;
    var dets = (g && g.detractores) || [];
    var nombre = prod.charAt(0).toUpperCase() + prod.slice(1).toLowerCase();
    var U = { CRUDO: "bbl", GAS: "MSCF", BLANCOS: "bbl" }[prod] || "";   // gas MSCF · crudo/blancos bbl
    var esGas = (prod === "GAS");
    var mesN = (dd && dd.mes && dd.mes.nombre) || "";                    // mes dinámico = último mes cargado
    // [2026-07-25] Gas en MSCF = millones de pies³ (÷1e6, 2 dec, coma es-CO) — SIN cambios.
    // Crudo/Blancos en bbl REALES (miles es-CO, sin decimales): antes iban ÷1e6 y "260.000 bbl"
    // se leía como "0,26 bbl". La unidad la fija el producto (gas MSCF · crudo/blancos bbl).
    var fmtN = function (v) {
      var n = Math.abs(Number(v) || 0);
      return esGas ? (n / 1e6).toFixed(2).replace(".", ",") : __cnMilesEC(Math.round(n));
    };
    var fmtU = function (v) { return fmtN(v) + " " + U; };
    var prodLbl = "Producido" + (mesN ? " " + esc(mesN) : "");   // "Producido Mayo" (mes dinámico)
    // [2026-07-26] Producto que va bien (es_ok) → panorama: 2 mayores + 2 menores por producción
    // (extremos que trae el foco). No hay "faltante": se muestra Producido vs Producción esperada.
    if (foco && foco.es_ok) {
      var ext = (foco.extremos || []).map(function (e) {
        return { campo: e.campo, prod: Math.max(e.real, 0), meta: e.meta,
                 cumpl: e.meta > 0 ? __ejClamp(e.real / e.meta, 0, 1) : 1, sinMeta: !(e.meta > 0) };
      }).sort(function (a, b) { return b.prod - a.prod; });
      if (!ext.length) {
        hostEl.innerHTML = '<div class="gpm"><div class="gpm__empty">Sin producción de ' +
          esc(nombre.toLowerCase()) + ' en el periodo.</div></div>';
        return;
      }
      var bodyOk = ext.map(function (r) {
        var pct = Math.round(r.cumpl * 100);
        var pctTxt = r.sinMeta ? "sin Producción esperada" : (pct + "% de Producción esperada");
        return '<div class="gpm__row">' +
          '<div class="gpm__top"><span class="gpm__name">' + esc(r.campo) + '</span>' +
          '<span class="gpm__pct">' + pctTxt + '</span>' +
          '<span class="gpm__falta">' + prodLbl + ' <b>' + fmtU(r.prod) + '</b></span></div>' +
          '<div class="gpm__bar" role="meter" aria-valuenow="' + Math.round(r.prod) + '" aria-valuemin="0" aria-valuemax="' +
            Math.round(r.meta || r.prod) + '"><span class="gpm__fill ' + __cnGpmBand(r.cumpl, r.sinMeta) + '" style="width:0" data-w="' + (r.cumpl * 100) + '"></span></div>' +
          '<div class="gpm__foot"><span>' + prodLbl + ' ' + fmtU(r.prod) + '</span><span>' +
            (r.sinMeta ? 'sin Producción esperada' : 'Producción esperada ' + fmtU(r.meta)) + '</span></div>' +
        '</div>';
      }).join("");
      hostEl.innerHTML =
        '<div class="gpm">' +
          '<div class="gpm__head"><i class="bi bi-bar-chart-steps"></i>' +
            '<span class="gpm__title">' + esc(nombre) + ' · Producción' + (mesN ? ' ' + esc(mesN) : '') +
              ' · mayores y menores</span></div>' +
          '<div class="gpm__body">' + bodyOk + '</div>' +
          '<div class="gpm__legend"><span class="gpm__lg"><i class="gpm__chip gpm__chip--fill"></i> ' + prodLbl + '</span>' +
            '<span class="gpm__lg"><i class="gpm__chip gpm__chip--track"></i> Producción esperada</span></div>' +
        '</div>';
      (window.requestAnimationFrame || function (fn) { setTimeout(fn, 30); })(function () {
        hostEl.querySelectorAll(".gpm__fill").forEach(function (elf) { elf.style.width = elf.dataset.w + "%"; });
      });
      return;
    }
    // [2026-08-31] Solo se pintan los DETRACTORES (▼ bajo meta) — decisión del usuario: este panel
    // responde "dónde está el faltante", y los campos sobre meta distraían de esa lectura.
    //
    // Revierte deliberadamente la decisión del 2026-07-26, que había sumado los compensadores
    // (▲ sobre meta) porque en un Activo con un campo por encima (p.ej. CHICHIMENE 105% amortiguando
    // a CHICHIMENE SW 89%) ese campo quedaba invisible pese a venir en el payload. Ese contexto se
    // pierde aquí a propósito; `g.compensadores` SIGUE usándose en los gráficos de divergencia
    // (__ejecDiverg, ~línea 5599 en adelante), que no se tocan.
    //
    // [2026-08-31] Orden por FALTANTE ABSOLUTO descendente (el mayor déficit arriba) — decisión del
    // usuario: el panel responde "dónde está el faltante", y ahí manda el volumen, no el porcentaje.
    // Sustituye al orden por % ascendente del 2026-07-26: un campo al 61% podía quedar por encima de
    // otro al 78% que faltaba 200 kbbl más. Los "sin meta" (delta 0) caen al final por su propio peso.
    var mkRow = function (d, dir) {
      var m = d.meta;
      return { campo: d.campo, prod: Math.max(d.real, 0), meta: m, dir: dir,
               delta: dir === "alto" ? Math.max(d.real - m, 0) : Math.max(m - d.real, 0),
               ratio: m > 0 ? d.real / m : Infinity,        // ya no ordena; se conserva por si vuelve
               cumpl: m > 0 ? __ejClamp(d.real / m, 0, 1) : 1, sinMeta: !(m > 0) };
    };
    var rows = dets.map(function (d) { return mkRow(d, "bajo"); })
      .sort(function (a, b) { return b.delta - a.delta; });
    if (!rows.length) {
      // [2026-08-31] Al filtrar los compensadores, este caso ya no significa "sin desviación": puede
      // haber campos SOBRE meta y ninguno por debajo. Decirlo así evita afirmar algo que no es cierto.
      hostEl.innerHTML = '<div class="gpm"><div class="gpm__empty">Ningún campo por debajo de la Producción esperada en el periodo.</div></div>';
      return;
    }
    var gapTotal = rows.reduce(function (s, r) { return r.dir === "bajo" ? s + r.delta : s; }, 0);
    var body = rows.map(function (r) {
      // [2026-08-31] Se retira el "NN% de Producción esperada" de la fila — decisión del usuario:
      // con 5 campos hacía que .gpm__top envolviera a dos líneas y el panel creciera de más. El dato
      // no se pierde: el % sigue siendo el ancho de la barra, su banda de color (__cnGpmBand) y el
      // aria-label, y el pie mantiene Producido vs Producción esperada en cifras absolutas.
      var deltaTxt = r.sinMeta ? '' : (r.dir === "alto"
        ? '<span class="gpm__falta gpm__falta--up">▲ +<b>' + fmtU(r.delta) + '</b></span>'
        : '<span class="gpm__falta">▼ falta <b>' + fmtU(r.delta) + '</b></span>');
      return '<div class="gpm__row gpm__row--' + r.dir + '">' +
        '<div class="gpm__top"><span class="gpm__name">' + esc(r.campo) + '</span>' + deltaTxt + '</div>' +
        '<div class="gpm__bar" role="meter" aria-valuenow="' + Math.round(r.prod) + '" aria-valuemin="0" ' +
        'aria-valuemax="' + Math.round(r.meta) + '" aria-label="' + esc(r.campo) + ': ' + prodLbl + ' ' + fmtU(r.prod) +
        ' de Producción esperada ' + fmtU(r.meta) + '">' +
        '<span class="gpm__fill ' + __cnGpmBand(r.cumpl, r.sinMeta) + '" style="width:0" data-w="' + (r.cumpl * 100) + '"></span></div>' +
        '<div class="gpm__foot"><span>' + prodLbl + ' ' + fmtU(r.prod) + '</span><span>Producción esperada ' + fmtU(r.meta) + '</span></div>' +
      '</div>';
    }).join("");
    hostEl.innerHTML =
      '<div class="gpm">' +
        '<div class="gpm__head"><i class="bi bi-bar-chart-steps"></i>' +
          '<span class="gpm__title">' + esc(nombre) + ' · Producción' + (mesN ? ' ' + esc(mesN) : '') +
            ' vs Producción esperada</span>' +
          (gapTotal > 0 ? '<span class="gpm__total">gap total ' + fmtU(gapTotal) + '</span>' : '') + '</div>' +
        '<div class="gpm__body">' + body + '</div>' +
        '<div class="gpm__legend">' +
          '<span class="gpm__lg"><i class="gpm__chip gpm__chip--fill"></i> ' + prodLbl + '</span>' +
          '<span class="gpm__lg">▼ bajo meta</span></div>' +
      '</div>';
    // anima el relleno 0→valor al montar (respeta prefers-reduced-motion vía CSS)
    (window.requestAnimationFrame || function (f) { setTimeout(f, 30); })(function () {
      hostEl.querySelectorAll(".gpm__fill").forEach(function (elf) { elf.style.width = elf.dataset.w + "%"; });
    });
  }

  // Gráfica MENSUAL (barras REAL por mes + línea promedio mensual) dentro de un contenedor dado.
  // [2026-07-24] Ya NO se usa en el panel del foco (lo reemplazó __cnGapCampoInto); se conserva por si
  // se requiere en otra vista.
  function __cnMonthlyInto(prod, hostEl, d) {
    var anio = (d.mes && d.mes.anio) || "";
    hostEl.innerHTML =
      '<div class="cn-desemp__card"><div class="cn-desemp__card-hd"><span><i class="bi bi-bar-chart-line"></i> ' +
      'Producción mensual · ' + anio + '</span></div><div class="cn-desemp__plot" data-p></div></div>';
    __cnMonthlyPlot(hostEl.querySelector("[data-p]"), prod, d);
  }

  function __cnMonthlyPlot(elp, producto, d) {
    if (!elp || !d) return;
    if (!window.Plotly) { elp.innerHTML = '<div class="text-muted small p-2">(Plotly no disponible)</div>'; return; }
    var rm = d.ritmo_mensual || {};
    var x = rm.meses || [], y = (rm.series || {})[producto] || [];
    var nums = rm.meses_num || [];
    var prom = (rm.promedio_mes || {})[producto];          // promedio MENSUAL de meses cerrados (= 3,3M)
    var mesActual = rm.mes_actual;
    var U = { CRUDO: "bbl", GAS: "MSCF", BLANCOS: "bbl" }[producto] || "";
    var esGas = producto === "GAS";
    var fmtV = esGas ? __cnGasM : __cnFmtKpi;   // GAS en MSCF (÷1e6)
    var yPlot = esGas ? y.map(function (v) { return v == null ? null : v / 1e6; }) : y;
    var promPlot = (esGas && prom) ? prom / 1e6 : prom;
    var colores = x.map(function (_, i) { return (nums[i] === mesActual) ? "#7fb59a" : "#1f6b4a"; });
    var esProy = x.map(function (_, i) { return (nums[i] === mesActual) ? " · proyección de cierre" : ""; });
    var cd = x.map(function (_, i) { return [fmtV(y[i]) + " " + U + "/mes", esProy[i]]; });
    var shapes = [], anns = [];
    if (promPlot) {
      shapes.push({ type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: promPlot, y1: promPlot,
        line: { color: "#BA7517", width: 1.5, dash: "dash" } });
      anns.push({ x: 0, y: promPlot, xref: "paper", yref: "y", xanchor: "left", yanchor: "bottom",
        text: "promedio mensual " + ((d.mes && d.mes.anio) || "") + " (" + fmtV(prom) + " " + U + "/mes)",
        showarrow: false, font: { size: 10, color: "#BA7517" } });
    }
    // Línea+área para los meses cerrados; segmento punteado hacia el mes en curso (proyección de
    // cierre) — reemplaza el color de barra claro/oscuro que antes marcaba esa distinción.
    var hoverMon = "%{x}<br>%{customdata[0]}%{customdata[1]}<extra></extra>";
    var idxActual = nums.indexOf(mesActual);
    var traces;
    if (idxActual > 0) {
      traces = [
        // [2026-08-31] spline en las DOS mitades. Comparten el punto de unión (`idxActual - 1`), y
        // cada spline lo aborda con su propia curvatura: puede verse un leve quiebre justo ahí.
        // Se acepta a cambio de la coherencia visual con el resto de las curvas.
        { x: x.slice(0, idxActual), y: yPlot.slice(0, idxActual), customdata: cd.slice(0, idxActual),
          type: "scatter", mode: "lines+markers",
          line: { color: "#1f6b4a", width: 2.5, shape: "spline", smoothing: 0.8 },
          marker: { color: "#1f6b4a", size: 7 }, fill: "tozeroy", fillcolor: "rgba(31,107,74,0.15)",
          hovertemplate: hoverMon },
        { x: x.slice(idxActual - 1), y: yPlot.slice(idxActual - 1), customdata: cd.slice(idxActual - 1),
          type: "scatter", mode: "lines+markers",
          line: { color: "#7fb59a", width: 2.5, dash: "dot", shape: "spline", smoothing: 0.8 },
          marker: { color: ["#1f6b4a", "#7fb59a"], size: 7 }, fill: "tozeroy",
          fillcolor: "rgba(127,181,154,0.12)", hovertemplate: hoverMon }
      ];
    } else {
      traces = [{ x: x, y: yPlot, customdata: cd, type: "scatter", mode: "lines+markers",
        line: { color: "#1f6b4a", width: 2.5, shape: "spline", smoothing: 0.8 },
        marker: { color: colores, size: 7 },
        fill: "tozeroy", fillcolor: "rgba(31,107,74,0.15)", hovertemplate: hoverMon }];
    }
    Plotly.newPlot(elp, traces, {
      autosize: true, margin: { l: 54, r: 10, t: 14, b: 30 }, shapes: shapes, annotations: anns,
      showlegend: false, xaxis: { tickfont: { size: 10 } },
      yaxis: { tickfont: { size: 10 }, separatethousands: true, rangemode: "tozero" },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)"
    }, { displayModeBar: false, responsive: true }).then(function () { __cnPlotResize(elp); });
  }

  // Genera el Titular ejecutivo (IA) on-demand y lo pinta en la columna 1 (#cn-ins).
  window.__cnDesempInsight = function (entidad) {
    var host = el("cn-ins"); if (!host) return;
    var ent = __cnEsFil() ? "" : (entidad || (__cnLastIntent && (__cnLastIntent.valor || __cnLastIntent.entidad)) || "");
    var cacheKey = __cnCacheKey(ent);
    if (__cnInsCache[cacheKey]) { __cnPaintIns(host, __cnInsCache[cacheKey]); return; }   // caché → NO re-llamar al LLM
    host.innerHTML = '<div class="cn-ins__load"><span class="spinner-border spinner-border-sm"></span> ' +
      'Generando resumen ejecutivo…</div>';
    fetch("/api/analisis/desempeno_insight" + __cnSegQS(ent))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || d.encontrada === false || d.sin_datos) {
          host.innerHTML = '<div class="cn-ins__load text-muted">Sin datos para el resumen.</div>'; return;
        }
        __cnInsCache[cacheKey] = d;   // cachea el resultado del LLM para esta sesión
        __cnPaintIns(host, d);
      })
      .catch(function () { host.innerHTML = '<div class="cn-ins__load text-danger">Error generando el resumen.</div>'; });
  };

  // Pinta el Titular IA desde el payload (fetch o caché). En caché-hit no hay spinner ni llamada al LLM.
  function __cnPaintIns(host, d) {
    host.innerHTML = __cnRenderIns(d);
    if (d.anotaciones && d.curva_crudo) __cnInsCurvaPlot(d.curva_crudo, d.anotaciones);
    __cnPlotResize(el("cn-desemp-plot"));   // realinea la curva de desempeño
  }

  function __cnRenderIns(d) {
    // Chips, cabecera "Titular ejecutivo" y "Lectura ejecutiva" viven ahora en el brief ejecutivo de
    // ARRIBA (sin duplicar). Aquí conservamos SOLO lo único del insight: la curva del valle anotada
    // por la IA + la tabla de eventos que la explican.
    var ev = "";
    if (d.eventos && d.eventos.length) {
      var filas = d.eventos.map(function (e) {
        return '<tr><td class="cn-ins__ev-campo">' + esc(e.campo) + '</td><td class="cn-ins__ev-txt">' +
          esc(e.evento) + '</td><td class="cn-ins__ev-n">' + __cnMilesEC(e.pozos) + '</td></tr>';
      }).join("");
      var extra = (d.eventos_extra && d.eventos_extra.campos)
        ? '<tr class="cn-ins__ev-more"><td>+ ' + d.eventos_extra.campos + ' campos más</td><td></td><td>≈' +
          __cnMilesEC(d.eventos_extra.pozos_aprox) + '</td></tr>' : "";
      ev = '<div class="cn-ins__card cn-ins__card--ev"><div class="cn-ins__card-hd"><i class="bi bi-lightning-charge"></i> ' +
        'Por qué el valle · eventos del ' + esc((d.eventos_extra || {}).fecha || "") + '</div>' +
        '<div class="cn-ins__ev-scroll"><table class="cn-ins__ev"><tbody>' + filas + extra + '</tbody></table></div></div>';
    }
    var valle = d.anotaciones
      ? '<div class="cn-ins__card"><div class="cn-ins__card-hd"><i class="bi bi-graph-up"></i> ' +
        'Producción diaria de crudo · valle anotado por la IA</div><div id="cn-ins-plot" class="cn-ins__plot"></div></div>'
      : "";
    // Filiales: en vez de la tabla de eventos (no existe), el diagnóstico del valle por filial (IA/fallback).
    var diag = "";
    var vd = d.valle_diagnostico;
    if (vd && (vd.diagnostico || vd.recomendacion)) {   // filiales O entidad ECP con diagnóstico de valle
      var esIA = vd.generado_por === "llm";
      diag = '<div class="cn-ins__card cn-ins__card--diag"><div class="cn-ins__card-hd"><i class="bi bi-search"></i> ' +
        'Diagnóstico del valle <span class="cn-ins__diag-src">' + (esIA ? "(IA)" : "(base)") + '</span></div>' +
        '<div class="cn-ins__diag">' +
        (vd.diagnostico ? '<p class="cn-ins__diag-tx">' + esc(vd.diagnostico) + '</p>' : '') +
        (vd.recomendacion ? '<p class="cn-ins__diag-rec"><i class="bi bi-telephone-outbound"></i> ' + esc(vd.recomendacion) + '</p>' : '') +
        '</div></div>';
    }
    if (!valle && !ev && !diag) {
      return '<div class="cn-ins__load text-muted">Sin valle ni eventos operativos relevantes en el periodo.</div>';
    }
    return valle + ev + diag;
  }

  // Curva de crudo del panel IA con banda (valle) + pin (mínimo). Coordenadas = Python.
  window.__cnInsCurvaPlot = function (curva, anot) {
    var elp = el("cn-ins-plot"); if (!elp) return;
    if (!window.Plotly) { elp.innerHTML = '<div class="text-muted small p-2">(Plotly no disponible)</div>'; return; }
    var shapes = [], anns = [];
    if (anot && anot.banda) {
      shapes.push({ type: "rect", xref: "x", yref: "paper", x0: anot.banda.desde, x1: anot.banda.hasta,
        y0: 0, y1: 1, fillcolor: "#FAEEDA", opacity: 0.6, line: { width: 0 }, layer: "below" });
      anns.push({ x: anot.banda.desde, y: 1, xref: "x", yref: "paper", yanchor: "bottom",
        text: esc(anot.banda.label || "valle"), showarrow: false, font: { size: 10, color: "#BA7517" } });
    }
    if (anot && anot.punto) {
      anns.push({ x: anot.punto.fecha, y: anot.punto.valor, xref: "x", yref: "y",
        text: esc(anot.punto.label || ""), showarrow: true, arrowhead: 0, ay: 26,
        bgcolor: "#d9534f", font: { color: "#fff", size: 10 } });
    }
    Plotly.newPlot(elp, [{ x: curva.fechas, y: curva.valores, type: "scatter", mode: "lines+markers",
      line: { color: "#1f6b4a", width: 2, shape: "spline", smoothing: 0.8 }, marker: { size: 3 },
      hovertemplate: "%{x}<br>%{y:,.0f}<extra></extra>" }], {
      autosize: true, margin: { l: 52, r: 10, t: 14, b: 30 }, shapes: shapes, annotations: anns,   // sin height fijo → llena su tercio
      xaxis: { tickangle: -45, tickfont: { size: 9 } }, yaxis: { tickfont: { size: 9 }, separatethousands: true },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)"
    }, { displayModeBar: false, responsive: true }).then(function () { __cnPlotResize(elp); });
  };

  // ============================================================
  // Análisis Ejecutivo (IA) multi-sección -- sandbox tarjeta "Filiales" (badge EN PRUEBAS, H6).
  // El dato analizado es ECP GLOBAL (sin entidad); Python calcula la estructura (gap reconciliado +
  // flags), el LLM (Gemma) solo pule la prosa (pulido opcional). Caché de sesión: solo al clic,
  // nunca en carga -- no re-llama al LLM al volver a la tarjeta.
  // ============================================================
  // Log de validación en consola: ¿el brief lo generó GEMMA (servidor 139) o el composer determinista?
  // Verde = Gemma (llm) · Rojo = fallback/error. Muestra modelo + host efectivos (desde meta.llm_diag).
  function __cnLogEjec(d, fromCache) {
    try {
      var m = (d && d.meta) || {};
      var diag = m.llm_diag || {};
      var esLLM = m.generado_por === "llm";
      var fuente = esLLM ? "✅ GEMMA (LLM)"
                 : (m.generado_por === "error" ? "❌ ERROR — Gemma falló (sin fallback)"
                 : "⚠️ composer determinista (fallback)");
      console.log(
        "%c[Análisis Ejecutivo IA]%c " + (m.scope || "") + " · " + (m.periodo || "") + " · corte " + (m.corte || "") +
        (fromCache ? "  (desde caché, sin nueva petición)" : "") +
        "\n  fuente:  " + fuente +
        "\n  modelo:  " + (diag.model || "—") + "   host: " + (diag.host || "—") +
        "\n  llm_diag.status: " + (diag.status || "—"),
        "color:" + (esLLM ? "#1e9e63" : "#c0392b") + ";font-weight:bold",
        "color:inherit");
    } catch (e) {}
  }

  // Brief ejecutivo apilado ARRIBA del panel Desempeño. Entity-aware: mismo criterio de entidad que
  // /desempeno (el backend /ejecutivo ya resuelve por fuente_id + vice_id). Sin entidad → Global ECP.
  window.__cnAnalisisEjecutivo = function (entidad) {
    var host = el("cn-ejec-top"); if (!host) return;
    var esGlobal = !entidad;
    host.innerHTML =
      '<div id="cn-ejec-body" class="cn-ejec-body">' +
      '  <div class="d-flex align-items-center gap-2 p-3 text-muted small">' +
      '    <div class="spinner-border spinner-border-sm"></div> Calculando análisis ejecutivo…</div></div>';
    var key = __cnCacheKey(entidad);
    // Guard auto-sanable: un payload de FILIALES trae por_filial; el de ECP no. Si la caché quedó
    // cruzada (p.ej. una respuesta ECP servida a filiales cuando el backend estaba desactualizado),
    // se descarta y se refetchea — evita que la pestaña Filiales muestre el panorama ECP (o viceversa).
    var esFil = __cnEsFil();
    var cached = __cnEjecCache[key];
    if (cached && __cnPayloadEsFil(cached) !== esFil) { delete __cnEjecCache[key]; cached = null; }
    if (cached) { __cnLogEjec(cached, true); __cnPaintEjec(cached); return; }   // caché por segmento+entidad+nivel+periodo
    fetch("/api/analisis/ejecutivo" + __cnSegQS(entidad))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var body = el("cn-ejec-body"); if (!body) return;
        if (!d || d.encontrada === false || d.sin_datos) {
          body.innerHTML = '<div class="p-3 text-muted small">Sin datos para el análisis ejecutivo.</div>'; return;
        }
        // Si el segmento del payload no es el pedido, no lo pintamos ni cacheamos (backend desincronizado).
        if (__cnPayloadEsFil(d) !== esFil) {
          body.innerHTML = '<div class="p-3 text-muted small">El servidor devolvió un análisis de otro segmento. Recargá la página (Ctrl+Shift+R).</div>'; return;
        }
        __cnLogEjec(d, false);   // validación en consola: Gemma (139) vs fallback
        // No cachear errores de Gemma: así cada visita reintenta (útil en pruebas con fallback off).
        if ((d.meta || {}).generado_por !== "error") __cnEjecCache[key] = d;
        __cnPaintEjec(d);
      })
      .catch(function () {
        var body = el("cn-ejec-body");
        if (body) body.innerHTML = '<div class="alert alert-danger m-3">Error calculando el análisis ejecutivo.</div>';
      });
  };

  // [2026-08-26] Precarga en PARALELO las 3 secciones lazy de cada foco (Diferidas/Mantenimientos/
  // EBITDA-NOPAT) apenas se pinta la tarjeta, en vez de esperar a que el usuario haga clic en su
  // pestaña. Antes, el fetch de cada sección arrancaba RECIÉN al hacer clic (__cnFocoTab/
  // __cnFilialToggle), así que el usuario siempre veía "Cargando…" al abrirla, sin importar
  // cuánto llevara el panel abierto. Reusa el MISMO patrón (data-loaded + __cnDifCache/
  // __cnManttoCache/etc. por ámbito, ver __cnDiferidasInto): el clic real ya no encuentra
  // data-loaded="0" y no vuelve a disparar el fetch, solo repinta desde caché si ya llegó.
  // Costo aceptado: 3 fetches de más por foco aunque el usuario nunca abra esas pestañas — son
  // pocos focos por tablero (no cientos), y los 3 endpoints ya eran ligeros de por sí.
  function __cnPrecargarFocosLazy(root) {
    if (!root) return;
    root.querySelectorAll(".cn-dif[data-loaded='0']").forEach(function (h) {
      h.dataset.loaded = "1"; try { __cnDiferidasInto(h); } catch (e) {}
    });
    root.querySelectorAll(".cn-mtto[data-loaded='0']").forEach(function (h) {
      h.dataset.loaded = "1"; try { __cnManttoInto(h); } catch (e) {}
    });
    root.querySelectorAll(".cn-wf[data-loaded='0']").forEach(function (h) {
      h.dataset.loaded = "1"; try { __cnEbitdaInto(h); } catch (e) {}
    });
  }

  function __cnPaintEjec(d) {
    if (!__cnPanelEntidad && !__cnEsFil()) __cnSaludoDesdeEjec(d);   // E2: solo el panel GLOBAL
    var body = el("cn-ejec-body"); if (!body) return;
    body.innerHTML = __cnRenderEjecutivo(d);   // fija __cnEjecD (con los focos)
    if ((d.meta || {}).generado_por !== "error") __cnEjecCharts(d);
    __cnPaintComportIzq();   // el gráfico izquierdo de comportamiento sigue al foco #1 (si el bloque está montado)
    __cnPrecargarFocosLazy(body);   // Diferidas/Mantenimientos/EBITDA de cada foco, en paralelo
    // [2026-07-27] llena el encabezado P50 (async, ECP global) — opción A.
    // [2026-07-29] En drill-down a una entidad el encabezado no se pinta, así que se evita el fetch.
    if (!__cnEsFil() && !__cnPanelEntidad) __cnPaintP50Header();
  }

  // Nivel 1: tarjetas KPI de cierre (barra + proyectado/meta + microcopy), 1 por producto.
  // proyectado_cierre/meta_mes ya vienen calculados del backend (ejecutivo() -> _tarjetas_kpi):
  // esta función SOLO formatea y pinta, 0 recálculo.
  // Formato COMPACTO ADAPTATIVO (90,1M · 3,7M · 496k) por decisión del usuario (2026-07-21) para
  // las 3 tarjetas grandes; las cifras <1000 caen a dígitos exactos (__cnMilesEC) para NO
  // reintroducir el "0,0 M" que este panel ya revirtió dos veces. Los gráficos por campo (Sustento)
  // siguen exactos con __ejFmtVal.
  function __cnFmtKpi(n) {
    var v = Math.abs(Number(n) || 0);
    if (v >= 1e6) return (v / 1e6).toFixed(1).replace(".", ",") + "M";
    if (v >= 1e3) return Math.round(v / 1e3) + "k";
    return __cnMilesEC(v);
  }
  function __cnFmtBopd(n) {   // BOPD (tasa diaria de crudo): 2 decimales en millones
    var v = Math.abs(Number(n) || 0);
    if (v >= 1e6) return (v / 1e6).toFixed(2).replace(".", ",") + "M";
    return __cnMilesEC(v);
  }
  // GAS en MSCF = millones de pies cúbicos estándar: el volumen crudo de la BD se divide entre 1e6.
  // (CRUDO/BLANCOS siguen en bbl con su formato normal.) Sin esto la diaria "82.951 MSCF/día" quedaba
  // por encima de la mensual "3,3M MSCF" — misma unidad, escalas distintas. Con ÷1e6: 0,08 vs 3,3.
  function __cnGasM(v, dec) {
    var m = (Number(v) || 0) / 1e6, a = Math.abs(m);
    var d = (dec != null) ? dec : (a >= 1 ? 1 : 2);   // 3,3 · 72,3 · 0,08 (default 1 decimal ≥1)
    return m.toFixed(d).replace(".", ",");
  }
  var __cnKpiLabel = { alineado: "alineado", ajustado: "ajustado", actuar: "actuar" };

  // ===== [2026-07-24] Rediseño A+C · Fase 1: anillo de % cumplimiento + estado color-codeado =====
  // Tokens y labels tomados de anal.md §4 (status.ts). El color/soft se inyecta por --cp-st/--cp-st-soft.
  var __CP_STATUS = {
    ok:       { label: "En meta",    color: "#1E9E5A", soft: "#E9F3EC", icon: "check-circle-fill" },
    ajustado: { label: "Ajustado",   color: "#E8912B", soft: "#FBF1E4", icon: "exclamation-triangle-fill" },
    actuar:   { label: "Actuar",     color: "#C5311E", soft: "#FBECEA", icon: "exclamation-octagon-fill" },
    bajo:     { label: "Por debajo", color: "#C5311E", soft: "#FBECEA", icon: "arrow-down-circle-fill" },
    neutral:  { label: "",           color: "#98A69E", soft: "#F1F4F1", icon: "" }
  };
  // [2026-08-11] Identidad de color por PRODUCTO (no confundir con __CP_STATUS, que es por
  // ESTADO/cumplimiento — ambas paletas conviven, cada una en su rol). `color` = relleno (series,
  // filete, punto del badge); `texto` = SOLO texto sobre blanco (contraste WCAG recalculado: Gas
  // #EF4444 da 3.76 sobre blanco, bajo el umbral 4.5, así que su texto usa #B91C1C; Blancos usa el
  // ámbar oscurecido de la spec); `soft` = fondo del badge (mismo patrón que .cn-kpi__badge).
  var __CP_PROD = { CRUDO:   { icon: "droplet-fill",   color: "#004236", texto: "#004236", soft: "#E6EFEC" },
                    GAS:     { icon: "fire",           color: "#EF4444", texto: "#B91C1C", soft: "#FDECEC" },
                    BLANCOS: { icon: "fuel-pump-fill", color: "#EAB308", texto: "#A65E08", soft: "#FBF3DC" } };
  // El producto llega en DOS convenciones distintas según el origen: "GAS" (análisis v1) o "gas"
  // (paneles del Motor Q v2, p.ej. __cnCuantCardHtml). __CP_PROD tiene claves en MAYÚSCULAS →
  // __CP_PROD["gas"] da undefined y la tarjeta cae al fallback gris SIN lanzar error. Por eso NINGÚN
  // sitio debe indexar __CP_PROD directamente: siempre por este accessor, que normaliza el caso y
  // conserva el fallback ya existente (icono circle, gris neutro).
  function __cnProdId(p) { return __CP_PROD[String(p || "").toUpperCase()] || null; }
  function __cnProdCol(p) { return (__cnProdId(p) || { color: "#6E7C75" }).color; }
  // hex ("#RRGGBB") -> "r,g,b" para construir rgba() de relleno semitransparente por producto.
  function __cnHexRgb(hex) {
    var h = String(hex || "").replace("#", "");
    // Valida que sean 6 dígitos HEX, no solo 6 caracteres: con "basura" parseInt daba NaN y salía
    // un rgba() inválido que Plotly descarta → la curva se quedaba sin relleno, en silencio.
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return "31,107,74";   // fallback: verde previo de __cnDailyPlot
    return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }).join(",");
  }
  // [2026-07-24] Fase 2 · las 3 pills temáticas del foco (master-detail). Iconos anal.md §8.2.
  var __CP_TABS = [
    { key: "comport", icon: "graph-up",        titulo: "Comportamiento diario", sub: "" },
    { key: "dif",     icon: "droplet-half",    titulo: "Diferidas",             sub: "frecuencia histórica" },
    { key: "mantto",  icon: "tools",           titulo: "Mantenimientos",        sub: "servicio a pozo" },
    { key: "ebitda",  icon: "bar-chart-steps", titulo: "EBITDA-NOPAT",          sub: "económico · crudo" }
  ];
  // [2026-08-13] Mantenimientos: conectado a Eventos_OW.xlsx (ruta nativa /api/mantenimientos/eventos,
  // mismo patrón lazy que Diferidas). __cnManttoInto/__cnManttoRender están junto a __cnDiferidasInto.
  var __CN_MESES_NUM = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7,
                         agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12 };
  // meta.periodo llega como "Mayo 2026" (MESES_ES del backend), NO ISO -> "2026-05".
  // "" si no se puede derivar: el backend cae entonces al mes más reciente con eventos.
  function __cnPeriodoISO(p) {
    var partes = String(p || "").trim().split(/\s+/);
    if (partes.length !== 2) return "";
    var m = __CN_MESES_NUM[partes[0].toLowerCase()];
    if (!m || !/^\d{4}$/.test(partes[1])) return "";
    return partes[1] + "-" + (m < 10 ? "0" + m : m);
  }

  // [Hallazgo E] Estado = el `estado` que YA calculó el backend con la banda ámbar (≥93% ajustado).
  // NO derivar de "may<hist" (marcaría un 94% ajustado como rojo). En la rama sin ritmo diario
  // (Blancos/filiales) el "actuar" se rotula "Por debajo" (bajo); en Crudo/Gas se rotula "Actuar".
  // "" = producto sin meta comparable → neutral (anillo gris, sin chip).
  function __cnKpiStatus(k) {
    var e = k.estado;
    if (e === "alineado") return "ok";
    if (e === "ajustado") return "ajustado";
    if (e === "actuar")   return (k.bopd && k.bopd.requerido) ? "actuar" : "bajo";
    return "neutral";
  }

  // Anillo SVG 66x66 (anal.md §7): track gris + arco de color, linecap round, rotado -90°, % al centro.
  // [Hallazgo H] El ARCO topa en 100% (no desborda); el TEXTO muestra el % REAL (p. ej. 108%) — no
  // oculta el sobre-cumplimiento.
  // [2026-07-29] `size` y `label` son OPCIONALES: sin ellos el anillo sale idéntico al de siempre
  // (66px, sólo el %) → las tarjetas KPI del foco no cambian. La tarjeta P50 del encabezado los usa
  // para el anillo grande con rótulo "REAL / P50" del mockup (artifact c14c7dc8).
  function __cnRing(pct, color, size, label, dec) {
    var num = (pct == null ? 0 : Number(pct));
    // dec=0 (default) redondea como siempre -> las tarjetas del foco no cambian ni un píxel.
    // La tarjeta P50 pide dec=1 porque el mockup muestra "96,8%", no "97%" (cerca de umbral importa).
    var raw = dec ? num : Math.round(num);
    var arc = Math.max(0, Math.min(100, raw)), txt = Math.max(0, raw);
    var txtStr = dec ? txt.toFixed(dec).replace(".", ",") : String(txt);
    size = size || 66;
    var r = (size - 8) / 2, c = 2 * Math.PI * r, cx = size / 2;
    var sw = size >= 90 ? 8 : 7, fs = size >= 90 ? 21 : 16;
    var dash = (c * arc / 100).toFixed(1) + " " + c.toFixed(1);
    return '<svg class="cp-mes__ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" ' +
      'role="img" aria-label="Cumplimiento ' + txtStr + '%">' +
      '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="#E4E9E5" stroke-width="' + sw + '"/>' +
      '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + sw + '" ' +
      'stroke-linecap="round" stroke-dasharray="' + dash + '" transform="rotate(-90 ' + cx + ' ' + cx + ')"/>' +
      '<text x="' + cx + '" y="' + (label ? cx - 6 : cx) + '" text-anchor="middle" dominant-baseline="central" ' +
      'font-size="' + fs + '" font-weight="800" fill="#17241E">' + txtStr + '%</text>' +
      (label ? '<text x="' + cx + '" y="' + (cx + 13) + '" text-anchor="middle" dominant-baseline="central" ' +
               'font-size="8" font-weight="700" letter-spacing="0.9" fill="#98A69E">' + label + '</text>' : '') +
      '</svg>';
  }

  function __cnTarjetasKpiHtml(tarjetas, periodo) {
    if (!tarjetas || !tarjetas.length) return "";
    var mesWord = periodo ? String(periodo).split(" ")[0] : "el mes";
    var yearWord = (periodo && String(periodo).split(" ")[1]) ? String(periodo).split(" ")[1] : "el año";
    return tarjetas.map(function (k) {
      var esGas = k.producto === "GAS";
      var fmtV = esGas ? __cnGasM : __cnFmtKpi;                          // volumen mensual
      var fmtR = esGas ? function (v) { return __cnGasM(v, 2); } : __cnFmtBopd;  // ritmo diario
      var unidad = k.unidad ? (" " + esc(k.unidad) + "/mes") : "";
      var nombre = k.producto.charAt(0).toUpperCase() + k.producto.slice(1).toLowerCase();
      var prodI = __cnProdId(k.producto);   // identidad de producto — SIEMPRE por el accessor (H5)
      var prodIcon = (prodI || {}).icon || "circle";
      var prodCol = (prodI || {}).color || "#6E7C75", prodSoft = (prodI || {}).soft || "#F1F4F1";
      var statusKey = __cnKpiStatus(k), S = __CP_STATUS[statusKey] || __CP_STATUS.neutral;   // [Hallazgo E]

      // --- anillo + fila superior según la rama de datos (NO se cambia el significado del número) ---
      var ringPct, figLbl, figVal, pptoLbl, pptoVal;
      if (k.bopd && k.bopd.requerido) {                     // CRUDO / GAS: ritmo diario real vs PPTO
        ringPct = Math.round(k.bopd.real / k.bopd.requerido * 100);
        var duni = k.unidad === "bbl" ? "BOPD" : (k.unidad === "MSCF" ? "MSCFD" : (k.unidad ? k.unidad + "/d" : "/d"));
        figLbl = "Producción actual diaria";
        figVal = fmtR(k.bopd.real) + ' <span class="cp-mes__kpi-unit">' + duni + '</span>';
        pptoLbl = "PPTO"; pptoVal = fmtR(k.bopd.requerido);
      } else {                                              // BLANCOS / filiales: mes vs promedio del año
        var hist = k.hist_prom || 0, may = k.proyectado_cierre || 0;
        ringPct = hist ? Math.round(may / hist * 100) : (k.meta_mes ? Math.round(may / k.meta_mes * 100) : 0);
        figLbl = "Producción de " + esc(mesWord);
        figVal = fmtV(may) + ' <span class="cp-mes__kpi-unit">' + esc(k.unidad || "") + '/mes</span>';
        pptoLbl = "Promedio " + esc(yearWord); pptoVal = hist ? fmtV(hist) : "—";
      }

      // --- proyección de cierre + microcopy de gap ---
      var proyPct = Math.max(0, Math.min(100, Math.round(k.relleno_pct == null ? 0 : k.relleno_pct)));
      var proyTxt = k.meta_mes
        ? (fmtV(k.proyectado_cierre) + " / " + fmtV(k.meta_mes) + unidad)
        : (fmtV(k.proyectado_cierre) + unidad + " · sin meta");
      var closeMicro = !k.meta_mes
        ? "Sin meta definida para " + esc(nombre.toLowerCase()) + "."
        : (k.alcanza
            ? 'Cerraría <span class="cp-mes__kpi-gap">' + fmtV(k.proyectado_cierre - k.meta_mes) + unidad + '</span> por encima de la meta.'
            : 'Cerraría <span class="cp-mes__kpi-gap">' + fmtV(k.brecha_abs) + unidad + '</span> por debajo de la meta.');
      var chip = statusKey === "neutral" ? ""
        : '<span class="cp-mes__kpi-badge"><i class="bi bi-' + S.icon + '"></i> ' + S.label + '</span>';

      return '<div class="cp-mes__kpi cp-mes__kpi--prod cp-mes__kpi--' + statusKey +
          '" style="--cp-st:' + S.color + ';--cp-st-soft:' + S.soft +
          ';--cp-prod:' + prodCol + ';--cp-prod-soft:' + prodSoft + '">' +
        '<div class="cp-mes__kpi-hd">' +
          '<span class="cp-mes__kpi-chip"><i class="bi bi-' + prodIcon + '"></i></span>' +
          '<span class="cp-mes__kpi-name">' + esc(nombre) + '</span>' + chip +
        '</div>' +
        '<div class="cp-mes__kpi-mid">' + __cnRing(ringPct, S.color) +
          '<div class="cp-mes__kpi-fig">' +
            '<div class="cp-mes__kpi-figlbl">' + figLbl + '</div>' +
            '<div class="cp-mes__kpi-figval">' + figVal + '</div>' +
            '<div class="cp-mes__kpi-ppto">' + pptoLbl + ' <b>' + pptoVal + '</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="cp-mes__kpi-sep"></div>' +
        '<div class="cp-mes__kpi-proyhd"><span>Proyección de cierre</span>' +
          '<span class="cp-mes__kpi-proyval">' + proyTxt + '</span></div>' +
        '<div class="cp-mes__meter"><span style="width:' + proyPct + '%;background:' + S.color + '"></span></div>' +
        '<div class="cp-mes__kpi-close">' + closeMicro + '</div>' +
        '</div>';
    }).join("");
  }

  // ===== [2026-07-27] Épica 2 · Encabezado = compromiso corporativo P50 (hoja REPORTE_PRESIDENT) =====
  // Decisión del usuario (opción A): el ENCABEZADO del análisis muestra el cumplimiento vs P50 (escala
  // kbpe corporativa, "scorecard del presidente"); las tarjetas operativas de HOY (BOPD vs PPTO) BAJAN a
  // cada "Comportamiento diario" (por foco). Son 2 referencias DISTINTAS, rotuladas → no se contradicen.
  // Solo ECP (el president es ECP global); en filiales el encabezado queda como estaba. Datos: endpoint
  // /api/analisis/president (agnóstico a la referencia; aquí se usa cumpl vs P50). Reusa cp-mes__kpi.
  function __cnKbpe(n) { return (Number(n) || 0).toFixed(1).replace(".", ","); }
  // El endpoint puede traer medidas en NULL (el bloque DÍA llega en #REF! en algunos reportes y
  // num() lo descarta) → se declara con "—" en vez de pintar un 0,0 que no es el dato.
  function __cnKb(v) { return (v == null) ? "—" : __cnKbpe(v); }

  // [2026-07-29] Estructura fiel al mockup «Épica 2 · Card P50 por producto» (artifact c14c7dc8):
  // anillo grande centrado (Real/P50) + Real del mes + 5 filas (eran 6: "Base P50" se retiró el
  // 2026-08-31). Compromiso lleva la marca ◆ dorada; el Gap es fila numérica y su color va
  // por SIGNO, no por el semáforo de la tarjeta (en el mockup CRUDO está "En meta" y su gap es rojo).
  // Reusa el contenedor .cp-mes__kpi y su header; el cuerpo son clases .cp-p50__*.
  function __cnP50CardHtml(p) {
    var nombre = String(p.entidad || "");
    var PROD = nombre.toUpperCase();
    var cumpl = (p.cumpl_p50 != null) ? p.cumpl_p50 : 0;
    var prodI = __cnProdId(PROD);   // identidad de producto — SIEMPRE por el accessor (H5)
    var prodIcon = (prodI || {}).icon || "circle";
    var prodCol = (prodI || {}).color || "#6E7C75", prodSoft = (prodI || {}).soft || "#F1F4F1";
    var real = p.real_mes, p50 = p.base_p50;
    var gap = (real != null && p50 != null) ? (real - p50) : null;
    // [2026-07-29] El verde exige gap >= 0 (el real ALCANZA el P50), no un % "cerca de 100".
    // El umbral anterior (>=90 -> ok) pintaba "En meta" con 96,8% y gap -16,6: verde y en deficit
    // a la vez. Se deriva del GAP CRUDO y no del % redondeado para que no quede margen: 99,996%
    // redondea a 100,0 pero su gap es negativo. Banda ambar >=93%, la misma que usan las tarjetas
    // del foco (_estado_cierre del backend, meta*0.93). Sin dato -> neutral, no rojo.
    var statusKey = (gap == null) ? "neutral"
                  : (gap >= 0 ? "ok" : (cumpl >= 93 ? "ajustado" : "actuar"));
    var S = __CP_STATUS[statusKey] || __CP_STATUS.neutral;
    var gapCls = gap == null ? "" : (gap >= 0 ? " cp-p50__v--pos" : " cp-p50__v--neg");
    var gapTxt = gap == null ? "—" : (gap >= 0 ? "+" : "−") + __cnKbpe(Math.abs(gap));
    var compLbl = p.compromiso_difiere ? "Compromiso (Reto)" : "Compromiso = P50";

    function fila(k, v, marca) {
      return '<div class="cp-p50__r"><span class="cp-p50__k">' +
        (marca ? '<i class="cp-p50__mk"></i>' : "") + k + '</span>' +
        '<span class="cp-p50__v">' + v + '</span></div>';
    }

    return '<div class="cp-mes__kpi cp-p50 cp-mes__kpi--prod cp-mes__kpi--' + statusKey +
        '" style="--cp-st:' + S.color + ';--cp-st-soft:' + S.soft +
        ';--cp-prod:' + prodCol + ';--cp-prod-soft:' + prodSoft + '">' +
      '<div class="cp-mes__kpi-hd">' +
        '<span class="cp-mes__kpi-chip"><i class="bi bi-' + prodIcon + '"></i></span>' +
        '<span class="cp-mes__kpi-name">' + esc(nombre) + '</span>' +
        // Sin dato no se inventa un estado: neutral no tiene label y no se pinta badge.
        (S.label ? '<span class="cp-mes__kpi-badge"><i class="bi bi-' + S.icon + '"></i> ' + S.label + '</span>' : '') +
      '</div>' +
      '<div class="cp-p50__ring">' + __cnRing(cumpl, S.color, 96, "REAL / P50", 1) + '</div>' +
      '<div class="cp-p50__real">' +
        '<div class="cp-p50__realval">' + __cnKb(real) + ' <span class="cp-mes__kpi-unit">kbpe</span></div>' +
        '<div class="cp-p50__reallbl">Real del mes</div>' +
      '</div>' +
      '<div class="cp-p50__rows">' +
        // [2026-08-31] Fila "Base P50" retirada a pedido: su valor ya está representado en el
        // anillo (Real/P50) y en el Gap vs P50. La variable p50 sigue en uso para ambos.
        fila(compLbl, __cnKb(p.compromiso), true) +
        fila("Proyección cierre", __cnKb(p.proy_mes)) +
        fila("Programa día", __cnKb(p.programa_dia)) +
        fila("Real día", __cnKb(p.real_dia)) +
        '<div class="cp-p50__r cp-p50__r--gap"><span class="cp-p50__k">Gap vs P50</span>' +
          '<span class="cp-p50__v' + gapCls + '">' + gapTxt + '</span></div>' +
      '</div>' +
      '</div>';
  }

  // ===== [2026-08-02] Cuantificar (Motor Q v2, Fase 1 · sub-fase 1d) — panel derecho de la burbuja =====
  // Doble entregable: la MISMA cifra que la burbuja del chat, ahora como tarjeta KPI en el visor.
  // Reusa el contenedor .cp-mes__kpi + anillo __cnRing + clases .cp-p50__* de __cnP50CardHtml (HD2:
  // NO se reusa __cnP50CardHtml en sí — esa está clavada al P50/kbpe; esta es Real-vs-PPTO en bbl).
  function __cnCuantCardHtml(dat) {
    var estado = dat.estado || "";
    var col = (estado === "Alineado") ? "#1E9E5A" : (estado === "Rezagado") ? "#E8912B"
            : (estado === "Foco") ? "#D64545" : "#6B7A74";
    var pct = (dat.cumplimiento_pct != null) ? dat.cumplimiento_pct : 0;
    var unidad = dat.unidad || "bbl";
    // Fase 4: la referencia puede no ser PPTO (operativo/contable/promedio) — etiqueta dinámica.
    var refLbl = dat.referencia_label
      ? (dat.referencia_label.charAt(0).toUpperCase() + dat.referencia_label.slice(1)) : "Presupuesto";
    var refCorta = ({ PPTO: "PPTO", OPERATIVO: "OPER", CONTABLE: "CONT", promedio_anio: "PROM" })[dat.referencia] || "PPTO";
    // Fase 2: GAS se muestra en MSCF (÷1e6, mirror del panel __cnGasM); CRUDO/BLANCOS raw + bbl.
    var esGas = (dat.producto === "gas");
    var fmtV = esGas ? function (v) { return __cnGasM(v); }
                     : function (v) { return __cnMilesEC(Math.round(v)); };
    // HE6: N1 (un mes) vs N2 (acumulado) tienen etiqueta y corte propios — sin `mes` sintético.
    var realLbl, corte;
    if (dat.nivel === "N2") {
      realLbl = "Acumulado " + (dat.periodo_label || "");
      corte = (dat.meses_cerrados || 0) + " mes" + ((dat.meses_cerrados === 1) ? "" : "es") + " cerrado" + ((dat.meses_cerrados === 1) ? "" : "s");
    } else {
      var mes = dat.mes || {};
      realLbl = "Producción " + (mes.nombre || "") + " " + (mes.anio || "");
      // [2026-09-03 · MES-CERRADO] Se rotula por `cerrado`, no por `completo`. `completo` mide
      // la cobertura del reporte DIARIO: un mes ya cerrado con huecos en el diario (medido:
      // CASTILLA mayo 2026, 17/31 días) salía como «proyección · 17/31 días», llamando
      // provisional a una cifra definitiva. El `!= null` conserva el comportamiento si el
      // backend aún no manda el campo (despliegues a medias).
      var _cerrado = (mes.cerrado != null) ? mes.cerrado : mes.completo;
      corte = _cerrado ? "mes cerrado"
            : ("proyección · " + (mes.dias_con_data || 0) + "/" + (mes.dias_del_mes || 0) + " días");
    }
    var avisos = (dat.avisos || []).map(function (a) {
      return '<div class="cp-p50__r"><span class="cp-p50__k">⚠️ ' + esc(a) + '</span></div>';
    }).join("");
    return '<div class="cp-mes__kpi cp-p50" style="--cp-st:' + col + ';--cp-st-soft:' + col + '22">' +
      '<div class="cp-mes__kpi-hd">' +
        '<span class="cp-mes__kpi-chip"><i class="bi bi-calculator"></i></span>' +
        '<span class="cp-mes__kpi-name">' + esc(dat.entidad_cualificada || "") + '</span>' +
        (estado ? '<span class="cp-mes__kpi-badge">' + esc(estado) + '</span>' : '') +
      '</div>' +
      '<div class="cp-p50__ring">' + __cnRing(pct, col, 96, "REAL / " + refCorta, 1) + '</div>' +
      '<div class="cp-p50__real">' +
        '<div class="cp-p50__realval">' + fmtV(dat.real) + ' <span class="cp-mes__kpi-unit">' + unidad + '</span></div>' +
        '<div class="cp-p50__reallbl">' + esc(realLbl) + '</div>' +
      '</div>' +
      '<div class="cp-p50__rows">' +
        '<div class="cp-p50__r"><span class="cp-p50__k">' + esc(refLbl) + '</span><span class="cp-p50__v">' + fmtV(dat.ppto) + ' ' + unidad + '</span></div>' +
        '<div class="cp-p50__r"><span class="cp-p50__k">Corte</span><span class="cp-p50__v">' + corte + '</span></div>' +
        avisos +
      '</div>' +
    '</div>';
  }

  // [2026-08-25] Grano DÍA (plan QV2-GRANO-DIA). Tarjeta PROPIA — NO reusa __cnCuantCardHtml: a
  // grano día no existe PPTO (core.fact_produccion_dia_ecp no tiene escenario_id), así que no hay
  // anillo de cumplimiento ni fila de presupuesto. Reusa las clases .cp-mes__kpi/.cp-p50__* ya
  // existentes (mismo sistema de diseño §16: espaciado, tipografía, tabular-nums) — sin CSS nuevo.
  function __cnCuantDiaHtml(dat) {
    var unidad = dat.unidad || "bbl";
    var esGas = (dat.producto === "gas");
    var fmtV = esGas ? function (v) { return __cnGasM(v); }
                     : function (v) { return __cnMilesEC(Math.round(v)); };
    var esSel = (dat.nivel === "N1DSEL");
    var realLbl = esSel
      ? (((dat.orden === "min") ? "Peor" : "Mejor") + " día · " + (dat.mes_label || ""))
      : ("Producción · " + (dat.fecha_label || ""));
    var filas = "";
    if (esSel) {
      filas += '<div class="cp-p50__r"><span class="cp-p50__k">Fecha</span><span class="cp-p50__v">' +
        esc(dat.fecha_label || "") + '</span></div>';
      filas += '<div class="cp-p50__r"><span class="cp-p50__k">Días con reporte</span><span class="cp-p50__v">' +
        (dat.dias_con_dato || 0) + '</span></div>';
      if (dat.rango && dat.rango.length === 2) {
        filas += '<div class="cp-p50__r"><span class="cp-p50__k">Rango con dato</span><span class="cp-p50__v">' +
          esc(dat.rango[0]) + ' → ' + esc(dat.rango[1]) + '</span></div>';
      }
    }
    var avisos = (dat.avisos || []).map(function (a) {
      return '<div class="cp-p50__r"><span class="cp-p50__k">⚠️ ' + esc(a) + '</span></div>';
    }).join("");
    return '<div class="cp-mes__kpi cp-p50" style="--cp-st:#004236;--cp-st-soft:#00423622">' +
      '<div class="cp-mes__kpi-hd">' +
        '<span class="cp-mes__kpi-chip"><i class="bi bi-calendar-event"></i></span>' +
        '<span class="cp-mes__kpi-name">' + esc(dat.entidad_cualificada || "") + '</span>' +
      '</div>' +
      '<div class="cp-p50__real">' +
        '<div class="cp-p50__realval">' + fmtV(dat.valor) + ' <span class="cp-mes__kpi-unit">' + unidad + '</span></div>' +
        '<div class="cp-p50__reallbl">' + esc(realLbl) + '</div>' +
      '</div>' +
      (filas || avisos ? '<div class="cp-p50__rows">' + filas + avisos + '</div>' : '') +
    '</div>';
  }

  // [2026-08-25] QV2-PANEL-DIA · panel «Comportamiento {Producto}» para las preguntas de grano día.
  // Modelado sobre la rama ECP de __cnFocosHtml (:4004) pero SIN cabecera, SIN pills, SIN rank
  // visible y SIN gap por campo: solo gauge + curva. __cnFocosHtml queda BYTE-IDÉNTICA.
  // 🔑 `is-active` obligatorio: .cp-foco__panel es display:none y aquí no hay pestañas (A-2).
  // 🔑 El patrón de ID `cn-foco-day-{rank}{sufijo}` se CONSERVA aunque el rank no se muestre: es el
  // contrato con __cnPaintFocoStk y con la cola data-pend-paint de acordeon.js (A-9).
  function __cnCompProdHtml(focos, meta, tarjetas, sufijo) {
    focos = (focos || []).filter(function (f) { return !f.sin_produccion; });
    tarjetas = tarjetas || [];
    sufijo = sufijo || "";
    if (!focos.length)
      return '<div class="p-2 text-muted small">Sin datos de comportamiento para este producto.</div>';
    meta = meta || {};
    return focos.map(function (f) {
      var prod = f.producto || "";
      var pI = __cnProdId(prod) || { color: "#6E7C75", soft: "#F1F4F1" };
      var tarProd = tarjetas.filter(function (t) { return t.producto === prod; });
      var kpi = tarProd.length
        ? '<div class="cp-foco__kpicol"><div class="cn-kpi__row cn-kpi__row--solo">' +
            __cnTarjetasKpiHtml(tarProd, meta.periodo) + '</div></div>'
        : "";
      var gridCls = "cn-compprod__grid" + (tarProd.length ? "" : " cn-compprod__grid--solo");
      return '<div class="cp-foco" style="--cp-prod:' + pI.color + ';--cp-prod-soft:' + pI.soft + '">' +
        '<div class="cp-foco__panel is-active">' +
          '<div class="' + gridCls + '">' + kpi +
            '<div id="cn-foco-day-' + f.rank + sufijo + '" class="cn-ins"></div>' +
          '</div>' +
        '</div></div>';
    }).join("");
  }

  // Placeholder PROPIO (no se reusa __cnAnzPlaceholderHtml): lleva [data-prod] para que el
  // dispatcher (:3069) le ponga el filete y el badge de producto al bloque. Se puede hacer aquí
  // —y no en analiza_foco— porque este panel muestra SIEMPRE un solo producto (A-7).
  function __cnCompProdPlaceholderHtml(prod) {
    return '<div data-prod="' + esc(prod || "") + '" ' +
      'class="d-flex align-items-center gap-2 p-2 text-muted small">' +
      '<div class="spinner-border spinner-border-sm"></div> Cargando el comportamiento del producto…</div>';
  }

  // [2026-08-11] Pila acumulativa: cada pregunta del Motor Q v2 con panel se APILA en #cn-stack
  // (hermana de #cn-canvas dentro de .cn-shell) en vez de reemplazar el visor. #cn-canvas nunca se
  // destruye → el riel (#cn-rail) sigue vivo y clicable, que es la vía de vuelta al análisis
  // ("Desempeño del mes"). Ya NO es transitorio (ver saveConsultaStackDOM / renderViewer).
  // Devuelve el destino donde apilar. Si el visor de Consulta NO está montado (el usuario preguntó y
  // se fue a otra pestaña antes de que respondiera el fetch), devuelve el DocumentFragment del cache:
  // el bloque se encola fuera de pantalla y renderViewer lo restaura al volver — antes se descartaba
  // en silencio y la pregunta quedaba respondida en el chat pero sin su panel.
  function __cnStackEnsure() {
    if (!state.mounted) return null;   // shell cerrado ("Volver"): la respuesta en vuelo se descarta
    var shell = document.querySelector("#cn-viewer-area .cn-shell");
    if (!shell) {
      if (!state.consultaStackCache) state.consultaStackCache = document.createDocumentFragment();
      __cnStackOn = true;   // al volver a Consulta debe abrir en modo pila, no en el análisis
      return state.consultaStackCache;
    }
    var stack = el("cn-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "cn-stack";
      stack.id = "cn-stack";
      shell.appendChild(stack);
    }
    // [2026-08-24] La guía de arranque ocupa este mismo sitio mientras no hay paneles. Llega
    // el primero → cede el espacio. Vuelve sola al repintarse el panorama ("Nueva conversación").
    var guia = stack.querySelector(".cn-guia");
    if (guia) guia.remove();
    __cnStackOn = true;
    return stack;
  }

  function __cnStackHora() {
    var d = new Date();
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  // rAF: deja que el layout del bloque recién insertado se calcule antes de medir. Se usa scrollTop
  // sobre el propio contenedor (no scrollIntoView, que sube por los ancestros y puede desplazar todo
  // el shell).
  // [2026-08-21] Al FONDO del scroller, no al tope del bloque nuevo (petición explícita del usuario,
  // repetida corrigiendo un primer pedido de "arriba" a "abajo"): bloques con varias tarjetas/gráficos
  // (p.ej. un panel con 3 productos) son más altos que el viewport, y alinear solo su tope dejaba la
  // mitad de abajo fuera de vista sin que hubiera forma de notarlo. El bloque nuevo SIEMPRE es el
  // último hijo de #cn-stack (stack.appendChild más abajo, nunca se inserta en medio de la pila), así
  // que el fondo del scroller ES el fondo del bloque nuevo — no hace falta medir blk, solo el
  // contenedor. Sin animación de entrada en .cn-stk (verificado en colapsable.css) que siga creciendo
  // después del rAF, así que una sola medición basta, igual que la versión anterior.
  // [2026-08-11] El scroller es .cn-col (envuelve análisis + pila), NO #cn-stack: seguir apuntando a
  // la pila dejaba el bloque nuevo fuera de vista sin error visible.
  // [2026-08-24] El scroller ya NO se asume: se BUSCA subiendo desde el bloque. Motivo: en MainChat
  // acordeon.js mueve #rb-cp-viewer dentro de #mc-insights-cuerpo (acordeon.js:104), y ES ESE
  // contenedor el que desborda — .cn-col deja de ser el scroller efectivo. El shell scrolleaba
  // .cn-col mientras el usuario veía quieto el de MainChat: el panel se quedaba arriba tras cada
  // respuesta. Buscar el ancestro real sirve a los DOS montajes sin ramificar por host.
  // [2026-08-24] Traza de diagnóstico del scroll de Insights. APAGADA por defecto: se enciende
  // desde la consola con  window.__CN_SCROLL_DEBUG = true  y se recarga la pregunta. Sirve para
  // ver EN EL DOM REAL qué ancestro se eligió y si el scrollTop se movió — tres intentos a ciegas
  // fallaron porque el DOM de prueba no era el de MainChat.
  function __cnScrollLog(msg, datos) {
    if (!window.__CN_SCROLL_DEBUG) return;
    try { console.log("[cn-scroll] " + msg, datos || ""); } catch (e) {}
  }
  // Cadena de ancestros con su overflow y si desbordan — el mapa que hace falta para saber quién
  // scrollea de verdad en este montaje.
  function __cnCadenaScroll(nodo) {
    var out = [];
    for (var n = nodo.parentNode; n && n.nodeType === 1 && n !== document.body; n = n.parentNode) {
      var cs = getComputedStyle(n);
      out.push((n.id || n.className || n.tagName) + " ov=" + cs.overflowY +
               " sh=" + n.scrollHeight + " ch=" + n.clientHeight +
               (n.scrollHeight > n.clientHeight + 1 ? " DESBORDA" : ""));
    }
    return out;
  }

  // [2026-08-24 · 3ª pasada] Dos correcciones sobre la versión anterior, ambas por el mismo motivo:
  // el ancestro se buscaba DEMASIADO PRONTO y con un criterio que aún no se cumplía.
  //   (a) Se exigía scrollHeight > clientHeight (que YA desborde). Al insertar el bloque, este es
  //       un placeholder pequeño y puede que nada desborde todavía → devolvía el fallback .cn-col,
  //       que en MainChat NO es el scroller, y la bajada se aplicaba al elemento equivocado.
  //       Ahora basta con que el ancestro sea scrollable por CSS; el desbordamiento llega solo.
  //   (b) Se resuelve en el momento de BAJAR, no al empezar (ver __cnStackScroll).
  // Se prefiere el ancestro MÁS CERCANO que scrollee; si ninguno, el fallback histórico.
  function __cnScrollerDe(nodo) {
    var candidato = null;
    for (var n = nodo.parentNode; n && n.nodeType === 1 && n !== document.body; n = n.parentNode) {
      var ov = getComputedStyle(n).overflowY;
      if (ov !== "auto" && ov !== "scroll") continue;
      if (n.scrollHeight > n.clientHeight + 1) return n;   // desborda AHORA: es el bueno, seguro
      if (!candidato) candidato = n;                       // scrollable, aún sin desbordar
    }
    return candidato || el("cn-col");
  }

  // [2026-08-24 · 2ª pasada] UNA sola bajada, cuando el contenido DEJA de crecer. La versión
  // anterior (rAF + reajuste a 350ms, más una llamada extra tras pintar el foco) disparaba varias
  // veces MIENTRAS Plotly seguía añadiendo alto: cada gráfico que aparecía empujaba el fondo y la
  // vista lo perseguía, así que los gráficos ya pintados se "escurrían" hacia abajo hasta salir de
  // pantalla. Ahora un ResizeObserver espera un PERÍODO DE CALMA (sin cambios de alto) y recién
  // entonces baja: mismo destino que pidió el usuario (el FONDO, decisión 2026-08-21), sin arrastre.
  // 600ms de calma: con 260 se bajaba ENTRE dos gráficos de Plotly (medido — bajó con
  // scrollHeight=508 y el contenido acabó en 668, o sea 160px por debajo del fondo real). El
  // pintado de varias gráficas deja huecos de ~200-400ms entre una y otra, así que el umbral
  // tiene que ser mayor que ese hueco, no que el tiempo total.
  var __CN_CALMA_MS = 600;      // sin cambios de alto durante este lapso = el contenido cuajó
  var __CN_TOPE_MS = 8000;      // techo duro: un panel que nunca deja de crecer no bloquea la bajada
  function __cnStackScroll(blk) {
    if (!blk) return;
    // Reentrante: si el bloque ya tiene una bajada en curso (p.ej. __cnAnzCargarFoco la pide otra
    // vez tras su fetch), se reusa esa — no se apilan observers compitiendo por el mismo scroller.
    if (blk.__cnScrollPend) return;
    blk.__cnScrollPend = true;

    var tCalma = null, tTope = null, ro = null;
    // El "movió el scroll a mano" NO se puede medir contra la posición inicial: entre medias el
    // contenido crece cientos de px (el bloque entra como placeholder de ~40px y acaba en cientos),
    // y tanto scrollTop como la distancia al fondo cambian solos. Medido: comparar contra el inicio
    // aborta la bajada por falso positivo. Se marca con un flag que solo enciende un evento de
    // scroll REAL, y se ignora el que dispara nuestra propia escritura de scrollTop.
    // [2026-08-24 · 4ª pasada] MEDIDO en la app real: el listener estaba en document con captura
    // para no depender de conocer el scroller, y eso capturaba el scroll de CUALQUIER elemento —
    // incluido el del chat, que se auto-scrollea al pintar la respuesta (__cnAppendRaw hace
    // m.scrollTop = m.scrollHeight). Ese scroll ajeno encendía el flag y abortaba la bajada de
    // Insights: la traza decía "abortado: el usuario movio el scroll" en un navegador headless
    // donde nadie tocó nada, y el panel se quedaba 457px por encima del fondo.
    // Ahora solo se escucha AL SCROLLER de este bloque, y solo eventos de confianza (isTrusted):
    // un scroll sintético del propio código nunca se confunde con un gesto del usuario.
    var userScroll = false, propio = false;
    var scWatch = __cnScrollerDe(blk);
    function onScroll(e) { if (!propio && (!e || e.isTrusted)) userScroll = true; }
    if (scWatch) scWatch.addEventListener("scroll", onScroll, {passive: true});
    function limpiar() {
      blk.__cnScrollPend = false;
      if (scWatch) scWatch.removeEventListener("scroll", onScroll);
      if (tCalma) clearTimeout(tCalma);
      if (tTope) clearTimeout(tTope);
      if (ro) { try { ro.disconnect(); } catch (e) {} }
    }
    function bajar() {
      if (userScroll) { __cnScrollLog("abortado: el usuario movio el scroll"); limpiar(); return; }
      // El scroller se resuelve AQUÍ, no al empezar: al insertar el bloque el contenido todavía no
      // desborda y la búsqueda podía devolver el contenedor equivocado. Ahora el DOM ya está en su
      // estado final. [2026-08-24 · 3ª pasada]
      var sc = __cnScrollerDe(blk);
      if (sc) {
        propio = true;
        var antes = sc.scrollTop;
        sc.scrollTop = sc.scrollHeight - sc.clientHeight;
        __cnScrollLog("bajo", {
          scroller: (sc.id || sc.className || sc.tagName),
          scrollTop: antes + " -> " + sc.scrollTop,
          scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight,
          movio: sc.scrollTop !== antes,
          cadena: __cnCadenaScroll(blk)
        });
        // El evento de scroll de la línea anterior llega en el siguiente tick; el flag se baja
        // después para que onScroll no lo confunda con un gesto del usuario.
        requestAnimationFrame(function () { propio = false; });
      } else {
        __cnScrollLog("SIN scroller", {cadena: __cnCadenaScroll(blk)});
      }
      limpiar();
    }
    function reiniciarCalma() {
      if (tCalma) clearTimeout(tCalma);
      tCalma = setTimeout(bajar, __CN_CALMA_MS);
    }
    if (typeof ResizeObserver === "function") {
      ro = new ResizeObserver(reiniciarCalma);
      ro.observe(blk);          // el bloque crece con cada tarjeta/gráfico que llega
      tTope = setTimeout(bajar, __CN_TOPE_MS);
    }
    // Sin ResizeObserver (o mientras llega el primer cambio): el rAF cubre el layout inicial.
    requestAnimationFrame(reiniciarCalma);
  }

  // ============ Panel "analiza_foco" (Analizar/causal), apilado — carga async ============
  // [2026-08-13] A diferencia de cuant_*/jerarq_* (funciones puras, solo HTML), este panel necesita
  // datos que la ruta del chat NO trae (A7): la curva diaria y el gap por campo viven en
  // /analisis/desempeno y /analisis/ejecutivo, los MISMOS endpoints que pinta el tablero — pero el
  // tablero puede estar mostrando OTRA entidad ahora mismo (__cnEjecD/__cnDesempData son SU estado,
  // no el de esta pregunta), así que este bloque hace SU PROPIO fetch, con SU PROPIO scope.

  // [2026-08-26] Vista «por campos» del panel de Analizar: SOLO el desglose real vs producción
  // esperada, un bloque por producto. Emite únicamente el host `cn-foco-mon-` (nada de
  // `cn-foco-day-`), que es lo que hace que __cnPaintFocoStk pinte el desglose y se salte la
  // curva diaria. El envoltorio .cp-foco > .cp-foco__panel.is-active es el mismo del acordeón:
  // de ahí saca la altura y el color de producto (colapsable.css:1838).
  function __cnAnzCamposHtml(focos, sufijo) {
    focos = (focos || []).filter(function (f) { return !f.sin_produccion; });
    sufijo = sufijo || "";
    if (!focos.length)
      return '<div class="p-2 text-muted small">Sin desglose por campo para este periodo.</div>';
    return focos.map(function (f) {
      var prod = f.producto || "";
      var pI = __cnProdId(prod) || { color: "#6E7C75", soft: "#F1F4F1" };
      return '<div class="cp-foco" style="--cp-prod:' + pI.color + ';--cp-prod-soft:' + pI.soft + '" ' +
             'data-prod="' + esc(prod) + '">' +
        '<div class="cp-foco__panel is-active">' +
          '<div id="cn-foco-mon-' + f.rank + sufijo + '" class="cn-ins"></div>' +
        '</div></div>';
    }).join("");
  }

  function __cnAnzPlaceholderHtml() {
    return '<div class="d-flex align-items-center gap-2 p-2 text-muted small">' +
      '<div class="spinner-border spinner-border-sm"></div> Cargando el panel de foco…</div>';
  }

  // Querystring/clave de caché iguales en FÓRMULA a __cnSegQS/__cnCacheKey (para heredar el
  // cache-HIT del prewarm de login, key "ecp|__global__|-|-") pero SIN llamarlas: esas dos leen
  // __cnNivel/__cnPeriodo del MÓDULO — el estado del TABLERO — y aquí el nivel/periodo son los de
  // ESTA pregunta (`datos.nivel`/`datos.periodo`), potencialmente distintos. Analizar es siempre
  // segmento "ecp" (no hay equivalente de Filiales en este grupo).
  function __cnAnzQS(entidad, nivel, periodo) {
    var qs = [];
    if (entidad) qs.push("entidad=" + encodeURIComponent(entidad));
    if (nivel) qs.push("nivel=" + encodeURIComponent(nivel));
    if (periodo) qs.push("periodo=" + encodeURIComponent(periodo));
    return qs.length ? "?" + qs.join("&") : "";
  }
  function __cnAnzCacheKey(entidad, nivel, periodo) {
    return "ecp|" + (entidad || "__global__") + "|" + (nivel || "-") + "|" + (periodo || "-");
  }

  // Carga desempeño→ejecutivo (SECUENCIAL, mismo motivo que __cnPrewarmGlobal: el proxy Flask usa
  // hilos bloqueantes) REUSANDO __cnDesempCache/__cnEjecCache (mismas guardas de "no cachear
  // errores" que __cnAnalizar/__cnPrewarmGlobal) — así una pregunta GLOBAL es cache-HIT gracias al
  // prewarm del login, y el fetch de esta pregunta deja cacheada la entidad para cuando el TABLERO
  // la abra después. Filtra ed.focos por datos.productos (D1) SIN renumerar rank (:3328/:3341 —
  // rank es la clave de los IDs). Pinta solo si el bloque sigue conectado al DOM (A6); si no
  // (la pestaña de Consulta se cerró mientras el fetch estaba en vuelo), guarda los payloads EN el
  // nodo (mismo patrón que elp.__cnRO de __cnPlotResize) y marca data-pend-paint para que
  // renderViewer lo pinte al restaurar la pila.
  function __cnAnzCargarFoco(blk, datos, sufijo) {
    var host = blk.querySelector(".cn-stk__body");
    if (!host) return;
    var entidad = datos.entidad, nivel = datos.nivel, periodo = datos.periodo;
    var key = __cnAnzCacheKey(entidad, nivel, periodo);
    var qs = __cnAnzQS(entidad, nivel, periodo);

    var pDesemp = __cnDesempCache[key] ? Promise.resolve(__cnDesempCache[key]) :
      fetch("/api/analisis/desempeno" + qs).then(function (r) { return r.json(); }).then(function (dd) {
        if (dd && dd.encontrada !== false && !dd.sin_datos && !dd.sin_cierre) __cnDesempCache[key] = dd;
        return dd;
      });

    pDesemp.then(function (dd) {
      var pEjec = __cnEjecCache[key] ? Promise.resolve(__cnEjecCache[key]) :
        fetch("/api/analisis/ejecutivo" + qs).then(function (r) { return r.json(); }).then(function (ed) {
          if (ed && ed.encontrada !== false && !ed.sin_datos &&
              __cnPayloadEsFil(ed) === false && (ed.meta || {}).generado_por !== "error") {
            __cnEjecCache[key] = ed;
          }
          return ed;
        });
      return pEjec.then(function (ed) { return { dd: dd, ed: ed }; });
    }).then(function (r) {
      var dd = r.dd, ed = r.ed;
      if (!dd || dd.encontrada === false || dd.sin_datos || !ed || ed.encontrada === false || ed.sin_datos) {
        host.innerHTML = '<div class="p-2 text-muted small">No se pudo cargar el panel de foco para este análisis.</div>';
        return;
      }
      var productos = datos.productos || [];
      var focosF = productos.length
        ? (ed.focos || []).filter(function (f) { return productos.indexOf(f.producto) !== -1; })
        : (ed.focos || []);
      // [2026-08-26] `vista: "campos"` → solo el DESGLOSE POR CAMPO, sin el acordeón entero.
      // «¿Qué campos explican el faltante?» devolvía el panorama completo —comportamiento
      // diario, ejecución vs PPTO y el desglose—: la respuesta estaba dentro, enterrada bajo dos
      // bloques que nadie había pedido. Y es una pregunta que el propio sistema OFRECE en su
      // cierre (_CIERRE_PROY), así que aceptarla tenía que llevar justo a esto.
      // 🔑 No hace falta pintor nuevo: __cnPaintFocoStk (:1845) pinta el desglose en cuanto
      //    existe el host `cn-foco-mon-{rank}{sufijo}`, y la curva solo si existe `cn-foco-day-`.
      //    Emitiendo únicamente el primero, el mecanismo de siempre hace el resto.
      host.innerHTML = (datos.vista === "campos")
        ? __cnAnzCamposHtml(focosF, sufijo)
        : __cnFocosHtml(focosF, ed.sin_foco, ed.meta, ed.tarjetas, sufijo, entidad, nivel);
      // [2026-08-31] +tarjetas: __cnDailyInto las necesita para la línea de PPTO diario. Este
      // objeto es un SUBCONJUNTO deliberado de `ed` (A7: no se pasa el payload entero), así que
      // todo campo que consuma el pintor tiene que añadirse aquí explícitamente o llega undefined.
      var edScoped = { focos: focosF, gap_por_producto: ed.gap_por_producto, tarjetas: ed.tarjetas };
      if (blk.isConnected) {
        __cnPaintFocoStk(blk, edScoped, dd, sufijo);
        // [2026-08-24 · 4ª pasada] Se vuelve a pedir la bajada AQUÍ. Este panel se rellena por
        // fetch después de insertarse y sus dos llamadas a INGESTA pueden superar el techo de 8s
        // del observer (con Ollama frío en el servidor, de sobra): para entonces el observer ya se
        // rindió y nadie baja. La llamada es idempotente — si la bajada original sigue viva,
        // __cnScrollPend la deja pasar sin apilar un segundo observer, que fue el "escurrido" de
        // la 1ª pasada.
        __cnStackScroll(blk);
      } else {
        blk.dataset.pendPaint = "1";
        blk.__cnAnzEd = edScoped; blk.__cnAnzDd = dd; blk.__cnAnzSufijo = sufijo;
      }
    }).catch(function () {
      host.innerHTML = '<div class="p-2 text-danger small">Fallo de red cargando el panel de foco.</div>';
    });
  }

  // [2026-08-25] Resalta el día que la pregunta nombró. Se hace con Plotly.addTraces SOBRE la curva
  // ya pintada — __cnDailyPlot NO se toca (es compartida con el panel de Focos).
  // 🔑 A-4: el eje X NO son fechas ISO. __cnDailyPlot (:1749-1753) mapea cada fecha al DÍA DEL MES
  // como STRING ("1","15") con xaxis.type="category". Buscar la ISO completa nunca calzaría y el
  // marcador no aparecería, fallando en silencio. Medido en el código, no supuesto.
  function __cnCompProdMarcarDia(blk, iso) {
    if (!iso || !window.Plotly) return;
    var host = blk.querySelector(".cn-ins .cn-ins__plot");
    if (!host || !host.data || !host.data.length) return;
    var dia = String(parseInt(String(iso).slice(8, 10), 10));   // "2026-05-15" -> "15"
    var xs = host.data[0].x || [], ys = host.data[0].y || [];
    var i = xs.indexOf(dia);
    if (i < 0) return;
    try {
      window.Plotly.addTraces(host, {
        x: [xs[i]], y: [ys[i]], type: "scatter", mode: "markers",
        marker: { size: 13, color: "#F7DB17", line: { color: "#004236", width: 2 } },
        hoverinfo: "skip", showlegend: false
      });
    } catch (e) { /* el marcador es decorativo: jamás debe tumbar el panel */ }
  }

  // [2026-08-25] QV2-PANEL-DIA. Gemelo de __cnAnzCargarFoco (:2963) — mismos 2 fetches
  // SECUENCIALES, mismas cachés y mismas guardas de "no cachear errores".
  // 🔑 `pulir=false`: sin él INGESTA ejecuta el pulido LLM de Gemma (180s; timeout 200 en el
  // proxy). Este panel NO usa `secciones`, así que se salta (A-5, misma razón que RA-1).
  function __cnCompProdCargar(blk, datos, sufijo) {
    var host = blk.querySelector(".cn-stk__body");
    if (!host) return;
    var entidad = datos.entidad, nivel = datos.nivel, periodo = datos.periodo;
    // [2026-09-03 · CURVA-VENTANA] Ventana móvil («los últimos 30 días»): la curva se pide
    // acotada a [ini,fin] en vez de al mes.
    // 🔑 v2/H10: va TAMBIÉN en la clave de caché del navegador. `__cnDesempCache` es
    //    compartida con el tablero y con las demás preguntas; sin distinguir la ventana, una
    //    pregunta por ventana y otra por el mes de la misma entidad comparten entrada y la
    //    segunda pinta la curva de la primera.
    // 🔑 v2/H11: la query se arma con un ARRAY, no concatenando. `__cnAnzQS` devuelve "" en
    //    el caso global (sin entidad/nivel/periodo) y un `qs + "&v_ini=…"` habría producido
    //    una URL sin "?" — inválida, y solo en ese caso.
    var ven = datos.ventana || null;
    var key = __cnAnzCacheKey(entidad, nivel, periodo) + (ven ? ("|v:" + ven.ini + ".." + ven.fin) : "");
    var _qp = [];
    if (entidad) _qp.push("entidad=" + encodeURIComponent(entidad));
    if (nivel) _qp.push("nivel=" + encodeURIComponent(nivel));
    if (periodo) _qp.push("periodo=" + encodeURIComponent(periodo));
    if (ven) {
      _qp.push("v_ini=" + encodeURIComponent(ven.ini));
      _qp.push("v_fin=" + encodeURIComponent(ven.fin));
    }
    var qs = _qp.length ? ("?" + _qp.join("&")) : "";
    // El fetch a /ejecutivo va SIN la ventana a propósito: ese endpoint es mensual y no la
    // entiende. Conserva la query de siempre (__cnAnzQS), no la de arriba.
    var _qsBase = __cnAnzQS(entidad, nivel, periodo);
    var qsEj = _qsBase + (_qsBase ? "&" : "?") + "pulir=false";

    var pDesemp = __cnDesempCache[key] ? Promise.resolve(__cnDesempCache[key]) :
      fetch("/api/analisis/desempeno" + qs).then(function (r) { return r.json(); }).then(function (dd) {
        if (dd && dd.encontrada !== false && !dd.sin_datos && !dd.sin_cierre) __cnDesempCache[key] = dd;
        return dd;
      });

    pDesemp.then(function (dd) {
      var pEjec = __cnEjecCache[key] ? Promise.resolve(__cnEjecCache[key]) :
        fetch("/api/analisis/ejecutivo" + qsEj).then(function (r) { return r.json(); }).then(function (ed) {
          if (ed && ed.encontrada !== false && !ed.sin_datos &&
              __cnPayloadEsFil(ed) === false && (ed.meta || {}).generado_por !== "error") {
            __cnEjecCache[key] = ed;
          }
          return ed;
        });
      return pEjec.then(function (ed) { return { dd: dd, ed: ed }; });
    }).then(function (r) {
      var dd = r.dd, ed = r.ed;
      if (!dd || dd.encontrada === false || dd.sin_datos || !ed || ed.encontrada === false || ed.sin_datos) {
        host.innerHTML = '<div class="p-2 text-muted small">No se pudo cargar el comportamiento del producto.</div>';
        return;
      }
      var productos = datos.productos || [];
      var focosF = productos.length
        ? (ed.focos || []).filter(function (f) { return productos.indexOf(f.producto) !== -1; })
        : (ed.focos || []);
      // [2026-08-26] QV2-PANEL-DIA · SIN tarjeta KPI: se pasa [] a propósito (decisión del
      // usuario). La pregunta es por UN DÍA y la tarjeta hablaba del MES — ponía "221.610 BOPD"
      // (promedio diario del mes) junto a los "223.752 bbl" del día 15 en el texto: dos cifras
      // casi iguales, una al lado de otra, invitando a confundirlas. La cifra del día ya la da
      // la respuesta; el panel aporta la FORMA de la curva y dónde cae ese día.
      // __cnCompProdHtml activa `--solo` solo con que no haya tarjeta para el producto (:3202),
      // así que la curva pasa a ancho completo sin tocar el constructor. Para volver a mostrarla
      // basta con devolver `ed.tarjetas` aquí.
      host.innerHTML = __cnCompProdHtml(focosF, ed.meta, [], sufijo);
      var edScoped = { focos: focosF };
      if (blk.isConnected) {
        __cnPaintFocoStk(blk, edScoped, dd, sufijo);
        __cnCompProdMarcarDia(blk, datos.dia_marcado);
        __cnStackScroll(blk);
      } else {
        // A-6: el bloque se restaura por multitab_shell.js:439 / acordeon.js:140, que llaman a
        // __cnPaintFocoStk pero NO conocen el marcador → la curva se repinta SIN el punto
        // resaltado. Degradación cosmética aceptada y declarada; los datos son los correctos.
        blk.dataset.pendPaint = "1";
        blk.__cnAnzEd = edScoped; blk.__cnAnzDd = dd; blk.__cnAnzSufijo = sufijo;
      }
    }).catch(function () {
      host.innerHTML = '<div class="p-2 text-danger small">Fallo de red cargando el comportamiento del producto.</div>';
    });
  }

  function __cnPintarPanelCuant(panel, pregunta) {
    // El guard va ANTES de __cnStackEnsure(): un panel sin datos no debe crear un bloque vacío ni
    // marcar la pila como activa (deja el visor intacto, igual que el comportamiento previo).
    if (!panel || !panel.datos) return;
    var stack = __cnStackEnsure(); if (!stack) return;
    var d = panel.datos;
    // cuant_rank se bifurca por metrica: "real" (producción) va al dot plot nuevo; "gap"
    // (faltante/excedente, valores NEGATIVOS) sigue en la lista __cnCuantRankHtml, sin tocar.
    var body = (panel.tipo === "cuant_serie")    ? __cnCuantSerieHtml(d)
             : (panel.tipo === "cuant_var")      ? __cnCuantVarHtml(d)
             // [2026-09-03 · CURVA-ACUMULADA] N2 = el KPI de siempre + la curva del acumulado.
             // 🔑 Sin este ramal NO se rompe nada: `cuant_acum` caería al fallback
             //    `__cnCuantCardHtml` (:3989) y pintaría el gauge correcto... SIN la curva. Un
             //    fallo silencioso, que es peor que uno ruidoso (v2/H13).
             : (panel.tipo === "cuant_acum")     ? __cnCuantAcumHtml(d)
             : (panel.tipo === "cuant_rank")     ? (d.metrica === "real" ? __cnRankDotHtml(d) : __cnCuantRankHtml(d))
             // [2026-08-25] "cuant_dia" (Grano DÍA, plan QV2-GRANO-DIA): registrada ANTES del
             // fallback por la MISMA razón que "p50_vp" arriba — el fallback __cnCuantCardHtml
             // asume PPTO (dat.ppto) y a grano día no existe; sin este `else if` caería ahí y
             // pintaría "NaN bbl" con un anillo al 0%.
             : (panel.tipo === "cuant_dia")       ? __cnCuantDiaHtml(d)
             // [2026-08-25] "cuant_dia_panel" (QV2-PANEL-DIA): mismo patrón asíncrono que
             // "analiza_foco" — placeholder CON [data-prod] (A-7) y __cnCompProdCargar() lo
             // rellena DESPUÉS de insertar el bloque (ver más abajo).
             : (panel.tipo === "cuant_dia_panel") ? __cnCompProdPlaceholderHtml((d.productos || [])[0])
             : (panel.tipo === "jerarq_arbol")    ? __cnJerArbolHtml(d)
             : (panel.tipo === "jerarq_operador") ? __cnJerOperadorHtml(d)
             : (panel.tipo === "jerarq_rank")     ? __cnJerRankHtml(d)
             // [2026-08-13] "p50_vp" (Analizar/referencia, plan_panel_p50_vp_2026-08-13.md): 1
             // tarjeta con la serie mensual P50 vs REAL de una vicepresidencia. H2: registrada
             // ANTES del fallback `__cnCuantCardHtml` — ese fallback NO valida el tipo y pintaría
             // una tarjeta KPI con campos ajenos (estado/cumplimiento_pct/nivel) ante cualquier
             // tipo no reconocido; sin este `else if` explícito, "p50_vp" caería ahí.
             : (panel.tipo === "p50_vp")          ? __cnP50VpHtml(d)
             // [2026-08-13] "analiza_foco" (Analizar/causal): a diferencia de los demás tipos, este
             // NO es una función pura — el acordeón de foco necesita fetch propio (desempeño +
             // ejecutivo, A7) → arranca con un placeholder y __cnAnzCargarFoco() lo rellena DESPUÉS
             // de insertar el bloque (ver más abajo).
             : (panel.tipo === "analiza_foco")    ? __cnAnzPlaceholderHtml()
             // [2026-08-26] "analiza_dif" (Analizar/diferidas): host vacío + lazy, ver
             // __cnDifPanelHtml. Registrado ANTES del fallback por la misma razón que "p50_vp":
             // __cnCuantCardHtml no valida el tipo y pintaría una tarjeta KPI con campos ajenos.
             : (panel.tipo === "analiza_dif")     ? __cnDifPanelHtml(d)
             // [2026-09-03 · TENDENCIA] "analiza_tend" (Analizar/tendencia): función pura, sin
             // fetch — los puntos ya viajan en panel.datos, igual que cuant_serie/cuant_var.
             : (panel.tipo === "analiza_tend")    ? __cnAnzTendHtml(d)
             // [2026-09-03 · COMPARACION-PERIODOS] NCMP y N3P. Registrados ANTES del fallback
             // por la misma razón que los demás: __cnCuantCardHtml no valida el tipo y pintaría
             // una tarjeta KPI leyendo campos que estos contratos no tienen (HE6).
             : (panel.tipo === "cuant_cmp")        ? __cnCuantCmpHtml(d)
             : (panel.tipo === "cuant_serie_ppto") ? __cnCuantSeriePptoHtml(d)
             : __cnCuantCardHtml(d);
    // Tope silencioso (sin UI, sin aviso): al superarlo se descarta el bloque más antiguo.
    while (stack.children.length >= __CN_STACK_MAX) stack.removeChild(stack.firstChild);
    __cnStackSeq++;
    var blk = document.createElement("section");
    blk.className = "cn-stk";
    blk.id = "cn-stk-" + __cnStackSeq;
    // Los constructores ya se auto-titulan (.cq-hd, .cn-rank__hd, .cp-mes__kpi-name, .jq-node__value) y
    // no comparten campos entre sí (p.ej. el ranking no usa entidad_cualificada) → la cabecera del
    // bloque NO deriva un título del contenido (duplicaría texto); lleva lo que el contenido no
    // tiene: la PREGUNTA.
    blk.innerHTML =
      '<div class="cn-stk__hd">' +
      '  <span class="cn-stk__n">' + __cnStackSeq + '</span>' +
      '  <span class="cn-stk__q">' + esc(pregunta || "") + '</span>' +
      '  <span class="cn-stk__ts">' + __cnStackHora() + '</span>' +
      '</div>' +
      '<div class="cn-stk__body">' + body + '</div>';
    // [2026-08-11] Identidad de producto en el BLOQUE (filete + badge del turno): el constructor
    // emite data-prod en su raíz; el dispatcher lo lee AQUÍ, nunca al revés (los constructores
    // siguen siendo funciones puras que no tocan el DOM). Genérico: cualquier panel futuro que
    // emita data-prod hereda el filete sin tocar el dispatcher otra vez.
    // ⚠️ "analiza_foco" queda FUERA a propósito (placeholder aún sin [data-prod] en este punto, y
    // puede mostrar 1-3 productos a la vez, D1) — cada tarjeta .cp-foco YA lleva su propio
    // --cp-prod inline (__cnFocosHtml); un filete único de bloque no aplicaría.
    var prEl = blk.querySelector("[data-prod]");
    if (prEl) {
      var prId = __cnProdId(prEl.getAttribute("data-prod"));
      if (prId) {
        blk.style.setProperty("--cp-prod", prId.color);
        blk.style.setProperty("--cp-prod-soft", prId.soft);
        blk.style.setProperty("--cp-prod-text", prId.texto);
        blk.classList.add("cn-stk--prod");
      }
    }
    // [2026-08-24] "Renderizar al tiempo": el bloque entra con la MISMA duración que el
    // revelado del chat (__cnRevelarDur), de modo que ambos avanzan juntos en vez de que
    // el panel salte entero mientras el texto todavía se escribe. Si el chat no se animó
    // (respuesta corta / reduced-motion) la duración es 0 y el bloque aparece de golpe,
    // como antes. La clase se retira al terminar: es solo la entrada, no un estado.
    if (__cnRevelarDur > 0) {
      blk.style.setProperty("--cn-stk-in", __cnRevelarDur + "ms");
      blk.classList.add("cn-stk--in");
      // La clase se retira con animationend, NO con un setTimeout: un temporizador
      // empezaría a contar antes del appendChild de abajo, y si el hilo se bloquea
      // (analiza_foco monta Plotly justo después) vencería a media animación y el
      // bloque saltaría a su estado final. El evento llega cuando de verdad termina.
      // El respaldo por tiempo queda por si la animación nunca corre —p.ej. el bloque
      // se inserta en el fragment de una pestaña oculta— y así la clase no se queda fija.
      var quitar = function () { blk.classList.remove("cn-stk--in"); };
      blk.addEventListener("animationend", quitar, {once: true});
      setTimeout(quitar, __cnRevelarDur + 1200);
    }
    stack.appendChild(blk);   // createElement+appendChild, NUNCA innerHTML += (destruiría lo previo)
    // Solo hay a dónde hacer scroll si el destino es el contenedor VIVO; si es el fragment del cache
    // (pestaña fuera de pantalla) el scroll lo aplica renderViewer al restaurar.
    if (stack.nodeType === 1) __cnStackScroll(blk);
    // [2026-08-13] "analiza_foco": el fetch se dispara SIEMPRE (no depende del DOM); solo el
    // PINTADO de Plotly espera a que el bloque esté conectado (__cnAnzCargarFoco lo decide, A6).
    if (panel.tipo === "analiza_foco") __cnAnzCargarFoco(blk, d, "-stk" + __cnStackSeq);
    // [2026-08-25] "cuant_dia_panel" (QV2-PANEL-DIA): mismo patrón, gemelo de la línea de arriba.
    if (panel.tipo === "cuant_dia_panel") __cnCompProdCargar(blk, d, "-stk" + __cnStackSeq);
    // [2026-08-26] "analiza_dif": mismo patrón, pero el lazy ya vive en __cnDiferidasInto.
    if (panel.tipo === "analiza_dif") __cnDifPanelCargar(blk);
    // [2026-08-25] QV2-MAPA · mismo patrón: el árbol ya está pintado y el mapa se rellena
    // después, sin bloquearlo.
    if (panel.tipo === "jerarq_arbol") __cnJerMapaCargar(blk);
    // [2026-08-25] QV2-PANEL-MES · N3/N4: mismo patrón, pero SIN fetch (los datos ya vienen en
    // panel.datos). Se difiere igual para que el pintor encuentre el host ya insertado, y el
    // guardián de __cnPanelMesCargar cubre el caso del DocumentFragment (pestaña oculta).
    if (panel.tipo === "cuant_serie" || panel.tipo === "cuant_var" || panel.tipo === "cuant_acum" || panel.tipo === "analiza_tend" || panel.tipo === "cuant_cmp" || panel.tipo === "cuant_serie_ppto") __cnPanelMesCargar(blk, d, panel.tipo);
  }

  // [2026-08-11] NO-OP desde que análisis y pila conviven en un scroll único (.cn-col): ya no hay
  // nada que esconder — el análisis vive arriba y la pila debajo, ambos visibles a la vez. Se
  // conserva la función porque la llaman los 6 escritores de #cn-canvas (__cnDashHint, __cnDashboard,
  // __cnVerReporteDia, __cnTendenciaFilial, __cnAnalisisTab, __cnAnalizar): vaciarla aquí evita
  // tocar los 6 sitios y deja el gancho por si el modo excluyente vuelve a hacer falta.
  // Lo que esos 6 SÍ hacen ahora es reemplazar el bloque de arriba EN SITIO (singleton), que es el
  // contrato acordado — la pila de abajo nunca se toca.
  function __cnStackHide() { /* no-op */ }

  // Fase 3 (N3 serie mensual / N4 variación mes a mes). Reusan __cnGasM/__cnMilesEC/esc/el ya
  // existentes. Paneles transitorios igual que el KPI de N1/N2 (AF-3.8, HD5).
  // [2026-08-25] QV2-PANEL-MES · N3 pasa de filas con mini-barra CSS a CURVA MENSUAL. El
  // constructor sigue siendo PURO: emite el envoltorio + un host vacío, y el pintor lo rellena
  // después de insertar el bloque (mismo patrón que "cuant_dia_panel", :3335 + :3411).
  // 🔑 El envoltorio .cp-foco > .cp-foco__panel.is-active NO es decorativo: la única regla que da
  //   altura al grid en el TABLERO exige .cn-desemp__scroll (colapsable.css:2435) y la pila no lo
  //   tiene. MEDIDO (2026-08-25): sin este envoltorio el grid queda en 20px y Plotly monta un SVG
  //   de 10px de alto — sin lanzar error. Con él + la clase --mes: 375px de grid, 327px de plot.
  // 🔑 --mes queda como marcador semántico del panel mensual. Nació como clase propia para no
  //   tocar de paso el panel de grano día, pero desde el 2026-08-26 ambos comparten la misma
  //   altura en la pila (el día se quedó sin tarjeta KPI y su curva necesitaba el alto), así
  //   que la regla CSS cuelga ya del grid completo, no de esta clase.
  // Los AVISOS se conservan bajo el gráfico: lo que reemplaza la curva es la tabla de CIFRAS, no
  // las advertencias (p.ej. "el último mes es proyección de cierre").
  function __cnPanelMesHtml(d, hostCls) {
    var pI = __cnProdId(d.producto) || { color: "#6E7C75", soft: "#F1F4F1" };
    var avisos = (d.avisos || []).map(function (a) {
      return '<div class="cq-aviso">⚠️ ' + esc(a) + '</div>';
    }).join("");
    return '<div class="cp-foco" style="--cp-prod:' + pI.color + ';--cp-prod-soft:' + pI.soft + '">' +
      '<div class="cp-foco__panel is-active">' +
        '<div class="cn-compprod__grid cn-compprod__grid--solo cn-compprod__grid--mes" ' +
             'data-prod="' + esc(d.producto || "") + '">' +
          '<div class="cn-ins ' + hostCls + '"></div>' +
        '</div>' +
      '</div>' +
      (avisos ? '<div class="cq-avisos">' + avisos + '</div>' : "") +
      '</div>';
  }

  function __cnCuantSerieHtml(d) { return __cnPanelMesHtml(d, "cn-serie-mes"); }

  // [2026-09-03 · CURVA-ACUMULADA] N2 = el KPI de siempre + la curva creciente del acumulado.
  // 🔑 El gauge NO se sustituye: en N2 el porcentaje es correcto (acumulado real vs acumulado
  //    de presupuesto, ambos de meses CERRADOS) y quitarlo perdería información que ya sirve.
  //    Se CONCATENA el markup de __cnCuantCardHtml (:3438) con el envoltorio mensual (:4086),
  //    que ya sabe montar un host para Plotly.
  // 🔑 v2/H12 — LOS AVISOS VAN SOLO EN EL KPI. __cnCuantCardHtml los pinta (:3463) y
  //    __cnPanelMesHtml TAMBIÉN (:4088). Pasarle el mismo `d` a las dos duplicaría el aviso
  //    «⚠️ El mes de agosto sigue en curso…» en la misma tarjeta. Al envoltorio se le pasa una
  //    copia SIN `avisos`; se quedan donde el usuario ya los conoce, bajo "Corte".
  // 🔑 [2026-09-03] Hacen falta DOS puntos, no uno. Una ventana corta («los últimos 3 meses»
  //    con un solo mes CERRADO dentro) daba una "curva" de un punto: un dot suelto, con leyenda
  //    de dos series y la de PPTO invisible —`mode:"lines"` con un solo punto no dibuja NADA—.
  //    Parecía un panel roto. Con un mes, el KPI y sus avisos ya cuentan la historia entera.
  function __cnCuantAcumHtml(d) {
    var kpi = __cnCuantCardHtml(d);
    if (!d.serie_acum || d.serie_acum.length < 2) return kpi;
    var dSinAvisos = {};
    for (var k in d) { if (Object.prototype.hasOwnProperty.call(d, k)) dSinAvisos[k] = d[k]; }
    dSinAvisos.avisos = [];
    return kpi + __cnPanelMesHtml(dSinAvisos, "cn-acum-mes");
  }

  // Curva ACUMULADA: dos series crecientes (REAL y PPTO). Molde = __cnFilSeriePlot (:1386),
  // que es el único pintor mensual de VARIAS trazas; __cnSerieMesPlot (:2273) no vale porque
  // su referencia es un ESCALAR dibujado como línea horizontal, y aquí el presupuesto acumulado
  // es otra curva que sube.
  function __cnAcumMesInto(hostEl, d) {
    var serie = d.serie_acum || [];
    var prod = String(d.producto || "");
    var nombre = prod.charAt(0).toUpperCase() + prod.slice(1).toLowerCase();
    var unidad = d.unidad || "bbl";
    var hd = esc(nombre) + ' · acumulado ' + (d.anio || "") + ' vs presupuesto';
    hostEl.innerHTML =
      '<div class="cn-ins__card"><div class="cn-ins__card-hd"><i class="bi bi-graph-up-arrow"></i> ' + hd + '</div>' +
      '<div class="cn-ins__plot" data-p></div>' +
      '<div class="cn-ins__cap" data-cap></div></div>';
    var elp = hostEl.querySelector("[data-p]");
    if (!serie.length) {
      elp.innerHTML = '<div class="p-2 text-muted small">Sin acumulado mensual para este producto.</div>';
      return;
    }
    if (!window.Plotly) { elp.innerHTML = '<div class="text-muted small p-2">(Plotly no disponible)</div>'; return; }
    // El gas se grafica en MSCF (÷1e6) y el hover formatea el valor ORIGINAL con __cnGasM (que
    // ya divide) — nunca el ya escalado: ese doble escalado es el bug documentado en :3650-3652.
    var esGas = String(prod).toUpperCase() === "GAS";
    var fmtD = esGas ? __cnGasM : function (v) { return __cnMilesEC(Math.round(v)); };
    var esc1 = function (v) { return (v == null) ? null : (esGas ? v / 1e6 : v); };
    var meses = serie.map(function (p) { return p.mes; });
    var col = __cnProdCol(prod);
    var traces = [{
      x: meses, y: serie.map(function (p) { return esc1(p.real_acum); }),
      name: "Real acumulado", type: "scatter", mode: "lines+markers",
      line: { color: col, width: 2.5, shape: "spline", smoothing: 0.8 },
      marker: { color: col, size: 7 },
      customdata: serie.map(function (p) { return fmtD(p.real_acum); }),
      hovertemplate: "%{x}<br>Real acum.: %{customdata}" + (unidad ? " " + unidad : "") + "<extra></extra>"
    }];
    // La curva de PPTO solo se dibuja si HAY presupuesto. `ppto_acum: null` significa "no hay
    // PPTO cargado", que es distinto de "el PPTO es cero" — pintar ceros afirmaría lo segundo.
    if (serie.some(function (p) { return p.ppto_acum != null; })) {
      traces.push({
        x: meses, y: serie.map(function (p) { return esc1(p.ppto_acum); }),
        // [2026-09-03] +markers: `ppto_acum` es null mientras el acumulado de PPTO va en 0, así
        // que la serie puede quedarse en UN solo punto no nulo (p.ej. una ventana de 2 meses
        // donde el primero no tiene meta). Con `mode:"lines"` puro ese punto no se dibuja y el
        // presupuesto desaparece sin decir por qué. Los marcadores lo hacen visible siempre.
        name: "Presupuesto acumulado", type: "scatter", mode: "lines+markers",
        line: { color: "#8a978f", width: 2, dash: "dot" }, connectgaps: false,
        marker: { color: "#8a978f", size: 5 },
        customdata: serie.map(function (p) { return p.ppto_acum == null ? "—" : fmtD(p.ppto_acum); }),
        hovertemplate: "%{x}<br>PPTO acum.: %{customdata}" + (unidad ? " " + unidad : "") + "<extra></extra>"
      });
    }
    window.Plotly.newPlot(elp, traces, {
      margin: { l: 62, r: 18, t: 22, b: 30 }, height: 260, hovermode: "x unified",
      showlegend: true, legend: { orientation: "h", y: -0.18, x: 0, font: { size: 11 } },
      xaxis: { title: { text: "Mes", font: { size: 11 } }, tickfont: { size: 11 }, showgrid: false },
      yaxis: {
        title: { text: "Acumulado (" + (esGas ? "MSCF" : unidad) + ")", font: { size: 11 } },
        tickfont: { size: 10 }, rangemode: "tozero", separatethousands: true,
        gridcolor: "#eef1ef", zeroline: false
      },
      plot_bgcolor: "#fff", paper_bgcolor: "#fff"
    }, { displayModeBar: false, responsive: true });
    var cap = hostEl.querySelector("[data-cap]");
    if (cap) {
      var ult = serie[serie.length - 1];
      cap.innerHTML = 'Suma corrida de los <b>' + serie.length + '</b> meses cerrados de ' +
        esc(String(d.anio || "")) + '. El mes en curso no entra en el acumulado.';
    }
  }

  // [2026-09-03 · TENDENCIA] Panel de la sub-intención `tendencia` de Analizar. Dos trazas:
  // REAL mensual y media móvil de 3 meses. Molde = __cnAcumMesInto (:4453), el único pintor
  // mensual multi-traza de la pila.
  // 🔑 Sin tarjeta KPI: aquí no hay un número único que destacar — la respuesta ES la forma de
  //    la curva, y el texto del chat ya da dirección y ritmo.
  function __cnAnzTendHtml(d) {
    if (!d || !d.valores || d.valores.length < 3) return "";
    return __cnPanelMesHtml(d, "cn-tend-mes");
  }

  function __cnTendMesInto(hostEl, d) {
    var meses = d.meses || [], vals = d.valores || [], mm = d.serie_mm || [];
    var prod = String(d.producto || "");
    var unidad = d.unidad || "bbl";
    var nombre = prod.charAt(0).toUpperCase() + prod.slice(1).toLowerCase();
    hostEl.innerHTML =
      '<div class="cn-ins__card"><div class="cn-ins__card-hd"><i class="bi bi-graph-up"></i> ' +
      esc(nombre) + ' · tendencia mensual ' + (d.anio || "") +
      '</div><div class="cn-ins__plot" data-p></div>' +
      '<div class="cn-ins__cap" data-cap></div></div>';
    var elp = hostEl.querySelector("[data-p]");
    if (!vals.length) {
      elp.innerHTML = '<div class="p-2 text-muted small">Sin serie mensual para este producto.</div>';
      return;
    }
    if (!window.Plotly) { elp.innerHTML = '<div class="text-muted small p-2">(Plotly no disponible)</div>'; return; }
    // El gas se grafica en MSCF (÷1e6) y el hover formatea el valor ORIGINAL con __cnGasM (que
    // ya divide) — nunca el ya escalado: ese doble escalado es el bug documentado en :3650-3652.
    var esGas = String(prod).toUpperCase() === "GAS";
    var fmtD = esGas ? __cnGasM : function (v) { return __cnMilesEC(Math.round(v)); };
    var esc1 = function (v) { return (v == null) ? null : (esGas ? v / 1e6 : v); };
    var col = __cnProdCol(prod);
    var traces = [{
      x: meses, y: vals.map(esc1), name: "Real mensual",
      type: "scatter", mode: "lines+markers",
      line: { color: col, width: 2.5, shape: "spline", smoothing: 0.8 },
      marker: { color: col, size: 7 },
      customdata: vals.map(fmtD),
      hovertemplate: "%{x}<br>Real: %{customdata} " + unidad + "<extra></extra>"
    }];
    // La media móvil solo se dibuja si HAY valores. `connectgaps:false` deja el hueco de los
    // primeros 2 meses en blanco: no existe media de 3 meses ahí, y unirlo la inventaría.
    if (mm.some(function (v) { return v != null; })) {
      traces.push({
        x: meses, y: mm.map(esc1), name: "Media móvil 3M",
        type: "scatter", mode: "lines", connectgaps: false,
        line: { color: "#8a978f", width: 2, dash: "dot" },
        customdata: mm.map(function (v) { return v == null ? "—" : fmtD(v); }),
        hovertemplate: "%{x}<br>MM3: %{customdata} " + unidad + "<extra></extra>"
      });
    }
    window.Plotly.newPlot(elp, traces, {
      margin: { l: 62, r: 18, t: 22, b: 30 }, height: 260, hovermode: "x unified",
      showlegend: true, legend: { orientation: "h", y: -0.18, x: 0, font: { size: 11 } },
      xaxis: { title: { text: "Mes", font: { size: 11 } }, tickfont: { size: 11 }, showgrid: false },
      yaxis: {
        title: { text: "Producción (" + (esGas ? "MSCF" : unidad) + ")", font: { size: 11 } },
        tickfont: { size: 10 }, separatethousands: true, gridcolor: "#eef1ef", zeroline: false
      },
      plot_bgcolor: "#fff", paper_bgcolor: "#fff"
    }, { displayModeBar: false, responsive: true });
  }

  // [2026-09-03 · COMPARACION-PERIODOS] NCMP: dos periodos, barras agrupadas Real vs PPTO.
  // Molde = __cnAcumMesInto (:4452). Barras y no líneas: son DOS puntos, y una línea entre dos
  // puntos sugiere una evolución continua que no existe — mayo y julio no son consecutivos.
  function __cnCuantCmpHtml(d) {
    if (!d || !d.a || !d.b) return "";
    return __cnPanelMesHtml(d, "cn-cmp-mes");
  }

  function __cnCmpMesInto(hostEl, d) {
    var a = d.a || {}, b = d.b || {};
    var prod = String(d.producto || "");
    var unidad = d.unidad || "bbl";
    var nombre = prod.charAt(0).toUpperCase() + prod.slice(1).toLowerCase();
    hostEl.innerHTML =
      '<div class="cn-ins__card"><div class="cn-ins__card-hd"><i class="bi bi-bar-chart-line"></i> ' +
      esc(nombre) + ' · ' + esc(String(a.periodo || "")) + ' vs ' + esc(String(b.periodo || "")) +
      '</div><div class="cn-ins__plot" data-p></div>' +
      '<div class="cn-ins__cap" data-cap></div></div>';
    var elp = hostEl.querySelector("[data-p]");
    if (!window.Plotly) { elp.innerHTML = '<div class="text-muted small p-2">(Plotly no disponible)</div>'; return; }
    // El gas se grafica en MSCF (÷1e6) y el hover formatea el valor ORIGINAL con __cnGasM (que
    // ya divide) — nunca el ya escalado: ese doble escalado es el bug documentado en :3650-3652.
    var esGas = String(prod).toUpperCase() === "GAS";
    var fmtD = esGas ? __cnGasM : function (v) { return __cnMilesEC(Math.round(v)); };
    var esc1 = function (v) { return (v == null) ? null : (esGas ? v / 1e6 : v); };
    var col = __cnProdCol(prod);
    // Orden B → A: se lee de izquierda a derecha como "de dónde venía" → "dónde está".
    var ejes = [String(b.periodo || ""), String(a.periodo || "")];
    var reales = [b.real, a.real], pptos = [b.ppto, a.ppto];
    var traces = [{
      x: ejes, y: reales.map(esc1), name: "Real", type: "bar",
      marker: { color: col },
      customdata: reales.map(fmtD),
      hovertemplate: "%{x}<br>Real: %{customdata} " + unidad + "<extra></extra>"
    }];
    // Cada periodo contra SU propio presupuesto. Si ninguno tiene meta, no se dibuja la serie:
    // barras a cero afirmarían que el presupuesto es cero, que no es lo mismo que no haberlo.
    if (pptos.some(function (v) { return v; })) {
      traces.push({
        x: ejes, y: pptos.map(esc1), name: "Presupuesto", type: "bar",
        marker: { color: "#c8d2cb" },
        customdata: pptos.map(function (v) { return v ? fmtD(v) : "—"; }),
        hovertemplate: "%{x}<br>PPTO: %{customdata} " + unidad + "<extra></extra>"
      });
    }
    window.Plotly.newPlot(elp, traces, {
      barmode: "group", margin: { l: 62, r: 18, t: 22, b: 30 }, height: 260,
      hovermode: "x unified", showlegend: true,
      legend: { orientation: "h", y: -0.18, x: 0, font: { size: 11 } },
      xaxis: { tickfont: { size: 11 }, showgrid: false },
      yaxis: {
        title: { text: "Producción (" + (esGas ? "MSCF" : unidad) + ")", font: { size: 11 } },
        tickfont: { size: 10 }, rangemode: "tozero", separatethousands: true,
        gridcolor: "#eef1ef", zeroline: false
      },
      plot_bgcolor: "#fff", paper_bgcolor: "#fff"
    }, { displayModeBar: false, responsive: true });
  }

  // [2026-09-03 · COMPARACION-PERIODOS] N3P: la serie mensual REAL con la línea del PROGRAMA.
  function __cnCuantSeriePptoHtml(d) {
    if (!d || !d.puntos || !d.puntos.length) return "";
    return __cnPanelMesHtml(d, "cn-seriep-mes");
  }

  function __cnSeriePptoInto(hostEl, d) {
    var pts = d.puntos || [];
    var prod = String(d.producto || "");
    var unidad = d.unidad || "bbl";
    var nombre = prod.charAt(0).toUpperCase() + prod.slice(1).toLowerCase();
    hostEl.innerHTML =
      '<div class="cn-ins__card"><div class="cn-ins__card-hd"><i class="bi bi-graph-up"></i> ' +
      esc(nombre) + ' · real vs programa ' + (d.anio || "") +
      '</div><div class="cn-ins__plot" data-p></div>' +
      '<div class="cn-ins__cap" data-cap></div></div>';
    var elp = hostEl.querySelector("[data-p]");
    if (!pts.length) {
      elp.innerHTML = '<div class="p-2 text-muted small">Sin serie mensual para este producto.</div>';
      return;
    }
    if (!window.Plotly) { elp.innerHTML = '<div class="text-muted small p-2">(Plotly no disponible)</div>'; return; }
    var esGas = String(prod).toUpperCase() === "GAS";
    var fmtD = esGas ? __cnGasM : function (v) { return __cnMilesEC(Math.round(v)); };
    var esc1 = function (v) { return (v == null) ? null : (esGas ? v / 1e6 : v); };
    var col = __cnProdCol(prod);
    var meses = pts.map(function (p) { return p.mes; });
    var traces = [{
      x: meses, y: pts.map(function (p) { return esc1(p.real); }),
      name: "Real", type: "scatter", mode: "lines+markers",
      line: { color: col, width: 2.5, shape: "spline", smoothing: 0.8 },
      marker: { color: col, size: 7 },
      customdata: pts.map(function (p) { return fmtD(p.real); }),
      hovertemplate: "%{x}<br>Real: %{customdata} " + unidad + "<extra></extra>"
    }];
    // `connectgaps:false`: un mes sin presupuesto deja hueco. Unirlo dibujaría una meta que
    // nadie cargó, justo entre los dos meses que sí la tienen.
    if (pts.some(function (p) { return p.ppto != null; })) {
      traces.push({
        x: meses, y: pts.map(function (p) { return esc1(p.ppto); }),
        name: "Programa", type: "scatter", mode: "lines+markers", connectgaps: false,
        line: { color: "#8a978f", width: 2, dash: "dot" },
        marker: { color: "#8a978f", size: 5 },
        customdata: pts.map(function (p) { return p.ppto == null ? "—" : fmtD(p.ppto); }),
        hovertemplate: "%{x}<br>Programa: %{customdata} " + unidad + "<extra></extra>"
      });
    }
    window.Plotly.newPlot(elp, traces, {
      margin: { l: 62, r: 18, t: 22, b: 30 }, height: 260, hovermode: "x unified",
      showlegend: true, legend: { orientation: "h", y: -0.18, x: 0, font: { size: 11 } },
      xaxis: { title: { text: "Mes", font: { size: 11 } }, tickfont: { size: 11 }, showgrid: false },
      yaxis: {
        title: { text: "Producción (" + (esGas ? "MSCF" : unidad) + ")", font: { size: 11 } },
        tickfont: { size: 10 }, rangemode: "tozero", separatethousands: true,
        gridcolor: "#eef1ef", zeroline: false
      },
      plot_bgcolor: "#fff", paper_bgcolor: "#fff"
    }, { displayModeBar: false, responsive: true });
  }

  // Rellena el panel mensual una vez el bloque está en el DOM. Gemela de __cnCompProdCargar
  // (:3300) en el guardián, pero SIN fetch: los datos ya viajan en panel.datos.
  // ⚠️ Ese guardián es imprescindible aunque no haya fetch: si el usuario preguntó y se fue a otra
  // pestaña, __cnStackEnsure() devuelve un DocumentFragment (:2984) y el bloque NO está conectado
  // — Plotly montaría con dimensión 0. Se marca pendiente y :454 lo repinta al volver.
  // El host se busca por CLASE dentro de `blk` (querySelector, nunca getElementById, :1838): hay
  // un solo host por bloque, así que no hace falta el sufijo de __cnStackSeq que sí necesita el
  // panel de día (allí hay un host por foco dentro del mismo bloque).
  function __cnPanelMesCargar(blk, d, tipo) {
    if (!blk.isConnected) {
      blk.dataset.pendPaint = "1";
      blk.__cnMesD = d;
      blk.__cnMesTipo = tipo;
      return;
    }
    __cnPanelMesPintar(blk, d, tipo);
  }

  function __cnPanelMesPintar(blk, d, tipo) {
    if (tipo === "cuant_serie") {
      var hs = blk.querySelector(".cn-serie-mes");
      if (hs) __cnSerieMesInto(hs, d);
    } else if (tipo === "cuant_var") {
      var hv = blk.querySelector(".cn-var-mes");
      if (!hv) return;
      __cnVarMesInto(hv, d);
      // El hover del waterfall se enlaza AQUÍ y no en el constructor: __cnVarMesInto devuelve
      // markup y __cnEbBindHover añade listeners por cada <rect>, o sea toca el DOM. Misma
      // separación que mantiene el resto de la pila (:3368-3371).
      __cnEbBindHover(hv);
    } else if (tipo === "cuant_acum") {
      var ha = blk.querySelector(".cn-acum-mes");
      if (ha) __cnAcumMesInto(ha, d);
    } else if (tipo === "analiza_tend") {
      var ht = blk.querySelector(".cn-tend-mes");
      if (ht) __cnTendMesInto(ht, d);
    } else if (tipo === "cuant_cmp") {
      var hc = blk.querySelector(".cn-cmp-mes");
      if (hc) __cnCmpMesInto(hc, d);
    } else if (tipo === "cuant_serie_ppto") {
      var hp = blk.querySelector(".cn-seriep-mes");
      if (hp) __cnSeriePptoInto(hp, d);
    }
  }

  // [2026-08-25] QV2-PANEL-MES · N4 pasa de lista de texto ("Ene → Feb ▼ -218.586 (-64.3%)") a
  // WATERFALL. Mismo envoltorio y mismo guardián que N3; solo cambia el host y el pintor.
  function __cnCuantVarHtml(d) { return __cnPanelMesHtml(d, "cn-var-mes"); }

  // N5 RANKING (2026-08-04, plan_cuantificar_n5_ranking_2026-08-04.md §5.4). Panel transitorio
  // igual que N1-N4 (HD5). Reusa __cnGasM/__cnMilesEC/esc ya existentes; molde = __cnCuantSerieHtml.
  function __cnCuantRankHtml(d) {
    var esGas = (d.producto === "gas");
    var fmtV = esGas ? function (v) { return __cnGasM(v); } : function (v) { return __cnMilesEC(Math.round(v)); };
    var unidad = d.unidad || "bbl";
    var nivelTxt = (d.nivel_ranking === "activo") ? "Activos" : "Campos";
    var proyChip = d.es_proyeccion ? ' <span class="cn-rank__badge cn-rank__badge--proy">cierre proyectado</span>' : "";
    var items = d.items || [];
    var rows = items.map(function (it) {
      var val = (d.metrica === "gap") ? it.gap : it.valor;
      var signo = (d.metrica === "gap" && it.gap < 0) ? "−" : (d.metrica === "gap" ? "+" : "");
      var op = it.operador ? '<span class="cn-rank__op">' + esc(it.operador) + '</span>' : "";
      var badge = (it.es_ecp === false) ? '<span class="cn-rank__badge">tercero</span>' : "";
      return '<div class="cn-rank__item">' +
        '<span class="cn-rank__pos">' + it.pos + '</span>' +
        '<span class="cn-rank__ent">' + esc(it.entidad) + op + badge + '</span>' +
        '<span class="cn-rank__val">' + signo + fmtV(Math.abs(val)) + ' ' + unidad + '</span></div>';
    }).join("");
    var pie = 'Sobre ' + (d.total_universo || 0) + ' con producción';
    if (d.concentracion_pct != null) { pie += ' · top concentra ' + d.concentracion_pct + '%'; }
    if (d.direccion === "bottom" && d.sin_registro) {
      pie += '<div class="cn-rank__aviso">⚠️ ' + d.sin_registro + ' sin registro REAL este mes (no listados)</div>';
    }
    return '<div class="cn-rank">' +
      '<div class="cn-rank__hd">' + nivelTxt + ' · ' + esc(d.producto || "") + ' · ' +
        esc(d.periodo_label || "") + proyChip + '</div>' +
      rows +
      '<div class="cn-rank__foot">' + pie + '</div>' +
    '</div>';
  }

  // [2026-08-11] Dot plot del ranking de PRODUCCIÓN (Cuantificar N5, metrica=="real"). Las 2
  // variantes por "gap" (mayor faltante/excedente) producen valores NEGATIVOS — el dot plot no
  // sirve para eso — y siguen usando __cnCuantRankHtml de arriba, intacta; la bifurcación es del
  // dispatcher (__cnPintarPanelCuant), por d.metrica.
  // Función PURA (devuelve string, no toca el DOM): emite data-prod en su raíz. La identidad de
  // producto (filete + badge del turno sobre .cn-stk) la inyecta el DISPATCHER leyendo ese
  // atributo DESPUÉS de insertar el HTML — nunca al revés. Dentro de esta función, todo lo que
  // necesita el color del producto lo hereda por var(--cp-prod/-soft/-text), que el dispatcher
  // define sobre el ancestro .cn-stk.
  function __cnRankDotHtml(d) {
    var esGas = (d.producto === "gas");
    var fmtV = esGas ? function (v) { return __cnGasM(v); } : function (v) { return __cnMilesEC(Math.round(v)); };
    var unidad = d.unidad || "bbl";
    var nivelTxt = (d.nivel_ranking === "activo") ? "Activos" : "Campos";
    var proyChip = d.es_proyeccion ? ' <span class="cn-dot__chip">cierre proyectado</span>' : "";
    var items = d.items || [];
    var prodInfo = __cnProdId(d.producto);   // SIEMPRE por el accessor — el producto llega en minúsculas
    var prodIcon = (prodInfo || {}).icon || "circle";
    var prodLbl = d.producto ? (d.producto.charAt(0).toUpperCase() + d.producto.slice(1)) : "";
    // [2026-08-11] El role="img" del resumen vive AQUÍ, en .cn-dot__ctx — no en la raíz .cn-dot.
    // Un role="img" en la raíz OCULTA todo su contenido interno a lectores de pantalla; ya estaba
    // sepultando los aria-label de cada fila del track (defecto preexistente). Al bajarlo aquí, las
    // filas y la dona (ambas fuera de .cn-dot__ctx) quedan accesibles de nuevo, cada una con el suyo.
    var resumenAria = "Top " + items.length + " " + nivelTxt.toLowerCase() + " por producción de " +
      (d.producto || "") + ", " + (d.periodo_label || "");
    var ctx = '<div class="cn-dot__ctx" role="img" aria-label="' + esc(resumenAria) + '">' +
      '<span class="cn-dot__badge"><i class="bi bi-' + prodIcon + '"></i> ' + esc(prodLbl) + '</span>' +
      '<span class="cn-dot__meta">' + nivelTxt + ' · ' + esc(d.periodo_label || "") + proyChip + '</span>' +
      '<span class="cn-dot__unit">' + esc(unidad) + '</span></div>';

    // top_n==1 (spec §6): cifra grande, SIN dot plot. El panel no expone top_n — la señal
    // observable es items.length===1 (_panel_rank no incluye ese campo, ver ranking.py:202-206).
    if (items.length === 1) {
      var it0 = items[0];
      var val0 = (it0.valor != null) ? (fmtV(it0.valor) + ' ' + unidad) : "—";
      return '<div class="cn-dot cn-dot--single" data-prod="' + esc(d.producto || "") + '">' +
        ctx +
        '<div class="cn-dot__single-fig">' + esc(it0.entidad || "") + '</div>' +
        '<div class="cn-dot__single-val">' + val0 + '</div>' +
      '</div>';
    }

    // Escala NORMALIZADA POR TARJETA (spec §4): nunca eje compartido entre productos (bbl y MSCF
    // no son comparables). Guard defensivo: con metrica=="real" el backend ya filtra valor<=0 y
    // devuelve aplica:False si el pool queda vacío (nunca llega aquí) — pero si max<=0 por lo que
    // sea, no se dividen tallos por cero.
    var max = 0;
    items.forEach(function (it) { if (it.valor != null && it.valor > max) max = it.valor; });

    var rows = items.map(function (it) {
      var val = it.valor;
      var w = (max > 0 && val != null) ? Math.max(0, Math.min(100, Math.round(val / max * 100))) : 0;
      // es_ecp tiene TRES estados: true (ECP), false (tercero), null (operador desconocido — TODOS
      // los ítems llegan así cuando nivel_ranking=="activo", el backend no resuelve operador a ese
      // nivel). Solo false pinta el punto hueco; null se pinta SÓLIDO — pintarlo hueco afirmaría
      // "es de un tercero" sin saberlo.
      var esTercero = (it.es_ecp === false);
      var puntoCls = "cn-dot__pt" + (esTercero ? " cn-dot__pt--hollow" : "");
      var sub = esTercero ? '<div class="cn-dot__op">' + esc(it.operador || "") + ' · tercero</div>' : "";
      var valTxt = (val != null) ? (fmtV(val) + ' ' + unidad) : "—";
      var nombre = esc(it.entidad || "");
      var ariaLbl = esc((it.entidad || "") + (val != null ? (": " + valTxt) : ": sin dato"));
      return '<div class="cn-dot__row">' +
        '<div class="cn-dot__name" title="' + nombre + '">' + nombre + sub + '</div>' +
        '<div class="cn-dot__track" role="img" aria-label="' + ariaLbl + '">' +
          '<span class="cn-dot__guide"></span>' +
          (val != null ? ('<span class="cn-dot__stem" style="width:' + w + '%"></span>' +
            '<span class="' + puntoCls + '" style="left:' + w + '%"></span>') : '') +
        '</div>' +
        '<div class="cn-dot__val">' + valTxt + '</div>' +
      '</div>';
    }).join("");

    // Leyenda (D2/H2): oculta si NINGÚN ítem trae es_ecp booleano (ranking por activo → todos
    // null). Mostrarla sin un solo dato real de operador sería ruido sin sustento.
    var hayOperadorConocido = items.some(function (it) { return it.es_ecp === true || it.es_ecp === false; });
    var leyenda = hayOperadorConocido
      ? '<div class="cn-dot__legend">' +
        '<span><i class="cn-dot__pt"></i> Operación propia</span>' +
        '<span><i class="cn-dot__pt cn-dot__pt--hollow"></i> Operado por tercero</span></div>'
      : "";

    // Banda de concentración (H4): d.concentracion_pct llega null cuando direccion=="bottom" — el
    // propio backend lo declara deliberado ("en bottom sería una cifra engañosa"). Oculta banda +
    // pie de banda; JAMÁS se calcula un denominador propio aquí.
    // [2026-08-12] `banda` queda CONSTRUIDA pero FUERA del render (ver el return, abajo): su
    // cifra duplica el centro de la dona. Se conserva el cálculo para poder reactivarla sin
    // rehacerlo. `restantes` (dentro) queda igualmente sin consumir — código muerto deliberado.
    // No hay linter sobre static/js/ (el único eslint.config.js es del frontend React de
    // INGESTA, otro proyecto), así que no rompe ningún gate.
    var banda = "";
    if (d.concentracion_pct != null) {
      var restantes = Math.max(0, (d.total_universo || 0) - items.length);
      banda = '<div class="cn-dot__bandwrap">' +
        '<div class="cn-dot__band"><span style="width:' + d.concentracion_pct + '%"></span></div>' +
        '<div class="cn-dot__bandfoot"><span>Top ' + items.length + ' concentra <b>' +
          String(d.concentracion_pct).replace(".", ",") + '%</b></span>' +
          '<span>' + restantes + ' campos restantes</span></div></div>';
    }

    // Mismo gate que __cnCuantRankHtml (arriba): el backend solo redacta este aviso en el mensaje
    // para bottom+real — se replica la misma condición para no inventar una política nueva.
    var avisoSinReg = (d.direccion === "bottom" && d.sin_registro)
      ? '<div class="cn-dot__aviso">⚠️ ' + d.sin_registro + ' sin registro REAL este mes (no listados)</div>'
      : "";

    // [2026-08-11] Dona de participación (% sobre la producción total), complementaria al dot plot
    // (que da la magnitud en bbl a la izquierda — D2: nunca se le añade %). Solo existe con
    // concentracion_pct válido: el backend lo pone null en "bottom" a propósito ("sería una cifra
    // engañosa") y ahí NO HAY denominador. items.length>=2 ya está garantizado aquí (el caso ===1
    // devolvió antes). Si __cnDonaHtml igual devuelve "" (su propio guard defensivo), se degrada
    // con gracia al layout de una sola columna — la tarjeta queda como hoy.
    var pintarDona = (d.direccion === "top" && d.concentracion_pct != null && d.concentracion_pct > 0);
    var donaHtml = pintarDona
      ? __cnDonaHtml(items, d.concentracion_pct, d.total_universo, prodInfo ? prodInfo.color : "#6E7C75")
      : "";
    // .cn-dot__rowswrap es OBLIGATORIO cuando hay dona: sin él, cada .cn-dot__row (ya es su propio
    // grid de 3 columnas) quedaría como hijo DIRECTO del grid de 2 columnas .cn-dot__cols y el
    // layout se rompe. Sin dona, `rows` se usa tal cual (cero cambios respecto a hoy).
    var rowsBlock = donaHtml
      ? ('<div class="cn-dot__cols"><div class="cn-dot__rowswrap">' + rows + '</div>' + donaHtml + '</div>')
      : rows;

    // [2026-08-12] Sin `banda`: decía "Top 5 concentra 41,2%", el MISMO número que ya ocupa el
    // centro de la dona. El conteo del universo NO se pierde — sigue declarado en .cn-dot__foot
    // ("N campos con producción registrada"), que es lo que sostiene sobre cuántos se rankea.
    return '<div class="cn-dot" data-prod="' + esc(d.producto || "") + '">' +
      ctx + rowsBlock + leyenda +
      '<div class="cn-dot__foot">' + (d.total_universo || 0) + ' ' + nivelTxt.toLowerCase() +
        ' con producción registrada · Motor V2 · Cuantificar</div>' +
      avisoSinReg +
    '</div>';
  }

  // [2026-08-13] Tarjeta P50 por VICEPRESIDENCIA (Analizar/referencia, panel "p50_vp"). Función
  // PURA, SVG nativo — mismo patrón que __cnRankDotHtml. plan_panel_p50_vp_2026-08-13.md.
  // 🔑 H4: `d.producto` llega en MINÚSCULAS (frontera de conversión ÚNICA en el backend); SIEMPRE
  // por __cnProdId (nunca __CP_PROD directo). Los valores (real/p50/serie) llegan CRUDOS — el
  // ÷1e6 del gas lo hace __cnGasM aquí, no el backend (pre-dividir dividiría dos veces).
  var __cnMesLargo = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre"];
  function __cnMesLargoDe(iso) {
    var p = String(iso || "").split("-");
    return (p.length === 3) ? (__cnMesLargo[parseInt(p[1], 10) - 1] || "") : "";
  }

  function __cnP50VpHtml(d) {
    // 🔑 [2026-08-13] La hoja del P50 (NEW MES-AÑO t8/t2) NO está en la escala del fact operativo:
    // es el mundo P50 corporativo (promedio diario en unidades equivalentes). Medido contra la BD:
    // el gas de esa hoja suma 75.974 donde el fact suma 66.663.907 — ratio ~29, NO 1e6. Aplicarle
    // __cnGasM mostraba «0,03» en vez de «33.453,2», mil veces menor y sin error visible.
    // El backend lo marca con fmt:"vp" -> cifra TAL CUAL, es-CO con 1 decimal.
    var esVp = (d.fmt === "vp");
    var esGas = (d.producto === "gas");
    var fmtV = esVp
      ? function (v) { return Number(v).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
      : (esGas ? function (v) { return __cnGasM(v); } : function (v) { return __cnMilesEC(Math.round(v)); });
    var unidad = d.unidad || "bbl";
    var prodInfo = __cnProdId(d.producto);   // accessor obligatorio (H4) — d.producto en minúsculas
    var prodLbl = d.producto ? (d.producto.charAt(0).toUpperCase() + d.producto.slice(1)) : "";
    var serie = d.serie || [];

    // Chip de estado por cumplimiento (mismo umbral que las tarjetas del artifact corporativo).
    var pct = d.pct;
    var chipCls = "cn-p50vp__chip--par", chipTxt = "≈ En el P50";
    if (pct != null) {
      if (pct < 99.95) { chipCls = "cn-p50vp__chip--bajo"; chipTxt = "▼ Bajo el P50"; }
      else if (pct > 100.05) { chipCls = "cn-p50vp__chip--sobre"; chipTxt = "▲ Sobre el P50"; }
    }

    // --- SVG: polilínea P50 (gris, NO plana — R3 del plan) + polilínea REAL (verde, se corta en
    // el último mes con dato — A2: no se interpola ni se rellena con 0). Escala Y por ESTA serie.
    var W = 320, H = 150, padL = 46, padR = 8, padT = 12, padB = 26;
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var vals = [];
    serie.forEach(function (p) {
      if (p.p50 != null) vals.push(p.p50);
      if (p.real != null) vals.push(p.real);
    });
    var vmin = vals.length ? Math.min.apply(null, vals) : 0;
    var vmax = vals.length ? Math.max.apply(null, vals) : 1;
    if (vmax === vmin) { vmax += 1; vmin -= 1; }   // guard: serie plana no divide por cero
    var margen = (vmax - vmin) * 0.08;
    vmin -= margen; vmax += margen;
    var n = serie.length || 1;
    function xAt(i) { return padL + (n <= 1 ? 0 : (i / (n - 1)) * innerW); }
    function yAt(v) { return padT + innerH - ((v - vmin) / (vmax - vmin)) * innerH; }

    var p50Pts = serie.map(function (p, i) { return xAt(i) + "," + yAt(p.p50); }).join(" ");
    // El trazo REAL se corta en el último punto con dato — se construye solo con los puntos
    // consecutivos desde el inicio que SÍ tienen real (A2: nunca hay huecos internos, el corte es
    // siempre al final de la serie, pero el guard cubre el caso general sin asumirlo).
    var realPts = [];
    for (var i = 0; i < serie.length; i++) {
      if (serie[i].real == null) break;
      realPts.push(xAt(i) + "," + yAt(serie[i].real));
    }
    var ultimoIdx = realPts.length - 1;
    var corteX = ultimoIdx >= 0 ? xAt(ultimoIdx) : padL;

    // Ejes: hasta 5 marcas de mes (ene/mar/may/jul/oct/dic según longitud), usando __cnMesAbr.
    var ejeIdx = [];
    if (n > 0) {
      var pasoEje = Math.max(1, Math.round((n - 1) / 4));
      for (var k = 0; k < n; k += pasoEje) ejeIdx.push(k);
      if (ejeIdx[ejeIdx.length - 1] !== n - 1) ejeIdx.push(n - 1);
    }
    var ejeLbls = ejeIdx.map(function (i) {
      var mIdx = parseInt(String(serie[i].fecha).split("-")[1], 10) - 1;
      return '<text x="' + xAt(i) + '" y="' + (H - 8) + '" text-anchor="middle" class="cn-p50vp__axtx">' +
        (__cnMesAbr[mIdx] || "") + '</text>';
    }).join("");

    var mesRealTxt = __cnMesLargoDe(d.mes_real);
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="cn-p50vp__svg" role="img" ' +
      'aria-label="' + esc(prodLbl + ": real " + fmtV(d.real) + " " + unidad + " vs P50 " +
        fmtV(d.p50) + " " + unidad + " en " + mesRealTxt) + '">' +
      '<line x1="' + corteX + '" y1="' + padT + '" x2="' + corteX + '" y2="' + (H - padB) +
        '" class="cn-p50vp__cortevert"/>' +
      '<text x="' + (corteX + 4) + '" y="' + (padT + 8) + '" class="cn-p50vp__cortetxt">corte ' +
        (__cnMesAbr[parseInt(String(d.mes_real).split("-")[1], 10) - 1] || "") + '</text>' +
      '<polyline points="' + p50Pts + '" class="cn-p50vp__linea-p50"/>' +
      (realPts.length ? '<polyline points="' + realPts.join(" ") + '" class="cn-p50vp__linea-real"/>' : "") +
      (ultimoIdx >= 0 ? '<circle cx="' + corteX + '" cy="' + yAt(serie[ultimoIdx].real) +
        '" r="3.5" class="cn-p50vp__punto"/>' : "") +
      ejeLbls +
    '</svg>';

    return '<div class="cn-p50vp" data-prod="' + esc(d.producto || "") + '">' +
      '<div class="cn-p50vp__hd">' +
        '<span class="cn-p50vp__name">' + esc(prodLbl) + '</span>' +
        '<span class="cn-p50vp__chip ' + chipCls + '">' + chipTxt + '</span>' +
      '</div>' +
      '<div class="cn-p50vp__big">' + fmtV(d.real) + ' <span class="cn-p50vp__unit">' +
        esc(unidad) + ' · real ' + esc(mesRealTxt) + '</span></div>' +
      svg +
      '<div class="cn-p50vp__foot">' +
        '<div class="cn-p50vp__kv"><span>Real ' + esc(mesRealTxt) + '</span><b>' + fmtV(d.real) + '</b></div>' +
        '<div class="cn-p50vp__kv"><span>Base P50 ' + esc(mesRealTxt) + '</span><b>' + fmtV(d.p50) + '</b></div>' +
        '<div class="cn-p50vp__kv"><span>Cumplimiento</span><b class="' +
          (pct != null && pct < 100 ? "cn-p50vp__neg" : "cn-p50vp__pos") + '">' +
          (pct != null ? String(pct).replace(".", ",") + '%' : '—') + '</b></div>' +
        '<div class="cn-p50vp__kv"><span>Brecha vs P50</span><b class="' +
          (d.gap != null && d.gap < 0 ? "cn-p50vp__neg" : "cn-p50vp__pos") + '">' +
          (d.gap != null ? (d.gap >= 0 ? "+" : "−") + fmtV(Math.abs(d.gap)) : '—') + '</b></div>' +
      '</div>' +
      '<div class="cn-p50vp__note">Vicepresidencia ' + esc(d.vice || "") + ' · corte del reporte ' +
        esc(d.corte || "") + ' · sin real por vicepresidencia después de ' + esc(mesRealTxt) + '</div>' +
    '</div>';
  }

  // [2026-08-11] Dona de PARTICIPACIÓN (top N + "Otros"), en % sobre la producción total. SVG
  // nativo (mismo mecanismo que __cnRing: stroke-dasharray + rotate, sin librerías). Función PURA.
  // Las participaciones se derivan así: p_i = (valor_i / Σvisibles) * concentracion_pct — usa la
  // suma EXACTA de los ítems visibles (no una estimación) escalada por el % ya redondeado que
  // entrega el backend, de modo que Σ(p_i) + otros_pct == 100 SIEMPRE, sin arrastrar error propio.
  // PROHIBIDO mostrar el total o "Otros" en bbl: concentracion_pct viene redondeado a 1 decimal ->
  // el total de producción derivado tiene ±0,22% de banda (verificado con datos reales) — sería
  // falsa precisión. Solo se muestran % y CONTEO de campos (total_universo = nº de campos, no bbl).
  function __cnDonaHtml(items, concPct, totalCampos, prodColor) {
    // El backend nunca puede dar >100 (conc = Σtop / Σcon_real, y top ⊆ con_real), pero el clamp
    // cuesta una línea y evita que un cambio futuro rompa la geometría en silencio: sin él, los
    // arcos sumarían más que la circunferencia y se solaparían, con la leyenda marcando 105%.
    var pct = Math.min(100, Number(concPct));
    if (!(pct > 0)) return "";
    var totalVisible = 0;
    items.forEach(function (it) { if (it.valor != null) totalVisible += it.valor; });
    if (!(totalVisible > 0)) return "";
    var otrosPct = Math.max(0, 100 - pct);   // DIRECTO desde concPct — nunca derivado de un volumen
    var opac = [1, 0.85, 0.70, 0.57, 0.45];   // spec §9: opacidades del mismo --pc, no colores nuevos
    // [2026-08-12] Dona a tamaño pleno (130→180): al repartirse la tarjeta 50-50, el círculo
    // de 130 flotaba en una columna que le sobraba. A 180 ocupa su mitad y los arcos de los
    // campos chicos (≈6%) se distinguen como segmentos propios. r y sw crecen en proporción
    // (sw/r pasa de 0,385 a 0,389 — mismo grosor relativo). circ se DERIVA de r, así que los
    // dasharray del bucle de arcos siguen cerrando en 100% exacto sin tocar una sola línea.
    var size = 180, r = 72, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r, sw = 28;
    var acc = 0, arcs = "", legend = "", ariaParts = [];
    items.forEach(function (it, i) {
      var p = (it.valor != null) ? (it.valor / totalVisible * pct) : 0;
      var dash = (circ * p / 100).toFixed(2) + " " + circ.toFixed(2);
      var offset = (-acc / 100 * circ).toFixed(2);
      var alpha = (opac[i] != null) ? opac[i] : opac[opac.length - 1];
      arcs += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + prodColor +
        '" stroke-opacity="' + alpha + '" stroke-width="' + sw + '" stroke-dasharray="' + dash +
        '" stroke-dashoffset="' + offset + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"></circle>';
      acc += p;
      var pTxt = p.toFixed(1).replace(".", ",");
      var nombre = esc(it.entidad || "");
      legend += '<div class="cn-dona__leg-row">' +
        '<span class="cn-dona__sw" style="background:' + prodColor + ';opacity:' + alpha + '"></span>' +
        '<span class="cn-dona__leg-name" title="' + nombre + '">' + nombre + '</span>' +
        '<span class="cn-dona__leg-pct">' + pTxt + '%</span></div>';
      ariaParts.push((it.entidad || "") + " " + pTxt + "%");
    });
    if (otrosPct > 0) {
      var dashO = (circ * otrosPct / 100).toFixed(2) + " " + circ.toFixed(2);
      var offsetO = (-acc / 100 * circ).toFixed(2);
      arcs += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#D8DCD9" ' +
        'stroke-width="' + sw + '" stroke-dasharray="' + dashO + '" stroke-dashoffset="' + offsetO +
        '" transform="rotate(-90 ' + cx + ' ' + cy + ')"></circle>';
      var otrosCampos = Math.max(0, (totalCampos || 0) - items.length);
      var otrosTxt = otrosPct.toFixed(1).replace(".", ",");
      legend += '<div class="cn-dona__leg-row">' +
        '<span class="cn-dona__sw cn-dona__sw--otros"></span>' +
        '<span class="cn-dona__leg-name">Otros (' + otrosCampos + ' campos)</span>' +
        '<span class="cn-dona__leg-pct">' + otrosTxt + '%</span></div>';
      ariaParts.push("otros " + otrosCampos + " campos " + otrosTxt + "%");
    }
    var centroTxt = pct.toFixed(1).replace(".", ",");
    var ariaLbl = "Participación sobre la producción total: " + ariaParts.join(", ");
    return '<div class="cn-dona">' +
      '<div class="cn-dona__hd">Participación · % de la producción total</div>' +
      '<svg class="cn-dona__svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size +
        '" role="img" aria-label="' + esc(ariaLbl) + '">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#EEF1EF" stroke-width="' + sw + '"></circle>' +
        arcs +
        '<text x="' + cx + '" y="' + (cy - 5) + '" text-anchor="middle" dominant-baseline="central" ' +
          'font-size="27" font-weight="800" fill="#17241E">' + centroTxt + '%</text>' +
        '<text x="' + cx + '" y="' + (cy + 19) + '" text-anchor="middle" dominant-baseline="central" ' +
          'font-size="11" font-weight="700" letter-spacing="0.8" fill="#98A69E">TOP ' + items.length + '</text>' +
      '</svg>' +
      '<div class="cn-dona__legend">' + legend + '</div>' +
    '</div>';
  }

  // [2026-08-25] Panel del grupo JERARQUIZAR — árbol con conectores (rediseño de
  // plan_jerarquia_arbol_conectores_2026-08-25.md, sustituye el listado plano por padding-left
  // inline). Los constructores son PUROS (devuelven string), mismo patrón que los
  // __cnCuant*Html de arriba. __cnJerRankHtml (más abajo) es panel aparte y no se toca.
  //
  // `abbr` va en el chip mono; `label` completo va al lector de pantalla (.jq-vh) y a los
  // títulos de grupo. "operador" NO está aquí a propósito: no es un nivel de la jerarquía.
  var __CN_JER_NIV = {
    vicepresidencia: {label: "Vicepresidencia", abbr: "VP",  icon: "diagram-3-fill"},
    gerencia:        {label: "Gerencia",        abbr: "GER", icon: "buildings-fill"},
    activo:          {label: "Activo",          abbr: "ACT", icon: "layers-fill"},
    campo:           {label: "Campo",           abbr: "CMP", icon: "geo-alt-fill"},
    pozo:            {label: "Pozo",            abbr: "POZ", icon: "record-circle"}
  };
  function __cnJerNiv(k) {
    return __CN_JER_NIV[k] || {label: String(k || ""), abbr: String(k || "").slice(0,3).toUpperCase(),
                               icon: "dot"};
  }

  // Nodo del árbol: `depth` rieles de 20px + cuerpo. El último riel es el CODO (is-elbow);
  // si el nodo es el último de su grupo, el codo se corta a media altura (is-last → "└").
  // aria-level = depth+1. Los rieles son decorativos (aria-hidden).
  function __cnJerNodoHtml(nivel, valor, opts) {
    opts = opts || {};
    var L = __cnJerNiv(nivel), depth = opts.depth || 0, rails = "";
    for (var i = 0; i < depth; i++) {
      var cls = "jq-rail";
      if (i === depth - 1) { cls += " is-elbow"; if (opts.last) cls += " is-last"; }
      rails += '<span class="' + cls + '" aria-hidden="true"></span>';
    }
    var tile = opts.focus ? "is-focus" : (opts.leaf ? "is-leaf" : "");
    var count = (opts.count != null)
      ? '<span class="jq-node__count">' + opts.count + '</span>' : "";
    var badge = opts.focus
      ? '<span class="jq-node__badge">CONSULTADO</span>' : "";
    return '<div class="jq-node" role="treeitem" aria-level="' + (depth + 1) + '">' + rails +
      '<div class="jq-node__body">' +
        '<span class="jq-node__tile ' + tile + '" aria-hidden="true">' +
          '<i class="bi bi-' + L.icon + '"></i></span>' +
        '<span class="jq-node__abbr" aria-hidden="true">' + esc(L.abbr) + '</span>' +
        '<span class="jq-vh">' + esc(L.label) + '</span>' +
        '<span class="jq-node__value ' + (opts.focus ? "is-focus" : "") + '" title="' +
          esc(valor) + '">' + esc(valor) + '</span>' +
        count + badge +
      '</div></div>';
  }

  // Encabezado de un grupo de hijos: "CAMPOS (2)" + regla horizontal. `es_hermanos` conserva
  // el texto especial de antes — el usuario preguntó por un campo y se listan sus pares.
  function __cnJerGrupoHtml(g, first) {
    var L = __cnJerNiv(g.nivel);
    var txt = g.es_hermanos
      ? "Otros campos del mismo Activo"
      : L.label + (g.total === 1 ? "" : "s") + (g.total != null ? " (" + g.total + ")" : "");
    return '<div class="jq-group' + (first ? " is-first" : "") + '">' +
      '<span class="jq-group__label">' + esc(txt) + '</span>' +
      '<span class="jq-group__rule" aria-hidden="true"></span></div>';
  }

  // §8: sin dato de pozos NO se muestra "0" — se oculta el pie. `pozos` llega null cuando
  // robustez_v02 no está disponible (p.ej. el servidor 139): el árbol debe seguir íntegro.
  function __cnJerPieHtml(pozos) {
    if (pozos == null) return "";
    var n = Number(pozos);
    var fmt = isFinite(n) ? n.toLocaleString("es-CO") : String(pozos);
    return '<div class="jq-foot">' +
      '<i class="bi bi-record-circle" aria-hidden="true"></i>' +
      '<span class="jq-foot__label">Pozos asociados</span>' +
      '<span class="jq-foot__value">' + esc(fmt) + '</span></div>';
  }

  // ---------------------------------------------------------------------------
  // [2026-08-25] QV2-MAPA · Mapa de pozos del panel de Jerarquizar.
  // Traducción de la maqueta aprobada (artifact f0cee978). Canvas y no Plotly: son miles
  // de puntos y un scatter de Plotly con esa cardinalidad va notablemente más lento; el
  // dibujo aquí es un arc() por punto sin interacción por elemento.
  //
  // 🔒 El frontend NO aplica NINGUNA regla geográfica: los puntos llegan ya deduplicados
  //    (H1), con lon/lat ya corregidos (H2) y ya filtrados (H3) desde pozos_geo.py.
  // ---------------------------------------------------------------------------
  var __JM_MIN = 1, __JM_MAX = 14, __JM_MARGEN = 8;
  var __JM_DEF = 3.2;        // zoom de apertura: el campo y sus vecinos de cuenca
  var __jmCache = {};        // "entidad|nivel" -> payload del endpoint

  function __jmEstado(box) {
    // Cada mapa guarda su estado en el propio nodo: en la pila puede haber varios paneles
    // vivos a la vez y un estado global los mezclaría.
    if (!box.__jm) {
      box.__jm = {vista: "pais", d: null,
                  zoom: {pais: {k: 1, tx: 0, ty: 0}, campo: {k: 1, tx: 0, ty: 0}},
                  pintados: [], arrastre: null};
    }
    return box.__jm;
  }

  // Escala IGUAL en ambos ejes o la silueta sale deformada. El zoom se aplica DESPUÉS del
  // encuadre base y alrededor del centro, para que k=1 sea siempre la vista completa.
  function __jmProy(x0, x1, y0, y1, W, H, pad, z) {
    var ew = x1 - x0, eh = y1 - y0;
    var s = Math.min((W - pad * 2) / ew, (H - pad * 2) / eh);
    var ox = (W - ew * s) / 2, oy = (H - eh * s) / 2, cx = W / 2, cy = H / 2;
    return {
      k: z.k,
      X: function (lon) { return cx + ((ox + (lon - x0) * s) - cx) * z.k + z.tx; },
      Y: function (lat) { return cy + ((H - (oy + (lat - y0) * s)) - cy) * z.k + z.ty; }
    };
  }

  function __jmLienzo(box) {
    var cv = box.querySelector(".jm__cv"), host = box.querySelector(".jm__lienzo");
    var r = host.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var W = Math.max(10, r.width), H = Math.max(10, r.height);
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    return {ctx: ctx, W: W, H: H, cv: cv};
  }

  function __jmVar(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function __jmPintaPais(box) {
    var st = __jmEstado(box), d = st.d, g = __jmLienzo(box), ctx = g.ctx;
    st.pintados = [];
    var COL = d.colombia, lons = [], lats = [];
    COL.forEach(function (p) { lons.push(p[0]); lats.push(p[1]); });
    var P = __jmProy(Math.min.apply(null, lons), Math.max.apply(null, lons),
                     Math.min.apply(null, lats), Math.max.apply(null, lats),
                     g.W, g.H, 14, st.zoom.pais);
    ctx.beginPath();
    COL.forEach(function (p, i) {
      i ? ctx.lineTo(P.X(p[0]), P.Y(p[1])) : ctx.moveTo(P.X(p[0]), P.Y(p[1]));
    });
    ctx.closePath();
    ctx.fillStyle = __jmVar("--rb-green-softer") || "#f1f9f4"; ctx.fill();
    // Contorno en verde oscuro (decisión del usuario): es el borde del país, la referencia
    // que ancla todo. El trazo NO escala con el zoom — a 10x taparía la costa.
    ctx.strokeStyle = __jmVar("--rb-green") || "#0e5c3a"; ctx.lineWidth = 1.6; ctx.stroke();

    var campos = d.campos || [], mx = 0;
    campos.forEach(function (c) { if (c.n > mx) mx = c.n; });
    var oro = __jmVar("--rb-chat-gold") || "#C9962E";
    var vd = __jmVar("--rb-green-mid") || "#15794c";
    var kr = Math.sqrt(P.k);   // radio amortiguado: lineal se comería el mapa al acercar
    var foco = __jmFoco(d);
    campos.forEach(function (c) {
      var es = (c.f === foco), rad = (2.2 + Math.sqrt(c.n / mx) * 9) * kr;
      var sx = P.X(c.lon), sy = P.Y(c.lat);
      st.pintados.push({sx: sx, sy: sy, r: Math.max(rad, 5),
                        txt: c.f + " · " + c.n.toLocaleString("es-CO") + " pozos"});
      ctx.beginPath(); ctx.arc(sx, sy, rad, 0, 6.2832);
      ctx.fillStyle = es ? oro : vd; ctx.globalAlpha = es ? 0.95 : 0.32; ctx.fill();
      ctx.globalAlpha = 1;
      // SOLO se rotula el campo consultado (decisión del usuario): en el Meta y el
      // Magdalena hay decenas de campos a pocos km y nombrarlos todos tapaba el que importa.
      if (es) {
        ctx.beginPath(); ctx.arc(sx, sy, rad + 4.5, 0, 6.2832);
        ctx.strokeStyle = oro; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.font = '700 11.5px ui-monospace, Menlo, Consolas, monospace';
        ctx.textAlign = "center";
        ctx.lineWidth = 3.5; ctx.strokeStyle = "#f6f8f7";   // halo: cae sobre otros círculos
        ctx.strokeText(c.f, sx, sy - rad - 9);
        ctx.fillStyle = "#1A2A24"; ctx.fillText(c.f, sx, sy - rad - 9);
      }
    });
    box.querySelector(".jm__t").textContent =
      "Ubicación en Colombia · " + (d.total || 0).toLocaleString("es-CO") + " pozos";
  }

  // El campo a resaltar: si la entidad es un campo, ella misma; si es activo/gerencia/VP,
  // el de más pozos entre los suyos (los demás siguen visibles en verde).
  function __jmFoco(d) {
    if (d.nivel === "campo") return d.entidad;
    var mejor = null, n = -1, dentro = {};
    (d.pozos || []).forEach(function () {});   // los pozos no traen field: se usa contornos/campos
    (d.campos || []).forEach(function (c) { dentro[c.f] = c.n; });
    Object.keys(d.contornos || {}).forEach(function (f) {
      if (dentro[f] != null && dentro[f] > n) { n = dentro[f]; mejor = f; }
    });
    return mejor || d.entidad;
  }

  function __jmPintaCampo(box) {
    var st = __jmEstado(box), d = st.d, g = __jmLienzo(box), ctx = g.ctx;
    st.pintados = [];
    var pts = d.pozos || [], xs = [], ys = [];
    pts.forEach(function (p) { xs.push(p.lon); ys.push(p.lat); });
    var polys = [];
    Object.keys(d.contornos || {}).forEach(function (f) {
      polys.push(d.contornos[f]);
      d.contornos[f].forEach(function (v) { xs.push(v[0]); ys.push(v[1]); });
    });
    if (!xs.length) { box.querySelector(".jm__t").textContent = "Sin pozos ubicables"; return; }
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var mx = (x1 - x0) * 0.10 || 0.01, my = (y1 - y0) * 0.10 || 0.01;
    var P = __jmProy(x0 - mx, x1 + mx, y0 - my, y1 + my, g.W, g.H, 16, st.zoom.campo);

    polys.forEach(function (poly) {
      if (poly.length < 2) return;
      ctx.beginPath();
      poly.forEach(function (v, i) {
        i ? ctx.lineTo(P.X(v[0]), P.Y(v[1])) : ctx.moveTo(P.X(v[0]), P.Y(v[1]));
      });
      ctx.closePath();   // se cierra AQUÍ: 10 de los 15 polígonos no cierran en la BD (H7)
      ctx.fillStyle = __jmVar("--rb-green-soft") || "#e6f4ec";
      ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = __jmVar("--rb-green-mid") || "#15794c"; ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    });
    // TODOS los puntos IGUALES (decisión del usuario): la tabla tiene grano de zona y 3.780
    // pozos aparecen ACT en una zona e INACT en otra — colorear exigiría una regla de
    // negocio que aún no está definida. Un pozo = un punto, sin afirmar de más.
    var rp = 3.1 * Math.sqrt(P.k);
    ctx.fillStyle = __jmVar("--rb-green-mid") || "#15794c"; ctx.globalAlpha = 0.82;
    pts.forEach(function (p) {
      var sx = P.X(p.lon), sy = P.Y(p.lat);
      st.pintados.push({sx: sx, sy: sy, r: Math.max(rp, 5), txt: p.uwi});
      ctx.beginPath(); ctx.arc(sx, sy, rp, 0, 6.2832); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // [2026-08-25] Sin "· sin contorno": no se destaca lo que falta (el polígono es un
    // adorno cuando existe, 15 de 118 campos lo tienen) -- el título solo informa lo que sí hay.
    box.querySelector(".jm__t").textContent =
      pts.length.toLocaleString("es-CO") + " de " + (d.total || 0).toLocaleString("es-CO") +
      " pozos";
  }

  function __jmPinta(box) {
    var st = __jmEstado(box);
    if (!st.d) return;
    (st.vista === "pais" ? __jmPintaPais : __jmPintaCampo)(box);
    __jmUI(box);
  }

  function __jmUI(box) {
    var st = __jmEstado(box), z = st.zoom[st.vista];
    var pct = box.querySelector(".jm__pct");
    if (pct) pct.textContent = Math.round(z.k * 100) + "%";
    box.querySelector(".jm__lienzo").style.cursor = z.k > 1 ? "grab" : "default";
  }

  // Encuadre de apertura: centrado y acercado sobre el campo consultado (decisión del
  // usuario). Se pinta una vez a k=1 para conocer su posición base y se resuelve el
  // desplazamiento que lo lleva al centro — así vale para cualquier campo, no solo dos.
  function __jmEncuadra(box) {
    var st = __jmEstado(box), z = st.zoom.pais;
    z.k = 1; z.tx = 0; z.ty = 0;
    __jmPintaPais(box);
    var foco = __jmFoco(st.d), mio = null;
    for (var i = 0; i < st.pintados.length; i++) {
      if (st.pintados[i].txt.indexOf(foco + " ·") === 0) { mio = st.pintados[i]; break; }
    }
    if (!mio) return;
    var r = box.querySelector(".jm__cv").getBoundingClientRect();
    z.k = __JM_DEF;
    z.tx = -(mio.sx - r.width / 2) * __JM_DEF;
    z.ty = -(mio.sy - r.height / 2) * __JM_DEF;
  }

  function __jmZoom(box, nk, px, py) {
    var st = __jmEstado(box), z = st.zoom[st.vista];
    nk = Math.max(__JM_MIN, Math.min(__JM_MAX, nk));
    if (nk === z.k) return;
    if (px != null) {
      // El punto bajo el cursor se queda QUIETO. La proyección escala respecto al CENTRO:
      //   S = c + (B-c)*k + t   =>   t' = t + (S - c - t)*(1 - k'/k)
      // Compensar sobre el origen en vez del centro desplaza el mapa (verificado).
      var r = box.querySelector(".jm__cv").getBoundingClientRect();
      var f = 1 - nk / z.k;
      z.tx += (px - r.width / 2 - z.tx) * f;
      z.ty += (py - r.height / 2 - z.ty) * f;
    }
    z.k = nk;
    if (z.k === 1) { z.tx = 0; z.ty = 0; }
    __jmPinta(box);
  }

  // Carga asíncrona: mismo patrón que __cnCompProdCargar (H4).
  function __cnJerMapaCargar(blk) {
    var box = blk.querySelector(".jm");
    if (!box) return;
    var ent = box.getAttribute("data-entidad"), niv = box.getAttribute("data-nivel");
    var key = ent + "|" + niv;
    var carga = box.querySelector(".jm__carga");
    var p = __jmCache[key] ? Promise.resolve(__jmCache[key]) :
      fetch("/api/consulta2/pozos_geo?entidad=" + encodeURIComponent(ent) +
            "&nivel=" + encodeURIComponent(niv))
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.disponible) __jmCache[key] = d; return d; });
    p.then(function (d) {
      if (!d || !d.disponible || !(d.pozos || []).length) {
        // Degradación con gracia: sin robustez_v02 o sin pozos ubicables se retira el mapa
        // y el árbol se queda con todo el ancho. NUNCA un panel roto.
        var split = blk.querySelector(".jq-split");
        if (split) split.classList.add("is-solo");
        return;
      }
      var st = __jmEstado(box);
      st.d = d;
      if (carga) carga.remove();
      __jmEncuadra(box);
      __jmPinta(box);
    }).catch(function () {
      var split = blk.querySelector(".jq-split");
      if (split) split.classList.add("is-solo");
    });
  }

  // Delegación en document (los paneles nacen y mueren con la pila; un listener por nodo
  // moriría con él). Todos los handlers salen si el clic no cae dentro de un .jm.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || typeof t.closest !== "function") return;
    var box = t.closest(".jm");
    if (!box) return;
    var zb = t.closest(".jm__zb");
    if (zb) {
      box.querySelectorAll(".jm__zb").forEach(function (o) { o.classList.remove("is-on"); });
      zb.classList.add("is-on");
      var st = __jmEstado(box);
      st.vista = zb.getAttribute("data-z");
      // Volver a "Colombia" reencuadra sobre el campo, igual que al abrir: devolver el país
      // entero obligaría a buscar el punto otra vez.
      if (st.vista === "pais") __jmEncuadra(box);
      __jmPinta(box);
      return;
    }
    var zc = t.closest(".jm__zc");
    if (zc) {
      var a = zc.getAttribute("data-a"), s2 = __jmEstado(box), z = s2.zoom[s2.vista];
      var r = box.querySelector(".jm__cv").getBoundingClientRect();
      if (a === "reset") { s2.zoom[s2.vista] = {k: 1, tx: 0, ty: 0}; __jmPinta(box); }
      else __jmZoom(box, z.k * (a === "mas" ? 1.5 : 1 / 1.5), r.width / 2, r.height / 2);
    }
  });

  document.addEventListener("wheel", function (e) {
    var t = e.target;
    if (!t || typeof t.closest !== "function") return;
    var box = t.closest(".jm__lienzo");
    if (!box) return;
    box = box.closest(".jm");
    if (!box || !__jmEstado(box).d) return;
    e.preventDefault();
    var r = box.querySelector(".jm__cv").getBoundingClientRect();
    __jmZoom(box, __jmEstado(box).zoom[__jmEstado(box).vista].k * (e.deltaY < 0 ? 1.18 : 1 / 1.18),
             e.clientX - r.left, e.clientY - r.top);
  }, {passive: false});

  document.addEventListener("mousedown", function (e) {
    var t = e.target;
    if (!t || typeof t.closest !== "function") return;
    var box = t.closest(".jm");
    if (!box || t.closest(".jm__zc") || t.closest(".jm__zb")) return;
    var st = __jmEstado(box);
    if (st.zoom[st.vista].k <= 1) return;
    st.arrastre = {x: e.clientX, y: e.clientY,
                   tx: st.zoom[st.vista].tx, ty: st.zoom[st.vista].ty};
    box.querySelector(".jm__lienzo").style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", function (e) {
    var t = e.target;
    if (!t || typeof t.closest !== "function") return;
    var box = t.closest(".jm");
    if (!box) return;
    var st = __jmEstado(box);
    if (!st.d) return;
    if (st.arrastre) {
      var z = st.zoom[st.vista];
      z.tx = st.arrastre.tx + (e.clientX - st.arrastre.x);
      z.ty = st.arrastre.ty + (e.clientY - st.arrastre.y);
      box.querySelector(".jm__tip").classList.remove("is-on");
      __jmPinta(box);
      return;
    }
    var r = box.querySelector(".jm__cv").getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top, best = null, bd = Infinity;
    for (var i = 0; i < st.pintados.length; i++) {
      var p = st.pintados[i], dx = p.sx - mx, dy = p.sy - my, d2 = dx * dx + dy * dy;
      if (d2 < p.r * p.r * 2.6 && d2 < bd) { bd = d2; best = p; }
    }
    var tip = box.querySelector(".jm__tip");
    if (best) {
      tip.textContent = best.txt;
      tip.style.left = best.sx + "px"; tip.style.top = best.sy + "px";
      tip.classList.add("is-on");
    } else tip.classList.remove("is-on");
  });

  document.addEventListener("mouseup", function () {
    document.querySelectorAll(".jm").forEach(function (box) {
      var st = box.__jm;
      if (!st || !st.arrastre) return;
      st.arrastre = null;
      box.querySelector(".jm__lienzo").style.cursor = st.zoom[st.vista].k > 1 ? "grab" : "default";
    });
  });

  var __jmTmr = null;
  window.addEventListener("resize", function () {
    clearTimeout(__jmTmr);
    __jmTmr = setTimeout(function () {
      document.querySelectorAll(".jm").forEach(function (box) {
        if (box.__jm && box.__jm.d) __jmPinta(box);
      });
    }, 140);
  });

  // Árbol: padres (ascendente, vp→…) con rieles de profundidad creciente, la entidad
  // consultada DESTACADA (tile verde + badge CONSULTADO), y los grupos de hijos debajo (puede
  // haber varios a la vez — p.ej. una vicepresidencia lista Gerencias, Activos Y Campos
  // simultáneamente; ver hechos["hijos_grupos"] en respuesta_jerarquizar.py). Reusa los pozos
  // y el level-shift ("puente") YA calculados por el backend — nunca recalcula nada.
  // Ruta (padres no vacío) y abanico (padres vacío, focus a depth 0) salen del mismo código.
  function __cnJerArbolHtml(d) {
    if (d.fuera_estructura) {
      return '<div class="jq-tree" role="tree">' +
        __cnJerNodoHtml("campo", d.entidad || "", {depth: 0, focus: true}) +
        '<div class="jq-nota">Fuera de la estructura económica de ECP: sin activo, gerencia ' +
        'ni vicepresidencia en la fuente oficial.' +
        (d.operador ? ' Operador: ' + esc(d.operador) + ' (tercero).' : '') + '</div></div>';
    }

    var padres = d.padres || [], grupos = d.hijos_grupos || [], html = "", depth = 0;

    // Level-shift (Opción A): el término del usuario no se niega, se reconoce. Va ARRIBA,
    // antes del árbol — es contexto para leer lo que viene, no una nota al pie.
    if (d.puente) {
      html += '<div class="jq-nota">Lo que en el reporte diario llamas «' +
        esc(__cnJerNiv(d.puente).label) + ' ' + esc(d.entidad || "") + '» es, en la estructura ' +
        'oficial, ' + esc(__cnJerNiv(d.nivel).label) + ' ' + esc(d.entidad || "") + '.</div>';
    }

    // Ancestros, de VP hacia abajo. Varios items del mismo nivel → una fila, unidos por coma.
    padres.forEach(function (g) {
      html += __cnJerNodoHtml(g.nivel, (g.items || []).join(", "), {depth: depth});
      depth++;
    });

    // La entidad consultada. `count` = total de hijos sumando TODOS los grupos.
    var total = 0, hay = false;
    grupos.forEach(function (g) { if (g.total != null) { total += g.total; hay = true; } });
    html += __cnJerNodoHtml(d.nivel, d.entidad || "",
                            {depth: depth, focus: true, count: hay ? total : null});
    depth++;

    // Grupos de hijos. El divisor se sangra al mismo nivel que los nodos que encabeza.
    grupos.forEach(function (g, gi) {
      html += __cnJerGrupoHtml(g, gi === 0);
      var items = g.items || [];
      if (!items.length) {
        // Sin hijos: no dejar el árbol truncado — decirlo explícitamente.
        html += '<div class="jq-node" role="treeitem" aria-level="' + (depth + 1) + '">' +
          '<span class="jq-rail is-elbow is-last" aria-hidden="true"></span>' +
          '<div class="jq-node__body"><span class="jq-vacio">' +
          (g.es_hermanos ? "Ninguno (es el único)" : "Sin " + __cnJerNiv(g.nivel).label.toLowerCase() +
           "s asociados") + '</span></div></div>';
        return;
      }
      items.forEach(function (nm, i) {
        // `truncado` → el "+N más" es el último renglón visible, así que el codo "└" le
        // corresponde a él, no al último item.
        var esUltimo = (i === items.length - 1) && !g.truncado;
        html += __cnJerNodoHtml(g.nivel, nm, {depth: depth, leaf: true, last: esUltimo});
      });
      if (g.truncado) {
        html += '<div class="jq-node" role="treeitem" aria-level="' + (depth + 1) + '">' +
          '<span class="jq-rail is-elbow is-last" aria-hidden="true"></span>' +
          '<div class="jq-node__body"><span class="jq-more">+' + (g.total - items.length) +
          ' más (' + g.total + ' en total)</span></div></div>';
      }
    });

    // [2026-08-25] QV2-MAPA · dos columnas: árbol a la izquierda, mapa a la derecha.
    // El árbol se pinta YA (sus datos vienen en el panel); el mapa llega por fetch y se
    // rellena después — mismo patrón asíncrono que cuant_dia_panel (:3335/:3411).
    // El pie de "Pozos asociados" se MUEVE a la cabecera del mapa, donde tiene contexto.
    // Sin entidad/nivel no hay nada que pedir: se devuelve el árbol solo, como antes.
    // NO se comprueba `fuera_estructura`: esa rama tiene su propio return al principio de
    // la función (:3902) y nunca llega hasta aquí (R2). Un campo fuera de la estructura
    // económica no tiene rob_field, así que tampoco debe pedir mapa — ya queda correcto
    // por no tocar aquel return.
    var arbol = '<div class="jq-tree" role="tree">' + html + '</div>';
    if (!d.entidad || !d.nivel) {
      return arbol + __cnJerPieHtml(d.pozos);
    }
    return '<div class="jq-split">' +
        '<div class="jq-split__arbol">' + arbol + '</div>' +
        '<div class="jq-split__mapa jm" data-entidad="' + esc(d.entidad) + '"' +
             ' data-nivel="' + esc(d.nivel) + '">' +
          '<div class="jm__hd"><span class="jm__t">Ubicación en Colombia</span>' +
            '<span class="jm__zoom">' +
              '<button type="button" class="jm__zb is-on" data-z="pais">Colombia</button>' +
              '<button type="button" class="jm__zb" data-z="campo">Acercar</button>' +
            '</span></div>' +
          '<div class="jm__lienzo"><canvas class="jm__cv"></canvas>' +
            '<div class="jm__ctrl">' +
              '<button type="button" class="jm__zc" data-a="mas" title="Acercar">+</button>' +
              '<button type="button" class="jm__zc" data-a="menos" title="Alejar">−</button>' +
              '<span class="jm__pct">100%</span>' +
              '<button type="button" class="jm__zc" data-a="reset" title="Ver todo">⤢</button>' +
            '</div>' +
            '<div class="jm__tip"></div>' +
            '<div class="jm__carga">Cargando mapa…</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // "operador" NO es un nivel de la jerarquía (lo dice el propio backend) → sin rieles: la
  // empresa a depth 0 y sus campos como hojas a depth 1, con el mismo lenguaje visual del árbol.
  function __cnJerOperadorHtml(d) {
    var campos = d.campos || [], total = d.total || 0;
    var html = '<div class="jq-node" role="treeitem" aria-level="1"><div class="jq-node__body">' +
      '<span class="jq-node__tile is-focus" aria-hidden="true">' +
        '<i class="bi bi-building"></i></span>' +
      '<span class="jq-node__abbr" aria-hidden="true">OPE</span>' +
      '<span class="jq-vh">Operador</span>' +
      '<span class="jq-node__value is-focus">' + esc(d.entidad || "") + '</span>' +
      '<span class="jq-node__count">' + total + '</span></div></div>' +
      '<div class="jq-nota">Empresa — no es un nivel de la jerarquía.</div>' +
      __cnJerGrupoHtml({nivel: "campo", total: total, es_hermanos: false}, true);
    campos.forEach(function (nm, i) {
      html += __cnJerNodoHtml("campo", nm,
        {depth: 1, leaf: true, last: (i === campos.length - 1) && !d.truncado});
    });
    if (d.truncado) {
      html += '<div class="jq-node" role="treeitem" aria-level="2">' +
        '<span class="jq-rail is-elbow is-last" aria-hidden="true"></span>' +
        '<div class="jq-node__body"><span class="jq-more">+' + (total - campos.length) +
        ' más (' + total + ' en total)</span></div></div>';
    }
    return '<div class="jq-tree" role="tree">' + html + '</div>';
  }

  // Ranking ESTRUCTURAL (conteo: pozos/campos/activos/gerencias) — eje ORTOGONAL al ranking de
  // Cuantificar (que rankea por PRODUCCIÓN). REUSA las clases .cn-rank* tal cual (son genéricas,
  // no atadas a producción) para que ambos rankings se vean consistentes. `d` es el `res` de
  // _rank_calcular pasado VERBATIM desde el backend — sin transformar.
  function __cnJerRankHtml(d) {
    var subjPl = {campo: "Campos", activo: "Activos", gerencia: "Gerencias",
                  vicepresidencia: "Vicepresidencias"}[d.subject] || "Entidades";
    var dirTxt = d.asc ? "menos" : "más";
    var items = d.items || [];
    var rows = items.map(function (it) {
      return '<div class="cn-rank__item">' +
        '<span class="cn-rank__pos">' + it.pos + '</span>' +
        '<span class="cn-rank__ent">' + esc(it.entidad) + '</span>' +
        '<span class="cn-rank__val">' + it.n + '</span></div>';
    }).join("");
    var pie = "Sobre " + (d.total || 0) + " " + subjPl.toLowerCase() + " ECP-operados";
    // Descargo obligatorio (H10 del plan): el conteo de pozos es de REGISTRO, no de producción —
    // sin esto el panel afirmaría algo distinto al mensaje del chat, que sí lo dice.
    if (d.conteo === "pozos") {
      pie += '<div class="cn-rank__aviso">Conteo de REGISTRO (atemporal), no de producción del mes.</div>';
    }
    return '<div class="cn-rank">' +
      '<div class="cn-rank__hd">' + subjPl + ' · con ' + dirTxt + ' ' + esc(d.conteo || "") + '</div>' +
      rows +
      '<div class="cn-rank__foot">' + pie + '</div>' +
    '</div>';
  }

  // [2026-08-24] GUÍA de arranque bajo las tarjetas P50 (petición del usuario). Recupera el
  // menú de categorías que se retiró del saludo del chat en f2e677f: era el ÚNICO sitio donde
  // se anunciaban sub-intenciones que el motor ya responde pero nadie adivina —diferidas,
  // mantenimientos, EBITDA/NOPAT, proyección de cierre—. Aquí no estorba: el chat queda limpio
  // y el texto vive donde el usuario ya está mirando datos.
  //
  // La fecha sale de /president → `corte`, que ahí es una fecha ISO real (api.py:2594,
  // fr[0].isoformat()) y NO la fracción "12/31" que devuelven /desempeno y /ejecutivo. Por eso
  // se pinta desde el .then de esa llamada y no antes: sin el dato, no se inventa.
  //
  // Se retira sola en cuanto llega el primer panel de una respuesta (__cnStackEnsure): ese
  // espacio es de los gráficos. Vuelve con "Nueva conversación", que repinta el panorama.
  function __cnFechaCorte(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return m ? (m[3] + "/" + m[2] + "/" + m[1]) : "";
  }

  function __cnPintarGuia(corteIso) {
    var host = el("cn-stack"); if (!host) return;
    if (host.querySelector(".cn-guia")) return;          // ya pintada: no duplicar
    if (host.children.length) return;                    // ya hay paneles: el sitio es suyo
    var f = __cnFechaCorte(corteIso);
    host.innerHTML =
      '<section class="cn-guia">' +
      '  <p class="cn-guia__hd"><strong>Desempeño del mes' +
           (f ? ' con corte a ' + f : '') + '</strong></p>' +
      '  <p class="cn-guia__p">¿Quieres profundizar en algún tema específico?</p>' +
      '  <ul class="cn-guia__lista">' +
      '    <li><strong>Estructura</strong> — cómo se organiza la operación: campos, activos, ' +
             'gerencias, pozos. <em>(«¿Qué campos tiene Castilla?»)</em></li>' +
      '    <li><strong>Cifras</strong> — crudo, gas y blancos: del mes, acumulado, variación, ' +
             'rankings y vs presupuesto. <em>(«¿Cuánto crudo produjo Rubiales?»)</em></li>' +
      '    <li><strong>Análisis</strong> — brechas, causas, diferidas y mantenimientos, ' +
             'proyección de cierre y economía (EBITDA/NOPAT). ' +
             '<em>(«¿A qué se debe el gap de crudo?» · «¿qué mantenimientos hubo en Castilla?»)</em></li>' +
      '  </ul>' +
      '  <p class="cn-guia__p">Pregúntame en lenguaje natural, ¿por dónde arrancamos?</p>' +
      '</section>';
  }

  function __cnPaintP50Header() {
    var row = el("cn-p50-row"); if (!row) return;
    fetch("/api/analisis/president")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var row2 = el("cn-p50-row"); if (!row2) return;
        if (!d || d.encontrada === false || !(d.productos && d.productos.length)) {
          row2.innerHTML = '<div class="cn-p50hd__na">Compromiso P50 no disponible · falta ingerir REPORTE_PRESIDENT en este entorno.</div>';
          return;
        }
        row2.innerHTML = d.productos.map(__cnP50CardHtml).join("");
        __cnPintarGuia(d.corte);
      })
      .catch(function () {
        var row2 = el("cn-p50-row");
        if (row2) row2.innerHTML = '<div class="cn-p50hd__na">No se pudo cargar el compromiso P50.</div>';
      });
  }

  // Épica 1 (atribución cuantitativa del gap, feedback gerencial 2026-07-24): el renglón ECP
  // se limpió (ver comentario de abajo) pero el dato en barriles + la fuente/soporte (comentario real
  // del reporte, vía f.causa.eventos) siguen existiendo — se muestran DENTRO del panel "Comportamiento
  // diario" (ya abierto por defecto), no en el renglón colapsado, para no revertir esa decisión.
  function __cnAtribucionHtml(f) {
    // [2026-07-24] La atribución CUANTITATIVA del gap por campo (CUSIANA/CUPIAGUA/… con su faltante)
    // la muestra ahora el gráfico bullet del panel derecho (__cnGapCampoInto). Aquí queda SOLO el
    // EVENTO/comentario del reporte — el "por qué" cualitativo que el gráfico no cubre.
    var evs = (f.causa && f.causa.eventos) || [];
    if (!evs.length) return "";
    return '<div class="cp-foco__evento">⚡ ' + esc(evs[0].campo) + " (" + esc(evs[0].fecha) + "): «" +
      esc(evs[0].texto) + "»</div>";
  }

  // Nivel 2: franja "Focos de atención". FILIALES conserva el detalle (causa/acción/número + "Sin foco"
  // + Series). ECP (decisión usuario 2026-07-24): renglón LIMPIO por foco + acordeón de 3 secciones
  // ============ Pill "EBITDA-NOPAT" del acordeón de foco (waterfall económico Ingresos→NOPAT) ============
  // Réplica vanilla del "EBITDA Inspector" (proyecto Robustez 2.0). Lee /api/ebitda/unificado-waterfall
  // (motor que consulta directo la BD ROBUSTEZ/ops). Variante Crudo · Activos/Campos · Real. Solo CRUDO
  // tiene economía en la fuente → en focos de Gas/Blancos la pill muestra estado en blanco (decisión del
  // usuario 2026-07-26). Toggle de unidad KUSD ↔ USD/BI en cliente (el motor devuelve ambos valores).
  var __EB_MES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  // SVG del waterfall (vertical). Fiel al spec de la fuente: márgenes [46,14,40,120], barW=viw/18,
  // barInner=barW*0.65, dominio [min(edges,0),max(edges,0)], escala Y invertida, 3 bandas de fondo,
  // conectores punteados antes de cada delta, labels X rotados -40°, colores hex literales.
  function __cnWaterfallSVG(components, unit, W, H) {
    var VML = 46, VMR = 14, VMT = 40, VMB = 120;
    var n = components.length;
    var viw = W - VML - VMR, vih = H - VMT - VMB;
    var barW = viw / n, barInner = barW * 0.65, barPad = (barW - barInner) / 2;

    var steps = components.map(function (c) {
      return { key: c.key, label: c.label, type: c.type,
               value: unit === "KUSD" ? c.value_kusd : c.value_usd_bl };
    });

    // acumulado waterfall: un "total" resetea el acumulado a su valor; un "delta" flota sobre él.
    var cumulative = 0, bars = [];
    steps.forEach(function (s) {
      if (s.type === "total") {
        bars.push({ label: s.label, type: s.type, value: s.value, lo: 0, hi: s.value, neg: s.value < 0 });
        cumulative = s.value;
      } else {
        var lo = s.value < 0 ? cumulative + s.value : cumulative;
        var hi = s.value < 0 ? cumulative : cumulative + s.value;
        bars.push({ label: s.label, type: s.type, value: s.value, lo: lo, hi: hi, neg: s.value < 0 });
        cumulative += s.value;
      }
    });

    var edges = [0];
    bars.forEach(function (b) { edges.push(b.lo, b.hi); });
    var maxVal = Math.max.apply(null, edges), minVal = Math.min.apply(null, edges);
    var range = (maxVal - minVal) || 1;
    function sY(v) { return VMT + ((maxVal - v) / range) * vih; }
    var zeroY = sY(0);

    function lerpTotal(idx, count) {
      var a = [0, 66, 54], b = [204, 211, 42], t = count > 1 ? idx / (count - 1) : 0;
      return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," + Math.round(a[1] + (b[1] - a[1]) * t) +
             "," + Math.round(a[2] + (b[2] - a[2]) * t) + ")";
    }
    var totalCount = steps.filter(function (s) { return s.type === "total"; }).length;

    function fmtV(v) {
      var a = Math.abs(v), sg = v < 0 ? "-" : "";
      if (unit === "KUSD") {
        if (a >= 1000) return sg + "$" + (a / 1000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " M";
        return sg + "$" + a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " K";
      }
      return sg + "$" + a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function tickFmt(t) {
      if (unit === "KUSD") return (t < 0 ? "-" : "") + "$" + Math.round(Math.abs(t)).toLocaleString("en-US");
      return t.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }

    var p = ['<svg class="cn-wf__svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Waterfall Ingresos a NOPAT">'];

    // bandas de fondo (índices fijos: op 1-7, no operativos 9-12, financiero 14-16)
    var BANDS = [{ from: 1, to: 7, label: "Costos de operación", fill: "rgba(19,53,90,0.06)" },
                 { from: 9, to: 12, label: "No operativos", fill: "rgba(204,211,42,0.07)" },
                 { from: 14, to: 16, label: "Costo Financiero", fill: "rgba(46,139,71,0.06)" }];
    BANDS.forEach(function (bd) {
      var vpad = barW * 0.15, bx = VML + bd.from * barW - vpad, bw = (bd.to - bd.from + 1) * barW + vpad * 2;
      p.push('<rect x="' + bx.toFixed(1) + '" y="' + (VMT - 4) + '" width="' + bw.toFixed(1) + '" height="' + (vih + 8).toFixed(1) + '" rx="4" fill="' + bd.fill + '"/>');
      p.push('<text class="cn-wf__band" x="' + (bx + bw / 2).toFixed(1) + '" y="' + (VMT - 10) + '" text-anchor="middle">' + esc(bd.label) + '</text>');
    });

    // grid + ticks del eje de valores
    var tk = [];
    if (unit === "USD/BI") {
      var st = Math.ceil(minVal / 10) * 10, en = Math.floor(maxVal / 10) * 10;
      for (var tv = st; tv <= en + 1e-9; tv += 10) tk.push(tv);
      if (!tk.length) tk.push(0);
    } else {
      var step = range / 5;
      for (var i = 0; i <= 5; i++) tk.push(minVal + step * i);
    }
    tk.forEach(function (t) {
      var y = sY(t).toFixed(1);
      p.push('<line x1="' + VML + '" y1="' + y + '" x2="' + (W - VMR) + '" y2="' + y + '" stroke="#ecf1f6" stroke-width="1"/>');
      p.push('<text class="cn-wf__tick" x="' + (VML - 6) + '" y="' + y + '" text-anchor="end" dominant-baseline="central">' + esc(tickFmt(t)) + '</text>');
    });
    p.push('<line x1="' + VML + '" y1="' + zeroY.toFixed(1) + '" x2="' + (W - VMR) + '" y2="' + zeroY.toFixed(1) + '" stroke="#d1d5db" stroke-width="1"/>');

    // conectores punteados (antes de cada delta; los pilares total no reciben conector de entrada)
    function endVal(b) { return b.type === "total" ? b.hi : (b.neg ? b.lo : b.hi); }
    bars.forEach(function (b, i) {
      if (i > 0 && b.type !== "total") {
        var y = sY(endVal(bars[i - 1])).toFixed(1);
        var pcx = (VML + (i - 1) * barW + barW / 2).toFixed(1), ccx = (VML + i * barW + barW / 2).toFixed(1);
        p.push('<line x1="' + pcx + '" y1="' + y + '" x2="' + ccx + '" y2="' + y + '" stroke="#9ca3af" stroke-width="1" stroke-dasharray="3 3"/>');
      }
    });

    // barras + etiqueta de valor + etiqueta X rotada
    var tOrd = 0;
    bars.forEach(function (b, i) {
      var bx = VML + i * barW + barPad;
      var yHi = sY(b.hi), yLo = sY(b.lo), yTop = Math.min(yHi, yLo), bh = Math.max(Math.abs(yLo - yHi), 2);
      var color = b.type === "total" ? (b.value < 0 ? "#C5311E" : lerpTotal(tOrd++, totalCount))
                                     : (b.neg ? "#13355A" : "#2E8B47");
      var val = fmtV(b.value);
      p.push('<rect class="cn-wf__bar-rect" x="' + bx.toFixed(1) + '" y="' + yTop.toFixed(1) + '" width="' + barInner.toFixed(1) +
             '" height="' + bh.toFixed(1) + '" rx="3" fill="' + color + '" data-label="' + esc(b.label) +
             '" data-val="' + esc(val) + '" data-color="' + color + '"/>');
      if (Math.abs(b.value) >= 0.05) {
        var lf = b.type === "total" ? "#004236" : "#111827";
        p.push('<text class="cn-wf__val" x="' + (bx + barInner / 2).toFixed(1) + '" y="' + (yTop - 6).toFixed(1) +
               '" text-anchor="middle" fill="' + lf + '">' + esc(val) + '</text>');
      }
      var cx = (VML + i * barW + barW / 2), cy = (H - VMB + 12);
      var cls = b.type === "total" ? "cn-wf__xlbl is-total" : "cn-wf__xlbl";
      p.push('<text class="' + cls + '" x="' + cx.toFixed(1) + '" y="' + cy + '" text-anchor="end" dominant-baseline="hanging" transform="rotate(-40 ' +
             cx.toFixed(1) + ' ' + cy + ')">' + esc(b.label) + '</text>');
    });

    p.push('</svg>');
    return p.join("");
  }

  // Lazy: pinta el waterfall (Crudo) o el estado en blanco (Gas/Blancos). host = el div.cn-wf del panel.
  function __cnEbitdaInto(host) {
    if (!host) return;
    var prod = host.getAttribute("data-prod") || "";
    if (prod !== "CRUDO") {
      var q = prod === "GAS" ? "gas" : "blancos";
      host.innerHTML = '<div class="cn-wf__blank"><i class="bi bi-bar-chart-steps"></i>' +
        '<p class="cn-wf__blanktit">El EBITDA-NOPAT solo aplica a Crudo</p>' +
        '<p class="cn-wf__blanksub">La fuente económica solo tiene ingreso de crudo; no hay economía separable de ' + q + '.</p></div>';
      return;
    }
    var niv = host.getAttribute("data-niv-eb") || "campo";
    var ent = host.getAttribute("data-ent-eb") || "";
    host.innerHTML = '<div class="cn-wf__load"><i class="bi bi-hourglass-split"></i> Cargando economía…</div>';
    var qs = "nivel=" + encodeURIComponent(niv) + (ent ? "&entidad=" + encodeURIComponent(ent) : "");
    // [2026-08-26] year/month del periodo del foco. Sin ellos el motor resuelve el ULTIMO mes de
    // producción (ebitda/api.py:82-83) y esta pestaña contestaba un mes distinto al del resto de
    // la respuesta. El proxy Flask ya los reenvía (routes/api.py:292): solo faltaba mandarlos.
    // Formato "YYYY-MM"; si el atributo falta o no calza, se omite y vuelve el comportamiento
    // previo (mes vigente) — nunca una fecha inventada.
    var per = /^(\d{4})-(\d{2})$/.exec(host.getAttribute("data-per-eb") || "");
    if (per) qs += "&year=" + per[1] + "&month=" + String(Number(per[2]));
    fetch("/api/ebitda/unificado-waterfall?" + qs, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.components || !d.components.length) throw new Error((d && d.error) || "sin datos económicos");
        // [2026-08-26] «Vino en CERO» también es «no hay datos». El guard de arriba solo cubría
        // «no vinieron componentes», pero las dos fuentes van a ritmos distintos: el período lo
        // fija la BD de PRODUCCIÓN y las cifras salen de la ECONÓMICA, que va por detrás. Medido:
        // producción en agosto 2026 y economía hasta julio → el motor devolvía las 18 filas con
        // SUM=0, el guard las dejaba pasar y se pintaba un waterfall VACÍO —bandas, ejes y barras
        // de 2px— sin decir por qué. Ahora se declara hasta dónde llega la economía.
        var meta0 = d.meta || {};
        if (!d.total_bls || meta0.sin_economia) {
          var hasta = meta0.economia_hasta;
          var txt = hasta && hasta.month
            // [2026-08-26] "y este análisis es de X", no "la producción ya va por X": desde que
            // el mes puede venir PEDIDO en la pregunta, la segunda frase afirmaría algo falso
            // (pedir diciembre no significa que la producción vaya por diciembre). Esta versión
            // es cierta en los dos casos y conserva el contraste entre las dos fuentes.
            ? "La economía está cargada hasta " + (__EB_MES[hasta.month] || "") + " " + hasta.year +
              ", y este análisis es de " + (__EB_MES[meta0.month] || "") + " " + meta0.year + "."
            : "No hay cifras económicas cargadas para " + (__EB_MES[meta0.month] || "") + " " + meta0.year + ".";
          host.innerHTML = '<div class="cn-wf__blank"><i class="bi bi-hourglass-split"></i>' +
            '<p class="cn-wf__blanktit">Sin economía para este mes</p>' +
            '<p class="cn-wf__blanksub">' + esc(txt) + '</p>' +
            '<button type="button" class="cn-wf__retry" onclick="window.__cnEbRetry(this)">Reintentar</button></div>';
          host.dataset.loaded = "0";
          return;
        }
        host.__ebData = d;
        host.__ebUnit = "USD/BI";
        __cnEbRender(host);
      })
      .catch(function (e) {
        host.innerHTML = '<div class="cn-wf__blank"><i class="bi bi-exclamation-triangle"></i>' +
          '<p class="cn-wf__blanktit">No se pudo cargar la economía</p>' +
          '<p class="cn-wf__blanksub">' + esc(String(e && e.message || e)) + '</p>' +
          '<button type="button" class="cn-wf__retry" onclick="window.__cnEbRetry(this)">Reintentar</button></div>';
        host.dataset.loaded = "0";
      });
  }

  function __cnEbRender(host) {
    var d = host.__ebData, unit = host.__ebUnit || "USD/BI";
    var W = Math.max(560, Math.round(host.clientWidth || (host.getBoundingClientRect().width) || 900));
    var H = 480;
    var m = d.meta || {};
    var mes = __EB_MES[m.month] || "";
    var mesCap = mes ? mes.charAt(0).toUpperCase() + mes.slice(1) : "";
    var bar = '<div class="cn-wf__bar-top">' +
      '<div class="cn-wf__units" role="tablist" aria-label="Unidad">' +
        '<button type="button" class="cn-wf__unit' + (unit === "USD/BI" ? " is-active" : "") + '" data-u="USD/BI" onclick="window.__cnEbUnit(this)">USD/BI</button>' +
        '<button type="button" class="cn-wf__unit' + (unit === "KUSD" ? " is-active" : "") + '" data-u="KUSD" onclick="window.__cnEbUnit(this)">KUSD</button>' +
      '</div>' +
      '<span class="cn-wf__scope">Crudo · Real · ' + esc(mesCap) + ' ' + esc(String(m.year || "")) +
        ' · ' + __cnMilesEC(d.total_bls || 0) + ' bbl</span>' +
    '</div>';
    host.innerHTML = bar + '<div class="cn-wf__svgwrap">' + __cnWaterfallSVG(d.components, unit, W, H) +
      '<div class="cn-wf__hover" style="display:none"></div></div>';
    __cnEbBindHover(host);
  }

  function __cnEbBindHover(host) {
    var card = host.querySelector(".cn-wf__hover");
    if (!card) return;
    host.querySelectorAll(".cn-wf__bar-rect").forEach(function (rect) {
      rect.addEventListener("mouseenter", function () {
        rect.style.opacity = "0.85";
        card.innerHTML = '<span class="cn-wf__hdot" style="background:' + rect.getAttribute("data-color") + '"></span>' +
          '<span class="cn-wf__hlbl">' + esc(rect.getAttribute("data-label") || "") + '</span>' +
          '<span class="cn-wf__hval">' + esc(rect.getAttribute("data-val") || "") + '</span>';
        card.style.display = "flex";
      });
      rect.addEventListener("mouseleave", function () {
        rect.style.opacity = "1";
        card.style.display = "none";
      });
    });
  }

  window.__cnEbUnit = function (btn) {
    var host = btn.closest(".cn-wf");
    if (!host || !host.__ebData) return;
    host.__ebUnit = btn.getAttribute("data-u");
    __cnEbRender(host);
  };
  window.__cnEbRetry = function (btn) {
    var host = btn.closest(".cn-wf");
    if (host) { host.dataset.loaded = "1"; __cnEbitdaInto(host); }
  };

  // DENTRO de cada foco (Comportamiento diario · 2 gráficas / Diferidas / Mantenimientos). Se quitan el
  // número, la línea Causa/Acción, el "Sin foco" y "Series completas" DEL RENGLÓN — la Atribución del
  // gap (barriles + fuente/soporte) se reintrodujo dentro del panel, ver __cnAtribucionHtml arriba.
  // [2026-08-13] +sufijo/scopeEnt/scopeNiv (ADITIVOS, default = comportamiento actual, tablero
  // BYTE-IDÉNTICO — único call site del tablero, :3575 más abajo, no cambia): el bloque "analiza_foco"
  // de la pila de Consulta reusa esta función para su propio acordeón, apilado (no en el tablero).
  //   sufijo    — evita colisión de IDs cn-foco-{day,mon,dif,ebitda}-{rank} si hay 2+ instancias en
  //               el DOM a la vez (tablero + 1 o más bloques apilados, o 2 bloques apilados seguidos).
  //   scopeEnt/scopeNiv — 🔑 SIN esto, las pills Diferidas/EBITDA leerían __cnLastIntent/__cnNivel
  //     (el ESTADO ACTUAL DEL TABLERO, no la entidad de ESTA pregunta) — un bloque apilado sobre
  //     Rubiales mostraría las diferidas de Castilla si el tablero está ahí en ese momento. `undefined`
  //     (no pasado) = comportamiento actual; `null`/"" = explícitamente GLOBAL (sin entidad/nivel).
  function __cnFocosHtml(focos, sinFoco, meta, tarjetas, sufijo, scopeEnt, scopeNiv) {
    focos = focos || [];
    tarjetas = tarjetas || [];   // [2026-07-27] tarjetas KPI operativas (BOPD vs PPTO) → bajan a cada foco
    sufijo = sufijo || "";
    // [2026-07-29] Un producto que NO produce y NO tiene meta no aporta nada: se omite su bloque
    // completo. Un campo de solo crudo (CASTILLA) pintaba Gas y Blancos en 0,00 con gráficas vacías.
    // El backend lo marca con `sin_produccion`; un producto que produce 0 TENIENDO meta NO viene
    // marcado y sigue visible — eso es una merma real (caso ARAUCA/gas, 25-jul), no un hueco.
    // Los `rank` NO se renumeran: son la clave de los IDs que pinta __cnPaintFocoCharts.
    focos = focos.filter(function (f) { return !f.sin_produccion; });
    if (!focos.length)
      return '<div class="cn-foco__wrap"><div class="cn-foco__hdr">Focos de atención · rankeados por impacto</div>' +
        '<div class="cn-foco__empty" style="padding:12px 4px;color:#6c757d;font-size:13px;">Sin focos de atención · los productos están alineados o no tienen una meta comparable en el periodo.</div></div>';

    if (__cnEsFil()) {   // FILIALES: sin cambios (no hay grano diario para el acordeón de gráficas)
      var filasF = focos.map(function (f) {
        var num = (f.faltante_abs != null)
          ? '<span class="cn-foco__num">' + __cnMilesEC(f.faltante_abs) + '</span>'
          : (f.magnitud_txt ? '<span class="cn-foco__num">' + esc(f.magnitud_txt) + '</span>' : "");
        var det = ((f.causa && f.causa.detalle) || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("");
        var warn = (f.causa && f.causa.cobertura === "sin_evento") ? " cn-foco__causa--warn" : "";
        return '<div class="cn-foco"><div class="cn-foco__hd"><span class="cn-foco__rk">' + f.rank + '</span>' +
          '<div class="cn-foco__main"><div class="cn-foco__titulo"><b>' + esc(f.producto) +
          ((f.entidades && f.entidades.length) ? ' · ' + f.entidades.map(esc).join(" + ") : "") + '</b> ' + esc(f.titulo) + '</div>' +
          '<div class="cn-foco__ca"><span class="cn-foco__causa' + warn + '">⚡ Causa: ' + esc((f.causa || {}).texto || "—") + '</span>' +
          '<span class="cn-foco__accion">☑ Acción: ' + esc(f.accion || "—") + '</span></div></div>' + num +
          (det ? '<button type="button" class="cn-foco__ver" onclick="window.__cnFocoToggle(this)">Ver →</button>' : "") + '</div>' +
          (det ? '<ul class="cn-foco__det" style="display:none">' + det + '</ul>' : "") + '</div>';
      }).join("");
      return '<div class="cn-foco__wrap"><div class="cn-foco__hdr">Focos de atención · rankeados por impacto</div>' + filasF +
        '<div class="cn-foco__sin"><span>✓ Sin foco: ' + esc(sinFoco || "") + '</span>' +
        '<button type="button" class="cn-foco__ver" onclick="window.__cnSeriesToggle(this)">Series completas →</button></div>' +
        '<div class="cn-ejec__series" style="display:none"></div></div>';
    }

    // ECP [Fase 2]: renglón + 3 pills temáticas (master-detail). Panel activo default = Comportamiento.
    // Los 3 paneles se montan; solo el activo es visible. Se conservan los IDs cn-foco-day/mon/dif-{rank}.
    meta = meta || {};
    var cp = String(meta.corte || "").split("/");
    var enCurso = cp.length === 2 && cp[0] !== cp[1];
    var badgeComp = meta.corte ? (esc(meta.corte) + (enCurso ? " en curso" : "")) : "histórico";
    var difEntG = (scopeEnt !== undefined) ? (scopeEnt || "")
      : ((__cnLastIntent && (__cnLastIntent.valor || __cnLastIntent.entidad)) || "");
    var nivelEfectivo = (scopeNiv !== undefined) ? scopeNiv : __cnNivel;

    var filas = focos.map(function (f) {
      var prod = f.producto || "";
      // Identidad de producto — SIEMPRE por el accessor (H5: "GAS"/"gas" según el origen del dato).
      var pIx = __cnProdId(prod);
      var pI = pIx || { icon: "circle", color: "#6E7C75", soft: "#F1F4F1", texto: "#6E7C75" };
      var campos = (f.entidades && f.entidades.length) || 0;
      var fields = campos ? f.entidades.map(esc).join(" + ") : "";
      // 4ª vía de la identidad: el ÉNFASIS del % de concentración. Usa `texto` (variante oscurecida)
      // y NO `color`: el amarillo/rojo puros no alcanzan contraste AA como texto sobre blanco.
      var share = (f.peso_relativo_pct != null)
        ? ('<b class="cp-foco__share">' + String(f.peso_relativo_pct).replace(".", ",") + '%</b>') : "—";
      // [2026-07-26] Encabezado: rezagado → "% del faltante"; producto que va bien → su estado
      // (Alineado / Ajustado / Sin producción) — no hay faltante que reportar.
      var camposTxt = campos ? (" · " + campos + " campo" + (campos === 1 ? "" : "s")) : "";
      var metaTxt = f.es_ok
        ? (esc(f.estado_label || "Alineado") + camposTxt)
        : (share + " del faltante" + camposTxt);
      var uid = "cpf-" + f.rank + sufijo;

      // --- Panel 1: Comportamiento (activo por default; conserva los IDs que pinta __cnPaintFocoCharts) ---
      // [2026-07-25] Se retiran el sub-encabezado "Comportamiento diario · {mes} · en curso" (redundante
      // con la pill) y la línea de evento/comentario (__cnAtribucionHtml) — decisión del usuario.
      // [2026-07-27 · opción A] La tarjeta OPERATIVA de ESTE producto (BOPD vs PPTO + proyección de
      // cierre) que antes vivía en el encabezado. Rotulada "vs presupuesto (PPTO)" para distinguirla
      // del compromiso P50 del encabezado (referencias distintas, no se contradicen).
      // [2026-07-28] Reubicada: columna propia DENTRO del grid, a la izquierda del gráfico de
      // producción diaria (antes flotaba en una fila completa arriba de las 2 gráficas).
      var tarProd = tarjetas.filter(function (t) { return t.producto === prod; });
      var kpiComp = tarProd.length
        ? '<div class="cp-foco__kpicol"><div class="cp-foco__kpihd"><i class="bi bi-speedometer2"></i> Ejecución diaria vs presupuesto (PPTO)</div>' +
          '<div class="cn-kpi__row cn-kpi__row--solo">' + __cnTarjetasKpiHtml(tarProd, meta.periodo) + '</div></div>'
        : "";
      var gridCls = "cn-desemp__grid2" + (tarProd.length ? " cn-desemp__grid2--kpi" : "");
      var pComp = '<div id="' + uid + '-comport" class="cp-foco__panel is-active" role="tabpanel" ' +
        'data-tab="comport" aria-labelledby="' + uid + '-comport-tab">' +
        '<div class="' + gridCls + '">' + kpiComp +
          '<div id="cn-foco-day-' + f.rank + sufijo + '" class="cn-ins"></div>' +
          '<div id="cn-foco-mon-' + f.rank + sufijo + '" class="cn-desemp__right"></div></div></div>';

      // --- Panel 2: Diferidas (lazy; reusa el contenedor .cn-dif con data-attrs) ---
      var difEnt = difEntG;
      var difCampos = (!difEnt && campos) ? f.entidades.join("|") : "";
      var pDif = '<div id="' + uid + '-dif" class="cp-foco__panel" role="tabpanel" ' +
        'data-tab="dif" aria-labelledby="' + uid + '-dif-tab">' +
        '<div class="cp-foco__phd"><i class="bi bi-droplet-half"></i><b>Diferidas</b>' +
        '<span class="cp-foco__pmeta">· histórico 2023–2025</span></div>' +
        '<div id="cn-foco-dif-' + f.rank + sufijo + '" class="cn-dif" data-loaded="0" data-ent="' +
        esc(difEnt) + '" data-niv="' + esc(nivelEfectivo || "") + '" data-campos="' + esc(difCampos) +
        '" data-prod="' + esc(prod) + '"></div></div>';

      // --- Panel 3: Mantenimientos (lazy; mismo patrón que Diferidas) ---
      var mttoPer = __cnPeriodoISO(meta.periodo);
      var pMan = '<div id="' + uid + '-mantto" class="cp-foco__panel" role="tabpanel" ' +
        'data-tab="mantto" aria-labelledby="' + uid + '-mantto-tab">' +
        '<div class="cp-foco__phd"><i class="bi bi-tools"></i><b>Mantenimientos</b>' +
        '<span class="cp-foco__pmeta">· servicio a pozo</span></div>' +
        '<div id="cn-foco-mtto-' + f.rank + sufijo + '" class="cn-mtto" data-loaded="0" data-ent="' +
        esc(difEnt) + '" data-niv="' + esc(nivelEfectivo || "") + '" data-campos="' + esc(difCampos) +
        '" data-per="' + esc(mttoPer) + '"></div></div>';

      // --- Panel 4: EBITDA-NOPAT (lazy; Crudo→waterfall, Gas/Blancos→en blanco) ---
      // [2026-07-26] Scope = el ENTE del análisis (global / activo / campo), NO los campos del foco:
      // así la economía es coherente y siempre definida (a nivel global = toda la compañía). Para
      // vice/fuente (sin soporte en el motor) cae a global.
      var ebNiv = (nivelEfectivo === "activo" || nivelEfectivo === "campo") ? nivelEfectivo : "global";
      var ebEnt = ebNiv === "global" ? "" : (difEntG || "");
      var pEb = '<div id="' + uid + '-ebitda" class="cp-foco__panel" role="tabpanel" ' +
        'data-tab="ebitda" aria-labelledby="' + uid + '-ebitda-tab">' +
        '<div class="cp-foco__phd"><i class="bi bi-bar-chart-steps"></i><b>EBITDA-NOPAT</b>' +
        '<span class="cp-foco__pmeta">· crudo · real</span></div>' +
        // [2026-08-26] El PERIODO del foco viaja también al waterfall. Sin esto el QS iba sin
        // year/month y el motor caía a _ultimo_mes_prodia() (ebitda/api.py:82-83) = el mes
        // VIGENTE: se pedía mayo, el texto y el acordeón respondían mayo, y esta pestaña sola
        // se iba a agosto — y encima anunciaba "sin economía para este mes" cuando mayo SÍ la
        // tiene. Se reusa `mttoPer` (ya calculado arriba para Mantenimientos): mismo formato
        // ISO "YYYY-MM", mismo origen (meta.periodo).
        '<div id="cn-foco-ebitda-' + f.rank + sufijo + '" class="cn-wf" data-loaded="0" ' +
        'data-prod="' + esc(prod) + '" data-niv-eb="' + esc(ebNiv) + '" ' +
        'data-per-eb="' + esc(mttoPer) + '" ' +
        'data-ent-eb="' + esc(ebEnt) + '"></div></div>';

      // --- Pills (tablist; la primera activa) ---
      var pills = __CP_TABS.map(function (t, i) {
        var on = i === 0;
        return '<button type="button" role="tab" id="' + uid + '-' + t.key + '-tab" ' +
          'aria-controls="' + uid + '-' + t.key + '" aria-selected="' + (on ? "true" : "false") + '" ' +
          'class="cp-foco__pill' + (on ? " is-active" : "") + '" data-tab="' + t.key + '" ' +
          'onclick="window.__cnFocoTab(this)">' +
          '<span class="cp-foco__ptile"><i class="bi bi-' + t.icon + '"></i></span>' +
          '<span class="cp-foco__ptxt"><span class="cp-foco__ptit">' + t.titulo + '</span>' +
          '<span class="cp-foco__psub">' + esc(t.key === "comport" ? badgeComp : t.sub) + '</span></span>' +
          '<i class="bi bi-check-circle-fill cp-foco__pcheck"></i></button>';
      }).join("");

      return '<div class="cp-foco" style="--cp-prod:' + pI.color + ';--cp-prod-soft:' + (pI.soft || "#F1F4F1") +
          ';--cp-prod-text:' + (pI.texto || pI.color) + '">' +
        '<div class="cp-foco__hd">' +
          '<span class="cp-foco__rk">' + f.rank + '</span>' +
          '<i class="bi bi-' + pI.icon + ' cp-foco__prod"></i>' +
          '<span class="cp-foco__tit">' + esc(prod) + '</span>' +   // [2026-07-26] solo el producto (sin nombres de campo)
          '<span class="cp-foco__meta">' + metaTxt + '</span>' +
        '</div>' +
        '<div class="cp-foco__pills" role="tablist" aria-label="Temáticas del foco">' + pills + '</div>' +
        '<div class="cp-foco__panels">' + pComp + pDif + pMan + pEb + '</div>' +
      '</div>';
    }).join("");
    return '<div class="cn-foco__wrap"><div class="cn-foco__hdr">Focos de atención · rankeados por impacto</div>' + filas + '</div>';
  }
  // [Fase 2] master-detail del foco: intercambia pill/panel activos. Lazy-load Diferidas + resize
  // Plotly al mostrar (mismo gancho que tenía __cnFilialToggle). Estado independiente por foco.
  window.__cnFocoTab = function (btn) {
    var foco = btn.closest(".cp-foco"); if (!foco) return;
    var key = btn.getAttribute("data-tab");
    foco.querySelectorAll(".cp-foco__pill").forEach(function (p) {
      var on = p === btn;
      p.classList.toggle("is-active", on);
      p.setAttribute("aria-selected", on ? "true" : "false");
    });
    var activo = null;
    foco.querySelectorAll(".cp-foco__panel").forEach(function (pan) {
      var on = pan.getAttribute("data-tab") === key;   // match directo pill↔panel (robusto al orden)
      pan.classList.toggle("is-active", on);
      if (on) activo = pan;
    });
    if (!activo) return;
    var dif = activo.querySelector(".cn-dif[data-loaded='0']");   // lazy la 1ª vez que se muestra Diferidas
    if (dif) { dif.dataset.loaded = "1"; try { __cnDiferidasInto(dif); } catch (e) {} }
    var mtt = activo.querySelector(".cn-mtto[data-loaded='0']");  // lazy la 1ª vez que se muestra Mantenimientos
    if (mtt) { mtt.dataset.loaded = "1"; try { __cnManttoInto(mtt); } catch (e) {} }
    var eb = activo.querySelector(".cn-wf[data-loaded='0']");     // lazy la 1ª vez que se muestra EBITDA-NOPAT
    if (eb) { eb.dataset.loaded = "1"; try { __cnEbitdaInto(eb); } catch (e) {} }
    if (window.Plotly) {                                          // Plotly pintado en oculto → resize al mostrar
      activo.querySelectorAll(".js-plotly-plot").forEach(function (p) {
        try { window.Plotly.Plots.resize(p); } catch (e) {}
      });
    }
  };
  window.__cnFilialToggle = function (hd) {
    var box = hd.parentElement;
    if (!box) return;
    var abrir = !box.classList.contains("is-open");   // estado destino
    var wrap = box.closest(".cn-filial__wrap");        // acordeón: solo una sección abierta a la vez
    if (wrap) wrap.querySelectorAll(".cn-filial.is-open").forEach(function (o) { o.classList.remove("is-open"); });
    if (abrir) {
      box.classList.add("is-open");                    // si estaba cerrada, la abrimos (si estaba abierta, queda cerrada)
      // Carga perezosa de la sección "Diferidas" al abrirla por primera vez (protege RAM / red).
      var dif = box.querySelector(".cn-dif[data-loaded='0']");
      if (dif) { dif.dataset.loaded = "1"; try { __cnDiferidasInto(dif); } catch (e) {} }
      var mtt = box.querySelector(".cn-mtto[data-loaded='0']");
      if (mtt) { mtt.dataset.loaded = "1"; try { __cnManttoInto(mtt); } catch (e) {} }
      // Re-dimensiona cualquier gráfico Plotly que se haya dibujado mientras la sección estaba oculta
      // (tamaño 0) — p.ej. las 2 gráficas del "Comportamiento diario" al reabrir la sección 1.
      if (window.Plotly) {
        box.querySelectorAll(".js-plotly-plot").forEach(function (p) {
          try { window.Plotly.Plots.resize(p); } catch (e) {}
        });
      }
    }
  };

  window.__cnFocoToggle = function (btn) {
    var ul = btn.closest(".cn-foco").querySelector(".cn-foco__det"); if (!ul) return;
    ul.style.display = ul.style.display === "none" ? "block" : "none";
  };
  window.__cnSeriesToggle = function (btn) {
    var box = btn.closest(".cn-foco__wrap").querySelector(".cn-ejec__series"); if (!box) return;
    if (box.dataset.loaded !== "1" && __cnEjecD) {          // lazy: dibujar al abrir (H4)
      box.innerHTML = __cnEjecChartsHtml(__cnEjecD); box.dataset.loaded = "1";
      try { __cnEjecCharts(__cnEjecD); } catch (e) {}
    }
    box.style.display = box.style.display === "none" ? "block" : "none";
  };

  function __cnRenderEjecutivo(d) {
    __cnEjecD = d;
    var m = d.meta || {};

    var noteReconc = "";
    Object.keys(d.gap_por_producto || {}).forEach(function (p) {
      var g = d.gap_por_producto[p];
      if (g && g.reconciliado === false) {
        noteReconc += '<div class="cn-ejec__note"><i class="bi bi-info-circle"></i> La descomposición por ' + (__cnEsFil() ? "filial" : "campo") + ' de ' +
          esc(p) + ' presenta un desfase de ' + (g.desfase_pct != null ? g.desfase_pct + '%' : '—') +
          ' frente al KPI (trazabilidad a validar).</div>';
      }
    });

    function seccion(icon, titulo, items) {
      var lis = (items || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("");
      return '<div class="cn-ejec__sec"><div class="cn-ejec__sec-hd"><i class="bi ' + icon + '"></i> ' + titulo + '</div>' +
        '<ul class="cn-ejec__list">' + lis + '</ul></div>';
    }

    var s = d.secciones || {};
    // Diagnóstico temporal: si cae a "resumen base" con Gemma activa, mostrar POR QUÉ falló.
    var diag = m.llm_diag || {};
    var motivo = "";
    if (m.generado_por === "fallback" && diag.status && diag.status !== "off") {
      motivo = ' <span class="cn-ins__fb" title="' + esc(diag.raw || "") + '">· Gemma: ' + esc(diag.status) + '</span>';
    }
    // [2026-07-27 · opción A] ECP: encabezado = compromiso P50 (async, /api/analisis/president). Filiales:
    // se conserva el KPI operativo (no hay president para filiales). Las tarjetas KPI de ECP bajan a los focos.
    // [2026-07-29] El compromiso P50 es ECP-GLOBAL (escala kbpe corporativa). Puesto debajo de
    // "Desempeño de CASTILLA" invita a leer el 96,8% como si fuera del campo, y no lo es. En
    // drill-down a una entidad NO se muestra; el encabezado no queda huérfano porque las tarjetas
    // operativas de cada producto ya viven en su foco (opción A del 27-jul).
    var kpiHeader = __cnEsFil()
      ? '<div class="cn-kpi__row">' + __cnTarjetasKpiHtml(d.tarjetas || [], m.periodo) + '</div>'
      : (__cnPanelEntidad ? ""
        : '<div class="cn-p50hd__lbl"><i class="bi bi-flag-fill"></i> ECP · Cumplimiento del compromiso corporativo ' +
          '<b>(P50)</b> <span class="cn-p50hd__u">· promedio del mes en kbpe</span></div>' +
          '<div class="cn-kpi__row" id="cn-p50-row"><div class="cn-p50hd__load">Cargando compromiso P50…</div></div>');
    var head =
      '<div class="cn-ejec__hd"><span class="cn-ejec__hd-ic"><i class="bi bi-stars"></i></span>' +
      '  Análisis Ejecutivo (IA) · ' + esc(m.periodo || "") + ' · corte ' + esc(m.corte || "") +
      (m.generado_por === "fallback" ? ' <span class="cn-ins__fb">(resumen base)</span>' + motivo : '') + '</div>' +
      kpiHeader;

    // Nivel 2 = Focos de atención SIEMPRE. Reemplazan el brief legacy (INSIGHTS/OPORTUNIDADES/…) y su
    // caja de error de Gemma, que era un artefacto de pruebas: el panel es DETERMINISTA (tarjetas +
    // focos, sin LLM), así que un brief que falle NO debe interrumpir la vista. Si el brief LLM no
    // sirvió, se deja rastro solo en consola (dev). Sin focos -> __cnFocosHtml pinta un estado vacío.
    if ((m.generado_por === "error") ||
        (m.generado_por === "fallback" && diag.status && diag.status !== "off")) {
      try { console.warn("[ejecutivo] brief LLM no usable (no afecta el panel):", diag.status, diag.raw || ""); } catch (e) {}
    }
    return head + noteReconc + __cnFocosHtml(d.focos || [], d.sin_foco, m, d.tarjetas || []) +
      __cnPorFilialHtml(d.por_filial, m.periodo);
  }

  // Desglose POR FILIAL (solo segmento filiales): un bloque por filial con sus tarjetas Crudo/Gas/Blancos
  // (mismo formato que el panorama agrupado; cada una vs su propio promedio 2026). Vacío para ECP.
  // Chip-resumen por producto para el encabezado colapsado del acordeón: nombre + punto de estado.
  function __cnFilialChips(tarjetas) {
    if (!tarjetas || !tarjetas.length) return "";
    return tarjetas.map(function (k) {
      var sem = k.estado === "alineado" ? "is-ok" : (k.estado === "ajustado" ? "is-warn" :
                 (k.estado === "actuar" ? "is-bad" : ""));
      var nombre = k.producto.charAt(0).toUpperCase() + k.producto.slice(1).toLowerCase();
      return '<span class="cn-filial__chip ' + sem + '"><i class="cn-filial__dot"></i>' + esc(nombre) + '</span>';
    }).join("");
  }

  function __cnPorFilialHtml(lista, periodo) {
    if (!lista || !lista.length) return "";
    var secs = lista.map(function (f) {
      var _nm = (f.n_meses != null) ? f.n_meses : f.n_base;   // n_meses = meses reales (n_base era productos)
      var nota = (_nm != null && _nm < 3)
        ? ' <span class="cn-filial__note">(promedio sobre ' + _nm + ' mes' + (_nm === 1 ? '' : 'es') + ' de 2026)</span>'
        : '';
      return '<div class="cn-filial">' +   // por default TODAS colapsadas (solo chips visibles)
        '<div class="cn-filial__hd" onclick="window.__cnFilialToggle(this)">' +
        '<i class="bi bi-chevron-right cn-filial__chev"></i>' +
        '<i class="bi bi-diagram-3"></i> <span class="cn-filial__name">' + esc(f.empresa) + '</span>' + nota +
        '<span class="cn-filial__chips">' + __cnFilialChips(f.tarjetas) + '</span></div>' +
        '<div class="cn-filial__body"><div class="cn-kpi__row">' +
        __cnTarjetasKpiHtml(f.tarjetas || [], periodo) + '</div></div>' +
        '</div>';
    }).join("");
    return '<div class="cn-filial__wrap">' +
      '<div class="cn-filial__title">Comportamiento por filial</div>' + secs + '</div>';
  }

  function __cnEjPct(d, p) {
    var t = (d.titular || []).find(function (x) { return x.producto === p; }) || {};
    return t.valor_pct;
  }

  // Selector de producto (Crudo/Gas/Blancos) + UN solo set de gráficos (el del producto activo)
  function __cnEjecChartsHtml(d) {
    var order = ["CRUDO", "GAS", "BLANCOS"];
    var gp = d.gap_por_producto || {};
    var prods = order.filter(function (p) { return gp[p]; });
    if (!prods.length) return '<div class="cn-ejec__empty">Sin desglose por campo para graficar.</div>';
    __cnEjecData = d;
    // por defecto, el producto más crítico (menor % del presupuesto)
    __cnEjecProd = prods.slice().sort(function (a, b) {
      return (__cnEjPct(d, a) == null ? 999 : __cnEjPct(d, a)) - (__cnEjPct(d, b) == null ? 999 : __cnEjPct(d, b));
    })[0];
    // [2026-08-11] D1: la pestaña deja de colorearse por ESTADO (__cnSemColor) — sería
    // indistinguible del rojo/ámbar de alerta que ya usa la app. El color identifica al PRODUCTO;
    // el % de cumplimiento sigue visible como dato, sin codificarlo también en el fondo.
    var tabs = prods.map(function (p) {
      var pct = __cnEjPct(d, p);
      return '<button type="button" class="cn-ejec__tab' +
        (p === __cnEjecProd ? ' is-active' : '') + '" data-prod="' + p +
        '" style="--cp-prod:' + __cnProdCol(p) + '" onclick="window.__cnEjecShowProd(\'' + p + '\')">' + esc(p) +
        '<span>' + (pct == null ? "—" : pct + "%") + '</span></button>';
    }).join("");
    return '<div class="cn-ejec__charts-hd"><i class="bi bi-bar-chart-line"></i> Sustento por ' + (__cnEsFil() ? "filial" : "campo") + '</div>' +
      '<div class="cn-ejec__tabs">' + tabs + '</div>' +
      '<div id="cn-ejec-prodwrap"></div>';
  }

  function __cnEjecProdHtml(d, p) {
    var pct = __cnEjPct(d, p);
    var ent = __cnEsFil() ? "filial" : "campo";
    // Con el producto EN meta la pregunta "cuánto le faltó" no aplica: el mismo gráfico se titula
    // por lo que muestra siempre (real de cada campo contra su marca de meta).
    var t1 = (pct != null && pct >= 100) ? ("Meta vs Real por " + ent)
                                         : ("Cuánto le faltó a cada " + ent + " para su meta");
    return '<div class="cn-ejec__prod">' +
      '<div class="cn-ejec__prod-hd" style="--cp-prod:' + __cnProdCol(p) + '">' + esc(p) +
      ' <span>· ' + (pct == null ? "—" : pct + "%") + ' del presupuesto</span></div>' +
      '<div class="cn-ejec__ch"><div class="cn-ejec__ch-t">' + t1 + '</div>' +
      '<svg class="cn-ejec__svg" id="ejc-b-' + p + '" role="img"></svg></div>' +
      '<div class="cn-ejec__ch"><div class="cn-ejec__ch-t">Balance por ' + ent + ': quién arrastra y quién amortigua</div>' +
      '<svg class="cn-ejec__svg" id="ejc-d-' + p + '" role="img"></svg></div>' +
      '</div>';
  }

  // Filas para los gráficos. Bullet: solo campos CON meta (sin meta no hay marca contra la cual
  // comparar). Divergente: todos, pero los sin meta van señalados (D-A4: su volumen no es un
  // "excedente" frente a un presupuesto que no existe).
  function __ejRowsB(g) {
    return (g.detractores || []).concat(g.compensadores || [])
      .filter(function (r) { return r.meta > 0; });
  }

  // Pinta el set de gráficos del producto activo (por defecto, tras montar el panel)
  function __cnEjecCharts(d) {
    if (__cnEjecProd) window.__cnEjecShowProd(__cnEjecProd);
  }

  // Cambia entre Crudo/Gas/Blancos sin refetch (los datos ya están en el payload)
  window.__cnEjecShowProd = function (p) {
    var d = __cnEjecData; if (!d) return;
    var g = (d.gap_por_producto || {})[p]; if (!g) return;
    __cnEjecProd = p;
    var tabs = document.querySelectorAll(".cn-ejec__tab");
    Array.prototype.forEach.call(tabs, function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-prod") === p);
    });
    var wrap = el("cn-ejec-prodwrap"); if (!wrap) return;
    wrap.innerHTML = __cnEjecProdHtml(d, p);
    var b = el("ejc-b-" + p); if (b) __ejecBullet(b, __ejRowsB(g));
    var v = el("ejc-d-" + p); if (v) __ejecDiverg(v, g.detractores || [], g.compensadores || []);
    __cnEjecFit(p, g);
  };

  // Estira los 2 gráficos para llenar el alto libre del panel derecho (mide el hueco y reparte)
  function __cnEjecFit(p, g) {
    var run = function () {
      var right = document.querySelector(".cn-ejec__right");
      var svgB = el("ejc-b-" + p), svgD = el("ejc-d-" + p);
      if (!right || !svgB || !svgD) return;
      var used = 0, kids = right.children;
      for (var i = 0; i < kids.length; i++) used += kids[i].offsetHeight;
      var extra = right.clientHeight - used - 24;   // hueco libre bajo el contenido actual
      if (extra < 40) return;                        // ya llena, no agrandar
      var nB = Math.max(__ejRowsB(g).length, 1);
      var nD = Math.max((g.detractores || []).length + (g.compensadores || []).length, 1);
      var curB = svgB.getBoundingClientRect().height, curD = svgD.getBoundingClientRect().height;
      __ejecBullet(svgB, __ejRowsB(g), curB + extra * nB / (nB + nD));
      __ejecDiverg(svgD, g.detractores || [], g.compensadores || [], curD + extra * nD / (nB + nD));
    };
    (window.requestAnimationFrame || function (f) { setTimeout(f, 30); })(run);
  }

  // ---- helpers SVG (sin dependencias; paleta acorde al panel claro) ----
  var __EJC = { prod:"#3d6b83", falt:"#c0392b", dom:"#8f1d16", exc:"#2f8f5b", smx:"#9db8aa",
                muted:"#5c6b63", ink:"#14201b", line:"#d9e2dc" };
  function __ejEl(tag, attrs, txt) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (txt != null) e.textContent = txt;
    return e;
  }
  // Barriles EXACTOS, igual que el KPI de al lado (2026-07-16). Dos iteraciones para llegar aquí:
  // primero todo se dividía por 1e6 con 1 decimal ("faltó 0,0 M" para 3.085 barriles: no informaba);
  // luego M/k dinámico, que seguía redondeando ("faltó 1,0 M" escondía 21.211 barriles de los
  // 1.021.211 reales) mientras el recuadro vecino mostraba 3.720.510 al barril. Dos precisiones
  // distintas para el mismo dato, a 2 cm una de otra. Se acabó: aquí también va la cifra exacta.
  function __ejFmtVal(v) {
    return Math.round(v).toLocaleString("es");
  }
  function __ejClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  // Meta vs Real: barra azul = producido, marca = meta. Por debajo → tramo rojo "faltó X";
  // por encima → la barra rebasa la marca y la etiqueta es "+X" verde (antes solo entraban
  // detractores: con la entidad EN meta el gráfico quedaba vacío).
  function __ejecBullet(svg, rows, targetH) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!rows.length) {
      svg.setAttribute("viewBox", "0 0 720 40");
      svg.appendChild(__ejEl("text", { x:8, y:24, "font-size":12, fill:__EJC.muted },
        "Sin metas por campo para comparar."));
      return;
    }
    // mR holgado: la etiqueta lleva la cifra EXACTA ("faltó 1.021.211"), que es más ancha que el
    // "1,0 M" de antes. Con el margen viejo (84) se salía del viewBox.
    var W = 720, mL = 92, mR = 124, mT = 10, mB = 26;
    var rowH = targetH ? __ejClamp((targetH - mT - mB) / rows.length, 40, 120) : 46;
    var H = mT + mB + rowH * rows.length;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var pw = W - mL - mR;
    // la escala considera real Y meta: una barra por encima de la meta no debe desbordar el lienzo
    var maxV = Math.max.apply(null, rows.map(function (d) { return Math.max(d.meta, d.real); }));
    if (!(maxV > 0)) maxV = 1;
    svg.appendChild(__ejEl("line", { x1:mL, y1:mT, x2:mL, y2:H - mB, stroke:__EJC.line, "stroke-width":1 }));
    rows.forEach(function (d, i) {
      var yc = mT + rowH * i + rowH / 2, bh = __ejClamp(rowH * 0.42, 16, 40);
      var realW = pw * (Math.max(d.real, 0) / maxV), metaW = pw * (d.meta / maxV);
      var sobre = d.real >= d.meta;
      svg.appendChild(__ejEl("rect", { x:mL, y:yc - bh / 2, width:Math.max(realW,0), height:bh, rx:2, fill:__EJC.prod }));
      if (!sobre)
        svg.appendChild(__ejEl("rect", { x:mL + realW, y:yc - bh / 2, width:Math.max(metaW - realW, 0), height:bh, rx:2,
          fill: i === 0 ? __EJC.dom : __EJC.falt }));
      svg.appendChild(__ejEl("line", { x1:mL + metaW, y1:yc - bh / 2 - 4, x2:mL + metaW, y2:yc + bh / 2 + 4,
        stroke:__EJC.muted, "stroke-width":2.5 }));
      svg.appendChild(__ejEl("text", { x:mL - 8, y:yc + 4, "text-anchor":"end", "font-size":12,
        "font-weight": i === 0 ? 700 : 550, fill:__EJC.ink }, d.campo));
      var tipX = mL + Math.max(metaW, realW) + 7;
      var lbl = sobre ? ("+" + __ejFmtVal(d.real - d.meta))
                      : ("faltó " + __ejFmtVal(d.meta - d.real));
      svg.appendChild(__ejEl("text", { x:tipX, y:yc + 4, "text-anchor":"start", "font-size":11,
        "font-weight":650, fill: sobre ? __EJC.exc : (i === 0 ? __EJC.dom : __EJC.falt) }, lbl));
    });
  }
  // Balance: faltante (rojo, izquierda) vs excedente (verde, derecha), ordenado por magnitud
  function __ejecDiverg(svg, detr, comp, targetH) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    // sm = sin meta (D-A4): su volumen no es un "excedente" contra un presupuesto que no existe
    var rows = detr.map(function (d) { return { campo:d.campo, v:d.gap, sm:!(d.meta > 0) }; })
      .concat(comp.map(function (d) { return { campo:d.campo, v:d.gap, sm:!(d.meta > 0) }; }))
      .sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); });
    if (!rows.length) { svg.setAttribute("viewBox", "0 0 720 40"); return; }
    var W = 720, mT = 8, mB = 8;
    var rowH = targetH ? __ejClamp((targetH - mT - mB) / rows.length, 32, 96) : 40;
    var H = mT + mB + rowH * rows.length;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    // eje cero CENTRADO; las barras divergen simétricas. half acortado (250→214) para dejar sitio a
    // la cifra exacta en la punta ("+161.659 · sin meta" no cabía y se salía del viewBox).
    var cx = W / 2, half = 214;
    var maxAbs = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.v); })) || 1;
    svg.appendChild(__ejEl("line", { x1:cx, y1:mT, x2:cx, y2:H - mB, stroke:__EJC.line, "stroke-width":1.5 }));
    rows.forEach(function (r, i) {
      var yc = mT + rowH * i + rowH / 2, len = half * (Math.abs(r.v) / maxAbs), neg = r.v < 0,
          bh = __ejClamp(rowH * 0.4, 14, 30);
      var x = neg ? cx - len : cx;
      svg.appendChild(__ejEl("rect", { x:x, y:yc - bh / 2, width:Math.max(len, 1), height:bh, rx:3,
        fill: neg ? (i === 0 ? __EJC.dom : __EJC.falt) : (r.sm ? __EJC.smx : __EJC.exc) }));
      // etiqueta del campo al lado del eje OPUESTO a la barra (hacia el centro, siempre legible)
      svg.appendChild(__ejEl("text", { x: neg ? cx + 8 : cx - 8, y:yc + 4,
        "text-anchor": neg ? "start" : "end", "font-size":12,
        "font-weight": (neg && i === 0) ? 700 : 550, fill:__EJC.ink }, r.campo));
      // valor en la punta exterior de la barra
      var tip = neg ? x : cx + len;
      svg.appendChild(__ejEl("text", { x: neg ? tip - 6 : tip + 6, y:yc + 4,
        "text-anchor": neg ? "end" : "start", "font-size":11, "font-weight":600,
        fill: neg ? __EJC.falt : (r.sm ? __EJC.muted : __EJC.exc) },
        (neg ? "−" : "+") + __ejFmtVal(Math.abs(r.v)) + (r.sm ? " · sin meta" : "")));
    });
  }

  // ---- Panorama: densidad (KPIs + matriz de días, CSS puro, sin Plotly) ----
  function __cnPanoDensidad(d) {
    if (!d || d.aplica_ecp === false)
      return '<div class="rb-pano__empty"><i class="bi bi-clipboard2-data"></i>Sin huella de reporte a grano diario ECP para esta entidad.</div>';
    var res = d.resumen || {}, meses = d.por_mes || [];
    if (!res.total_dias) return '<div class="rb-pano__empty">Sin días con datos.</div>';
    var present = {};   // "anio-mes" -> {dia:1}
    (d.dias || []).forEach(function (x) {
      var p = String(x.fecha).split("-");
      var key = p[0] + "-" + parseInt(p[1], 10);
      (present[key] = present[key] || {})[parseInt(p[2], 10)] = 1;
    });
    var axis = '<div class="rb-pano__matrix-row"><div class="rb-pano__matrix-mlabel"></div>';
    for (var a1 = 1; a1 <= 31; a1++) axis += '<div class="rb-pano__axis">' + a1 + '</div>';
    axis += '</div>';
    var rows = meses.map(function (m) {
      var set = present[m.anio + "-" + m.mes] || {}, cells = "";
      for (var day = 1; day <= 31; day++) {
        if (day > m.dias_del_mes) cells += '<div class="rb-pano__dot rb-pano__dot--none"></div>';
        else if (set[day]) cells += '<div class="rb-pano__dot rb-pano__dot--on" title="' + esc(m.mes_nombre) + ' ' + day + ' · con reporte"></div>';
        else cells += '<div class="rb-pano__dot rb-pano__dot--off" title="' + esc(m.mes_nombre) + ' ' + day + ' · sin dato"></div>';
      }
      return '<div class="rb-pano__matrix-row"><div class="rb-pano__matrix-mlabel">' + esc(m.mes_nombre) + ' ' + m.anio + '</div>' + cells + '</div>';
    }).join("");
    var rango = (res.rango && res.rango[0]) ? (__cnFmtFecha(res.rango[0]) + ' → ' + __cnFmtFecha(res.rango[1])) : "";
    var foot = '<div class="rb-pano__matrix-foot">' +
      '<span class="rb-pano__leg"><span class="rb-pano__dot rb-pano__dot--on"></span>con reporte</span>' +
      '<span class="rb-pano__leg"><span class="rb-pano__dot rb-pano__dot--off"></span>sin dato</span>' +
      '<span class="rb-pano__matrix-range">' + esc(rango) + '</span></div>';
    return '<div class="rb-pano__matrix-card">' +
      '<div class="rb-pano__eyebrow"><i class="bi bi-grid-3x3"></i>Densidad temporal · matriz de días</div>' +
      '<div class="rb-pano__matrix">' + axis + rows + '</div>' + foot + '</div>';
  }

  // ---- Panorama: cobertura (medidores agrupados por capa) ----
  var __cnLayerId = {"Producción ECP": "ecp", "Filiales": "fil", "Comentarios": "com",
    "Hojas modeladas (visor)": "mod", "Preservada en crudo (Bronze)": "brz"};
  function __cnPanoCobertura(cob) {
    if (!cob || !cob.categorias) return '<div class="rb-pano__empty">Sin datos de cobertura.</div>';
    var ent = cob.entidad || "";
    var head = '<div class="rb-pano__eyebrow"><i class="bi bi-grid-3x3-gap-fill"></i>Cobertura del reporte</div>' +
      '<div class="rb-pano__cov-title">Presencia de <strong>' + esc(ent) + '</strong> · <b>' +
      (cob.hojas_con_entidad || 0) + ' de ' + cob.total_hojas + ' hojas</b></div>' +
      '<div class="rb-pano__cov-desc">Nº de reportes donde cada hoja contiene la entidad. RAW vía ' +
      '<code>facts</code> (exacto); el resto vía coincidencia por texto.</div>';
    var groups = cob.categorias.map(function (c) {
      var hojas = c.hojas.filter(function (h) { return (h.reportes_entidad || 0) > 0; });   // hideEmpty
      if (!hojas.length) return "";
      var lid = __cnLayerId[c.categoria] || "brz";
      var esLanding = (c.categoria !== "Producción ECP");   // D-BADGE exacto
      var sumN = 0, sumT = 0;
      hojas.forEach(function (h) { sumN += (h.reportes_entidad || 0); sumT += (h.reportes_total || 0); });
      var pct = sumT ? Math.round(sumN / sumT * 100) : 0;
      var rows = hojas.map(function (h) {
        var n = h.reportes_entidad || 0, t = h.reportes_total || 0, full = (t > 0 && n >= t);
        var w = t ? Math.round(n / t * 100) : 0;
        var badge = esLanding ? '<span class="rb-pano__cov-badge">texto</span>' : "";
        return '<div class="rb-pano__cov-row">' +
          '<div class="rb-pano__cov-name">' + esc(h.hoja) + badge + '</div>' +
          '<div class="rb-pano__meter" role="meter" aria-valuenow="' + n + '" aria-valuemin="0" aria-valuemax="' + t + '" ' +
          'aria-label="' + esc(h.hoja) + ': ' + n + ' de ' + t + '">' +
          '<span class="rb-pano__meter-fill rb-pano__meter-fill--' + lid + (full ? ' is-full' : '') + '" style="width:' + w + '%;"></span></div>' +
          '<div class="rb-pano__cov-count' + (full ? ' is-full' : '') + '">' + n + '<em>/' + t + '</em></div></div>';
      }).join("");
      return '<div class="rb-pano__cov-group"><div class="rb-pano__cov-ghead">' +
        '<span class="rb-pano__cov-ldot rb-pano__cov-ldot--' + lid + '"></span>' +
        '<span class="rb-pano__cov-glabel">' + esc(c.categoria) + '</span>' +
        '<span class="rb-pano__cov-gn">' + hojas.length + ' hojas</span>' +
        '<span class="rb-pano__cov-gpct">' + pct + '%</span></div>' + rows + '</div>';
    }).join("");
    return '<div class="rb-pano__cov-card">' + head + groups + '</div>';
  }

  // --- Hilo tipo timeline (2026-08-25): riel + avatar + cabecera de autor + burbuja ---
  // `time` y `grupo` son OPCIONALES y van al final: las llamadas existentes siguen siendo
  // válidas sin tocarlas. Si `time` falta NO se pinta hora (historiales guardados antes de este
  // cambio, e indicador de "escribiendo"): jamás se fabrica una hora que no es la del turno.
  // El riel que une los turnos es un ::after del rail anulado en :last-child — se resuelve en CSS
  // y no obliga a repintar la fila anterior en cada append (chat_n.md §6 lo pasaba como prop).
  function __cnAppendRaw(role, html, time, grupo) {
    var m = el("cn-messages"); if (!m) return null;
    var esUser = (role === "user");
    var nom = esUser ? (__cnNombre() || "Tú") : "ProdIA";
    var avatar = esUser
      ? '<div class="cn-avatar cn-avatar--user" aria-hidden="true">' +
        esc(nom.charAt(0).toUpperCase()) + '</div>'
      : '<div class="cn-avatar cn-avatar--bot" aria-hidden="true">' +
        '<img src="/static/img/chatbot-for-conversations.png" alt=""></div>';
    // Traza del clasificador (D-2): el color del grupo entra como variable inline y el CSS lo
    // pinta como filete lateral. NUNCA como fondo — el soft de "cuantificar" (#E9F3EC) es el
    // MISMO hex que --rb-user-bg y la burbuja del bot se confundiría con la del usuario (H-02).
    // __V2_GRUPO se declara más abajo (:5063): con `var` ya está asignada cuando esto se ejecuta (H-12).
    var g = (!esUser && grupo && __V2_GRUPO[grupo]) ? __V2_GRUPO[grupo] : null;
    var attrG = g ? ' data-g="' + esc(grupo) + '" style="--v2c:' + g.color + ';"' +
      ' title="Motor v2 · ' + esc(g.label) + '"' : "";
    var d = document.createElement("div");
    d.className = "cn-row " + (esUser ? "cn-row--user" : "cn-row--bot");
    d.innerHTML =
      '<div class="cn-row__rail">' + avatar + '</div>' +
      '<div class="cn-row__main">' +
        '<div class="cn-row__head">' +
          '<span class="cn-row__author">' + esc(nom) + '</span>' +
          (time ? '<time class="cn-row__time">' + esc(time) + '</time>' : '') +
        '</div>' +
        '<div class="cn-bubble ' + (esUser ? 'is-user' : 'is-bot') + '"' + attrG + '>' + html + '</div>' +
      '</div>';
    m.appendChild(d); m.scrollTop = m.scrollHeight; return d;
  }
  function __cnBubble(role, html, grupo) {
    // Primera pregunta: la PORTADA cede el sitio al chat normal. Se retira ANTES de
    // appendear, porque __cnAppendRaw hace appendChild y la burbuja quedaría debajo de ella.
    // [2026-08-24] Ya NO se repinta el historial aquí: el saludo dejó de sembrarse
    // (ver __cnReplay), así que con la portada fuera el chat arranca directamente con la
    // pregunta del usuario. Antes esto reinyectaba el saludo como burbuja y sobraba.
    var m = el("cn-messages");
    if (m) {
      var portada = m.querySelector(".cn-portada");
      if (portada) m.innerHTML = "";
    }
    // [2026-08-25] El sello de hora y el grupo viajan EN el historial: __cnReplay repinta desde
    // aquí, así que calcularlos al pintar daría la hora del repintado y perdería la traza de color.
    var hora = __cnHora();
    __cnHistory.push({role: role, html: html, time: hora, grupo: grupo || null});
    var d = __cnAppendRaw(role, html, hora, grupo);
    // Sale del estado de inicio en cuanto hay algo más que el saludo (la burbuja del
    // usuario ya cuenta): la portada es solo para la pantalla vacía.
    if (typeof __cnEstadoInicio === "function") __cnEstadoInicio();
    return d;
  }
  function __cnTyping() {   // indicador efímero (NO va al historial). Imagen del bot + etiqueta en 2
    // fases por LATENCIA (Opción C): Capa 1 (regex) resuelve en ms → la etiqueta genérica apenas se
    // ve; si a los ~900ms la petición SIGUE viva, es que escaló al LLM (Capa 2 / envoltura cordial) →
    // la 2ª etiqueta lo dice honestamente. Sin SSE: la latencia misma es la señal de la etapa real.
    var d = __cnAppendRaw("assistant", '<div class="simple-loading">' +
      '<span class="loading-text">Entendiendo tu pregunta</span>' +
      '<div class="typing-dots"><span>.</span><span>.</span><span>.</span></div></div>');
    // One-shot guardado por isConnected: si el caller ya hizo load.remove() no hace nada → sin fuga.
    setTimeout(function () {
      if (!d || !d.isConnected) return;
      var t = d.querySelector(".loading-text");
      if (t) t.textContent = "Consultando con la IA… puede tardar un momento";
    }, 900);
    return d;
  }
  // --- Estado de los botones de desambiguación (evitar clics que producen preguntas expiradas) ---
  var __cnOptsOpen = false;   // ¿hay una desambiguación viva (sin responder)?
  function __cnDisableOpts() {   // deshabilita TODOS los botones de opción presentes en el chat
    var btns = document.querySelectorAll("#cn-messages .cn-opt-btn");
    Array.prototype.forEach.call(btns, function (b) {
      b.setAttribute("disabled", ""); b.classList.add("disabled");
      b.style.opacity = "0.55"; b.style.pointerEvents = "none";
    });
  }
  function __cnEnableLastOpts() {   // reactiva SOLO el último grupo (la desambiguación viva)
    var msgs = document.querySelectorAll("#cn-messages .cn-row--bot");
    for (var i = msgs.length - 1; i >= 0; i--) {
      var btns = msgs[i].querySelectorAll(".cn-opt-btn");
      if (btns.length) {
        Array.prototype.forEach.call(btns, function (b) {
          b.removeAttribute("disabled"); b.classList.remove("disabled");
          b.style.opacity = ""; b.style.pointerEvents = "";
        });
        return;
      }
    }
  }

  // ===== [2026-07-30] Saludo anclado al panel (mejora progresiva, 3 etapas) =====
  // S1 · El saludo se pinta ANTES de que exista ningún número (los fetches del panel arrancan
  // después), así que sale ya en su forma base y se enriquece cuando los datos llegan. Ninguna
  // etapa bloquea a la anterior: si el fetch falla, el saludo anterior sigue siendo correcto.
  // S4 · __cnHistory guarda HTML renderizado -> cada etapa reescribe __cnHistory[0].html, o el
  // saludo revertiría al cambiar de pestaña y volver.
  // Payloads que alimentan el panorama del saludo (3 fuentes): desempeño (fecha de corte +
  // proyección/brecha), president (compromiso P50 por producto) y ejecutivo (detractores del gap).
  var __cnSalDes = null, __cnSalP50 = null, __cnSalEje = null, __cnSalP50Pedido = false;

  function __cnSaludo() { return "Hola"; }
  function __cnTitCampo(s) {  // "CANO SUR ESTE" -> "Caño sur este" (título por palabra)
    return String(s || "").toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // Panorama narrativo (3 renglones) desde las 3 fuentes. Devuelve HTML o null si falta lo esencial.
  //  1) productos dentro de lo proyectado (gap P50 >= 0)   2) puntos de atención (gap P50 < 0) + campos
  //     detractores del gap   3) proyección de cierre vs presupuesto (brecha_abs).
  function __cnSaludoPanorama() {
    var pd = __cnSalP50, ed = __cnSalEje, dd = __cnSalDes;
    if (!pd || !pd.productos || !pd.productos.length) return null;   // el P50 es el dato clave (96,8%)
    var ok = [], att = [];
    pd.productos.forEach(function (p) {
      var real = p.real_mes, base = p.base_p50;
      var gap = (real != null && base != null) ? (real - base) : null;
      if (gap == null) return;
      var it = { nom: String(p.entidad || "").toLowerCase(), PROD: String(p.entidad || "").toUpperCase(),
                 cumpl: p.cumpl_p50 };
      (gap >= 0 ? ok : att).push(it);
    });
    if (!ok.length && !att.length) return null;
    // El detalle de "puntos de atención" (campos detractores + proyección) lo dispara /ejecutivo (la
    // IA). Mientras no haya llegado, se muestra el indicador de carga en vez del análisis incompleto.
    var edReady = !!(ed && ed.gap_por_producto);
    if (att.length && !edReady) return "__LOADING__";
    var b = [];
    if (ok.length) {
      var nombres = ok.map(function (x) { return x.nom; });
      var lista = nombres.length === 1 ? nombres[0]
        : nombres.slice(0, -1).join(", ") + " y " + nombres[nombres.length - 1];
      var cuant = nombres.length === 1 ? "" : (nombres.length === 2 ? "ambos " : "todos ");
      b.push("Los productos " + esc(lista) + " van bien, " + cuant + "dentro de lo proyectado.");
    }
    if (att.length) {
      att.sort(function (a, c) { return (a.cumpl || 0) - (c.cumpl || 0); });   // el más rezagado primero
      var a0 = att[0];
      var pct = (a0.cumpl != null) ? String(a0.cumpl).replace(".", ",") + "%" : "—";
      var dets = ((ed && ed.gap_por_producto && ed.gap_por_producto[a0.PROD]
                   && ed.gap_por_producto[a0.PROD].detractores) || [])
                  .slice(0, 2).map(function (x) { return __cnTitCampo(x.campo); });
      var s2 = "Puntos de atención: el producto " + esc(a0.nom) + " va al " + esc(pct) + " del P50";
      if (dets.length) s2 += ", el gap viene principalmente de los campos " +
        esc(dets.length === 1 ? dets[0] : dets.join(" y "));
      s2 += ".";
      var tj = ((ed && ed.tarjetas) || []).filter(function (k) { return k.producto === a0.PROD; })[0];
      if (tj && tj.brecha_abs) {
        var bt = (a0.PROD === "GAS") ? __cnGasM(tj.brecha_abs) : __cnFmtKpi(tj.brecha_abs);
        var uni = tj.unidad ? (" " + tj.unidad) : " bbl";
        s2 += " Si el ritmo no cambia, " + esc(a0.nom) + " cerraría unos " + bt + uni +
              " por debajo del presupuesto.";
      }
      b.push(s2);
    }
    return b.map(function (x) { return "• " + x; }).join("<br>");
  }

  function __cnSaludoHtml() {
    var n = __cnNombre();
    var saludo = __cnSaludo() + (n ? " " + esc(n) : "") + ", bienvenido.";
    // [2026-08-24] Saludo ESTÁTICO: sin datos de producción ni llamadas al backend/LLM.
    // Antes se armaba con /desempeno + /president + /ejecutivo (__cnSaludoPanorama) y
    // mostraba un spinner "Consultando con la IA…" mientras Gemma respondía. Se retiró
    // por decisión del usuario (saludo sin nada dinámico); el panorama del mes vive en
    // el panel derecho (tarjetas P50). Se pierde el "con corte a N de <mes>", que salía
    // de la curva diaria de /desempeno — endpoint que el panorama global ya no pide.
    // [2026-08-24] Saludo BREVE, a petición del usuario (referencia: la pantalla de
    // bienvenida de una interfaz conversacional de referencia). Se retiró el menú de tres categorías —Estructura /
    // Cifras / Análisis con sus ejemplos— que exponía la taxonomía interna del
    // clasificador antes de que el usuario escribiera nada.
    // ⚠️ COSTE ASUMIDO Y CONSCIENTE: ese menú era el único sitio donde se anunciaban
    // las sub-intenciones que el motor YA responde pero nadie adivina —diferidas,
    // mantenimientos, EBITDA/NOPAT, proyección de cierre—. El commit ec74ced las había
    // añadido justo porque sin nombrarlas no se encontraban. Al quitarlas se gana
    // limpieza y se pierde descubrimiento. Si reaparece la necesidad, el camino
    // acordado NO es volver al párrafo: son sugerencias pulsables bajo la caja de
    // entrada (mismo contenido, sin muro de texto).
    var cuerpo = "A la derecha tienes el <strong>desempeño del mes</strong>.";
    return saludo + "<br>" + cuerpo +
      '<br><br>¿Por dónde arrancamos?';
  }

  // [2026-08-24] PORTADA de bienvenida. NO es una burbuja: mientras el chat está vacío se
  // pinta esto en lugar del saludo, con la mascota grande y el saludo en tipografía grande
  // (maqueta del usuario). En cuanto llega la primera pregunta desaparece para siempre y el
  // chat vuelve a su forma normal.
  //
  // Va DIRECTA a #cn-messages, sin pasar por __cnAppendRaw ni por __cnHistory: meterla en el
  // historial la convertiría en un turno de la conversación —se repintaría entre los mensajes
  // al volver a la pestaña, y __cnBubble la contaría al decidir si el chat está vacío—. El
  // historial sigue guardando el saludo de texto (__cnSaludoHtml), que es lo que se ve si
  // alguna vez hace falta mostrarlo como burbuja.
  //
  // La imagen es la misma del login (static/img/Pord_IA.png), no el avatar de las burbujas:
  // la eligió el usuario. alt="" y aria-hidden porque el saludo de al lado ya dice lo mismo;
  // anunciarla dos veces a un lector de pantalla sería ruido.
  function __cnPortadaHtml() {
    var n = __cnNombre();
    return '<div class="cn-portada">' +
      '<img class="cn-portada__img" src="/static/img/Pord_IA.png" alt="" aria-hidden="true">' +
      '<p class="cn-portada__saludo">¡Hola' + (n ? " " + esc(n) : "") + ', bienvenido!</p>' +
      '</div>';
  }

  // Repinta la burbuja del saludo (DOM completo) y el historial. Solo si el saludo es la ÚNICA burbuja.
  function __cnSaludoRefresh() {
    // [2026-08-25 · H-09] La guarda original se escribió cuando el saludo ERA el turno 0 del
    // historial. Desde 2026-08-24 el saludo no se siembra (__cnReplay pinta la portada y retorna),
    // así que length===1 significa "el usuario ya preguntó y aún no hay respuesta": sin comprobar
    // el rol, este refresco machacaba la PREGUNTA del usuario —y con ella el título con el que
    // historial.js guarda la conversación—.
    if (__cnHistory.length !== 1 || __cnHistory[0].role !== "assistant") return;
    var html = __cnSaludoHtml();
    __cnHistory[0].html = html;
    var mm = el("cn-messages");
    var bub = mm && mm.querySelector(".cn-row--bot .cn-bubble");
    if (bub) bub.innerHTML = html;
  }

  // E1 · /analisis/desempeno (global): fecha de corte + proyección/brecha. Dispara además la carga
  // del compromiso P50 (una sola vez) que necesita el panorama.
  function __cnSaludoDesdeDesemp(d) {
    if (!d || !((d.mes || {}).nombre)) return;
    __cnSalDes = d;
    if (!__cnSalP50Pedido) {
      __cnSalP50Pedido = true;
      fetch("/api/analisis/president").then(function (r) { return r.json(); })
        .then(function (p) { if (p && p.productos) { __cnSalP50 = p; __cnSaludoRefresh(); } })
        .catch(function () {});
    }
    __cnSaludoRefresh();
  }

  // E2 · /analisis/ejecutivo (global): detractores del gap por producto (gap_por_producto).
  function __cnSaludoDesdeEjec(d) {
    if (!d) return;
    __cnSalEje = d;
    __cnSaludoRefresh();
  }

  function __cnReplay() {
    var m = el("cn-messages"); if (!m) return;
    m.innerHTML = "";
    // Chat vacío: PORTADA, y el saludo NO se siembra en el historial.
    // [2026-08-24] Antes se sembraba y la portada solo lo tapaba: al enviar la primera
    // pregunta, __cnBubble repintaba el historial y el saludo REAPARECÍA como burbuja
    // arriba —el usuario ya lo había leído en la portada, así que sobraba—.
    // La portada ES el saludo ahora; duplicarlo en el historial no aporta nada.
    // historial.js:39 y :118 exigen hist.length >= 2 para guardar/restaurar una
    // conversación: con el historial vacío, la 1ª pregunta + su respuesta dan
    // exactamente 2, así que el guardado sigue funcionando igual.
    if (!__cnHistory.length) {
      m.innerHTML = __cnPortadaHtml();
      __cnEstadoInicio();
      return;
    }
    __cnHistory.forEach(function (b) { __cnAppendRaw(b.role, b.html, b.time, b.grupo); });
    __cnDisableOpts();                          // tras repintar, todo grupo de opciones queda deshabilitado…
    if (__cnOptsOpen) __cnEnableLastOpts();     // …salvo la desambiguación viva (la última), si la hay
    __cnEstadoInicio();
  }

  // [2026-08-24] Estado de INICIO (petición del usuario, referencia de una interfaz conversacional): mientras la
  // única burbuja sea el saludo, el saludo y la caja de entrada se agrupan en el CENTRO
  // vertical del panel en vez de quedar el saludo arriba y la caja pegada abajo con un
  // vacío enorme entre medias. Al llegar la primera pregunta se vuelve al layout normal
  // (mensajes arriba, caja abajo) y ya no se regresa a este estado en toda la conversación.
  // Es una clase en el CONTENEDOR del chat, no en #cn-messages: la caja de entrada es
  // HERMANA de #cn-messages, así que centrar ambas exige actuar sobre el padre común.
  function __cnEstadoInicio() {
    var m = el("cn-messages"); if (!m) return;
    var cont = m.parentNode; if (!cont || cont.nodeType !== 1) return;
    // Historial VACÍO = portada. [2026-08-24] Antes el umbral era <=1 porque el saludo se
    // sembraba como burbuja; ya no se siembra, así que la condición es length === 0.
    // Se mira el HISTORIAL y no el DOM: es la misma fuente que decide qué se pinta y
    // sobrevive al cambio de pestaña (__cnReplay lo repinta entero).
    if (!__cnHistory.length) cont.classList.add("cn-inicio");
    else cont.classList.remove("cn-inicio");
  }

  // [2026-08-25] Atajo de panorama: preguntas genéricas ("muéstrame bloque 2", "panorama
  // general") repintan el panorama global (tarjetas P50) por el MISMO camino que el botón
  // "Volver al panorama" (__cnVolverPanorama, :1290) — sin pasar por el clasificador. Es
  // a propósito: no hay entidad/filtro que resolver, así que Motor Q solo pagaría una
  // clasificación (y su latencia) para terminar llamando a lo mismo que ya hace el botón.
  var __cnDiacriticos = new RegExp("[̀-ͯ]", "g");
  function __cnEsPanoramaTxt(t) {
    var n = (t || "").toLowerCase().normalize("NFD").replace(__cnDiacriticos, "");
    return n.indexOf("bloque 2") !== -1 || n.indexOf("panorama general") !== -1;
  }

  // [2026-08-25] Atajo de "bloque 3": Focos de atención · rankeados por impacto. Es EL bloque
  // que `plan_panorama_global_solo_p50` cortó del panorama global a propósito, porque sale de
  // /api/analisis/ejecutivo y esa ruta puede invocar a Gemma (~180s, hasta ~342s en frío). El
  // atajo lo reactiva bajo demanda (nadie lo paga si no lo pide) llamando DIRECTO a la misma
  // `window.__cnAnalisisEjecutivo(null)` que usaba el panorama global antes del recorte —
  // NO pasa por `__cnAnalizar`, que hoy corta en el mismo punto para el caso automático.
  function __cnEsBloque3Txt(t) {
    var n = (t || "").toLowerCase().normalize("NFD").replace(__cnDiacriticos, "");
    return n.indexOf("bloque 3") !== -1 || n.indexOf("focos de atencion") !== -1;
  }

  window.__cnPreguntar = function () {
    // [2026-08-24] Corta en la entrada: cubre tanto el botón como el Enter de #cn-input, que
    // llama a esta función directo y esquivaría un disabled puesto solo en el botón.
    if (__cnEnVuelo) return;
    var inp = el("cn-input"); if (!inp) return;
    var texto = (inp.value || "").trim(); if (!texto) return;
    var _hd = el("cn-hist-drop"); if (_hd) _hd.hidden = true;   // cierra el desplegable al preguntar
    if (__cnEsPanoramaTxt(texto)) {
      __cnBubble("user", esc(texto));
      inp.value = "";
      __cnBubble("assistant", "Aquí tienes el panorama general — cumplimiento del compromiso " +
        "corporativo (P50) por producto.");
      window.__cnVolverPanorama();
      return;
    }
    if (__cnEsBloque3Txt(texto)) {
      __cnBubble("user", esc(texto));
      inp.value = "";
      __cnBubble("assistant", "Aquí tienes los focos de atención — rankeados por impacto. Puede " +
        "tardar (el análisis de IA se calienta si estaba frío).");
      window.__cnVolverPanorama();   // asegura el contenedor #cn-ejec-top, mismo patrón que bloque 2
      var topG = el("cn-ejec-top");
      if (topG) topG.classList.remove("cn-ejec-top--solo");   // vuelve el separador: ya no va "solo"
      window.__cnAnalisisEjecutivo(null);
      return;
    }
    __cnOptsOpen = false; __cnDisableOpts();    // nueva pregunta → invalida cualquier opción previa
    __cnBubble("user", esc(texto));
    inp.value = "";
    var load = __cnTyping();
    // [2026-07-30] Motor v2 (clasificador): mismo chat, otra puerta. El render es la función
    // PURA __cnRenderV2 (H1) insertada con el mecanismo propio de ESTE chat (__cnBubble).
    if (__cnMotor === "v2") {
      __cnEnVuelo = true;
      // [2026-08-26] Cronómetro del lado del cliente: es el ÚNICO punto que ve el tiempo de
      // extremo a extremo. El log de Flask (routes/api.py:748) solo se escribe si el corte lo dio
      // SU timeout de 90 s — si algo aguas arriba (nginx/gunicorn) corta antes, Flask sigue
      // esperando y ese log nunca aparece. Este número distingue los dos casos.
      var __t0 = Date.now();
      fetch("/api/consulta2/preguntar", {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({texto: texto, conversation_id: __cnCid, usuario: __cnNombre()})})
        // [2026-08-24] Se mira r.ok ANTES de tratar el cuerpo como una clasificación. El proxy
        // Flask responde los fallos con JSON ({"error": "INGESTA no disponible: …"}, 502), así que
        // r.json() resolvía BIEN y el .catch nunca entraba: ese objeto llegaba a __cnRenderV2, que
        // sin `grupo` cae al default "Desconocido" y sin `mensaje` pinta la burbuja VACÍA. El
        // usuario veía un "Desconocido" mudo —sin ✓/✗, porque tampoco hay log_id— cuando lo que
        // ocurrió fue una caída de INGESTA. Un error debe decir que es un error.
        .then(function (r) {
          return r.json().catch(function () { return {}; })
            .then(function (d) { return {ok: r.ok, status: r.status, d: d}; });
        })
        .then(function (res) { if (load) load.remove();
          var d = res.d || {};
          if (!res.ok || d.error || !d.grupo) {
            __cnBubble("assistant", __cnErrorV2(d.error || d.detail, res.status, false,
                                                (Date.now() - __t0) / 1000));
            // [2026-08-24] Cumplir lo que dice el mensaje: la pregunta vuelve al cuadro de texto.
            // Guarda: si el usuario ya escribió otra cosa durante la espera, no se la pisamos.
            if (!inp.value) inp.value = texto;
            return;
          }
          __v2UltimaClas = {ts: Date.now(), texto: texto};
          // __cnBubble guarda el HTML COMPLETO en el historial y devuelve el nodo;
          // __cnRevelar solo reescribe el <p.v2-msg> de ESE nodo. El historial queda
          // intacto a propósito (ver el comentario de __cnRevelar).
          __cnRevelar(__cnBubble("assistant", __cnRenderV2(d), d.grupo), d.mensaje);
          if (d.panel) __cnPintarPanelCuant(d.panel, texto); })   // 1d: panel derecho (SOLO Consulta)
        .catch(function (e) { if (load) load.remove();
          __cnBubble("assistant", __cnErrorV2(String(e && e.message || e), 0, false,
                                              (Date.now() - __t0) / 1000)); })
        .finally(function () { __cnEnVuelo = false; });   // libera en TODAS las salidas
      return;
    }
    // Señal P2 (Control 2): el usuario acaba de clasificar en v2 (<2 min) y ahora pregunta en v1
    // → fire-and-forget hacia el edificio v2 (v1 está congelada y no puede observarse a sí misma).
    if (__v2UltimaClas && (Date.now() - __v2UltimaClas.ts) < 120000) {
      try {
        fetch("/api/consulta2/senal", {method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({texto: texto, conversation_id: __cnCid, usuario: __cnNombre(), tipo: "cambio_v1"})})
          .catch(function () {});
      } catch (e) { /* señal débil: jamás bloquea la pregunta */ }
    }
    fetch("/api/consulta/preguntar", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({texto: texto, conversation_id: __cnCid, usuario: __cnNombre()})})
      .then(function (r) { return r.json(); })
      .then(function (d) { if (load) load.remove(); __cnRender(d); })
      .catch(function () { if (load) load.remove();
        __cnBubble("assistant", '<span class="text-danger">Error de conexión con el servicio de consulta.</span>'); });
  };
  window.__cnResponder = function (opcionId, label) {
    __cnOptsOpen = false; __cnDisableOpts();     // al elegir, deshabilita los botones (no repreguntar → "expiró")
    __cnBubble("user", esc(label || opcionId));
    var load = __cnTyping();
    fetch("/api/consulta/responder", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({conversation_id: __cnCid, opcion_id: opcionId, usuario: __cnNombre()})})
      .then(function (r) { return r.json(); })
      .then(function (d) { if (load) load.remove(); __cnRender(d); })
      .catch(function () { if (load) load.remove();
        __cnBubble("assistant", '<span class="text-danger">Error.</span>'); });
  };
  // =====================================================================
  // [2026-07-30] MOTOR Q v2 · Fase 1 — clasificador de grupo + pestaña «Test Clas»
  // Edificio v2: solo AGREGA piezas; no toca __cnRender ni el flujo v1.
  // =====================================================================
  var __V2_GRUPO = {
    jerarquizar: { label: "Jerarquizar", color: "#3B6FD4", soft: "#E8EEFA", icon: "diagram-3" },
    cuantificar: { label: "Cuantificar", color: "#1E9E5A", soft: "#E9F3EC", icon: "calculator" },
    analizar:    { label: "Analizar",    color: "#E8912B", soft: "#FBF1E4", icon: "lightbulb" },
    desconocido: { label: "Desconocido", color: "#6B7A74", soft: "#EEF1EF", icon: "question-circle" }
  };
  var __cnMotor = (function () {
    // Default = v2 (2026-08-04). Solo v1 explícito en localStorage conserva v1.
    try { return localStorage.getItem("cn_motor") === "v1" ? "v1" : "v2"; } catch (e) { return "v2"; }
  })();
  // [2026-08-24] Flag de módulo, NO btn.disabled: la pestaña se remonta y recrea #cn-send-btn,
  // y el Enter de #cn-input llama a __cnPreguntar directo (esquivaría un disabled del botón).
  // Ollama serializa las inferencias del mismo modelo: un reenvío impaciente solo empeora la cola.
  var __cnEnVuelo = false;
  var __v2UltimaClas = null;   // {ts, texto} — para la señal P2 (cambio a v1)

  window.__cnSetMotor = function (m) {
    __cnMotor = (m === "v2") ? "v2" : "v1";
    try { localStorage.setItem("cn_motor", __cnMotor); } catch (e) {}
    var b1 = el("cn-motor-v1"), b2 = el("cn-motor-v2");
    if (b1) b1.classList.toggle("is-active", __cnMotor === "v1");
    if (b2) b2.classList.toggle("is-active", __cnMotor === "v2");
  };

  // [2026-08-12] Marcador propio y ACOTADO (⟦…⟧ -> <strong>), NUNCA markdown genérico (**):
  // __cnRenderV2 pinta los 4 grupos en 2 chats (Consulta y Test Clas) y el intro lo escribe un LLM
  // a temperature 0.8 cuyo validador bloquea dígitos/unidades pero NO asteriscos — en OUT el texto
  // del modelo llega sin filtro de contenido alguno. Interpretar "**" habría renderizado en negrita
  // un "**Claro, Javier**" espontáneo en los 4 grupos. Se aplica DESPUÉS de esc() (nunca se inyecta
  // HTML desde el backend, solo se reconoce el marcador ya escapado) y con regex NO codiciosa de una
  // sola línea, para que un marcador sin cerrar no se coma el resto del mensaje.
  function __cnMarcador(t) {
    return String(t || "").replace(/⟦([^⟦⟧\n]*)⟧/g, "<strong>$1</strong>");
  }

  // [2026-08-24] Revelado progresivo del cuerpo del mensaje (efecto "escribiendo").
  //
  // Es COSMÉTICO, no streaming: la respuesta ya llegó entera. No hay nada que
  // transmitir — el texto lo componen plantillas Python (respuesta_*.py) y las 4
  // llamadas a Ollama del chat usan stream:false + format:json. Esto solo evita el
  // "flash" del bloque completo; NO acorta la espera (la alarga un poco).
  //
  // Se anima por LÍNEAS sobre el texto PLANO (d.mensaje), nunca sobre el innerHTML
  // ya compuesto. Dos razones, ambas verificadas:
  //   1. La burbuja lleva <span>/<strong>/botones: revelar innerHTML carácter a
  //      carácter mostraría etiquetas a medio cerrar ("<stro").
  //   2. El marcador ⟦…⟧ -> <strong> es de UNA línea (ver __cnMarcador): cortar a
  //      mitad dejaría el símbolo crudo ⟦ colgando a la vista. Por línea completa,
  //      el prefijo siempre está cerrado.
  // El backend manda \n reales y .v2-msg los respeta con white-space:pre-line
  // (colapsable.css), así que basta unir el prefijo con "\n" — sin <br>.
  //
  // El historial NO se toca: __cnBubble ya guardó el HTML completo antes de animar,
  // de modo que al cambiar de pestaña (__cnReplay) el texto sale entero y el regex
  // de __v2MarcarVotado sigue encontrando su .v2-verdict.
  // [2026-08-24] Se anima por PALABRAS, no por líneas. Por líneas resultaba
  // imperceptible: una respuesta típica de 4-8 líneas son 4-8 fotogramas, que se
  // leen como un parpadeo, no como escritura. Cortar por palabra da decenas de
  // pasos y sigue siendo seguro (el corte ocurre en el texto PLANO, antes de
  // componer el HTML), con una salvedad: un ⟦ abierto quedaría crudo a la vista
  // mientras se revela su contenido, así que __cnCerrar cierra el marcador
  // pendiente en cada fotograma.
  var __CN_TYPE_MIN = 900;    // piso: por debajo de esto no se percibe como escritura
  var __CN_TYPE_TOPE = 2600;  // techo: respuestas largas no pueden eternizarse
  var __CN_TYPE_PASO = 28;    // ritmo objetivo por palabra

  // Cierra un ⟦ sin pareja para que el marcador nunca se vea crudo a media palabra.
  // Basta añadir UNO: solo el último marcador puede quedar abierto, los anteriores
  // ya se revelaron enteros.
  function __cnCerrar(t) {
    var a = (t.match(/⟦/g) || []).length, b = (t.match(/⟧/g) || []).length;
    return a > b ? t + "⟧" : t;
  }

  // Handle del revelado en curso. Si el usuario pregunta otra vez sin esperar a que
  // termine el anterior, ambos intervalos correrían en paralelo peleándose el
  // scrollTop del chat (la burbuja vieja sigue conectada, así que su guarda
  // isConnected no la detiene). El nuevo cierra al anterior: se completa de golpe
  // —nunca se queda a medias— y cede el scroll.
  var __cnRevelarT = null;
  var __cnRevelarFin = null;
  // Duración del último revelado, en ms. La lee __cnPintarPanelCuant para que la entrada
  // del bloque de Insights dure LO MISMO que la escritura del chat y ambos terminen a la
  // vez (petición: "renderizar al tiempo"). 0 = el chat no se animó (respuesta corta,
  // prefers-reduced-motion, o pintado sin typing) → el panel tampoco se anima.
  var __cnRevelarDur = 0;

  function __cnRevelar(nodo, mensaje) {
    // Cierra el revelado anterior dejando su texto COMPLETO antes de empezar este.
    if (__cnRevelarT) { clearInterval(__cnRevelarT); __cnRevelarT = null; }
    if (__cnRevelarFin) { try { __cnRevelarFin(); } catch (e) {} __cnRevelarFin = null; }

    __cnRevelarDur = 0;   // se recalcula abajo; los early-return lo dejan en 0 (sin animación)
    if (!nodo) return;
    var p = nodo.querySelector(".v2-msg"); if (!p) return;
    var txt = String(mensaje || "");

    // Se conservan los separadores (\s+) para reconstruir el texto tal cual: los \n
    // importan, .v2-msg los pinta con white-space:pre-line.
    var piezas = txt.split(/(\s+)/).filter(function (s) { return s !== ""; });
    if (piezas.length < 4) return;   // demasiado corto para que la animación aporte algo

    // Respeta a quien pidió no ver animaciones — misma política que el CSS del proyecto.
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    } catch (e) { /* matchMedia ausente: se anima igual */ }

    // El paso se ajusta para caer dentro de [MIN, TOPE]: sin el piso, una respuesta
    // corta se revelaba en ~0.2s y parecía instantánea (el defecto de la 1ª versión).
    var paso = __CN_TYPE_PASO;
    var dur = piezas.length * paso;
    if (dur < __CN_TYPE_MIN) paso = Math.ceil(__CN_TYPE_MIN / piezas.length);
    if (dur > __CN_TYPE_TOPE) paso = Math.max(12, Math.floor(__CN_TYPE_TOPE / piezas.length));
    // Duración REAL tras ajustar el paso (no la estimada): es la que debe copiar el panel.
    __cnRevelarDur = piezas.length * paso;

    var m = el("cn-messages");
    var i = 0;
    p.innerHTML = "";
    // [2026-08-25 · H-10] El hilo es aria-live="polite" y aquí se reescribe innerHTML cada 12-28ms:
    // sin aria-busy, un lector de pantalla anunciaría la respuesta entera decenas de veces,
    // palabra a palabra. Se pone DESPUÉS de los early-return (una respuesta que no se anima nunca
    // llega a marcarse) y se retira por las DOS salidas del intervalo: completar() —fin normal o
    // interrupción por un revelado nuevo— y la rama de nodo desconectado, que no pasa por él.
    p.setAttribute("aria-busy", "true");
    // Deja el texto completo y suelta el handle. Se usa al terminar y también si un
    // revelado nuevo interrumpe a éste: la burbuja vieja NUNCA se queda truncada.
    var completar = function () {
      p.removeAttribute("aria-busy");
      p.innerHTML = __cnMarcador(esc(txt));
      if (__cnRevelarFin === completar) __cnRevelarFin = null;
    };
    __cnRevelarFin = completar;
    var t = setInterval(function () {
      // El usuario pudo cambiar de pestaña o preguntar otra cosa: si el nodo salió
      // del documento, el intervalo moriría escribiendo en un huérfano.
      if (!p.isConnected) { clearInterval(t); if (__cnRevelarT === t) __cnRevelarT = null;
        // Esta rama NO pasa por completar() —el nodo ya no está en el documento y no hay texto
        // que dejar completo—, así que el aria-busy hay que retirarlo aquí o se quedaría fijo
        // en el párrafo huérfano: si esa burbuja vuelve al DOM (__cnReplay repinta el historial)
        // reaparecería marcada como "ocupada" para un lector de pantalla, y ya nada la limpia.
        p.removeAttribute("aria-busy");
        if (__cnRevelarFin === completar) __cnRevelarFin = null; return; }
      i++;
      p.innerHTML = __cnMarcador(__cnCerrar(esc(piezas.slice(0, i).join(""))));
      // El scroll del chat es de una sola pasada (en __cnAppendRaw), así que hay que
      // reseguirlo mientras la burbuja crece o se saldría por abajo.
      if (m) m.scrollTop = m.scrollHeight;
      if (i >= piezas.length) { clearInterval(t); completar();
        if (__cnRevelarT === t) __cnRevelarT = null; }
    }, paso);
    __cnRevelarT = t;
  }

  // H1: función PURA — devuelve el HTML de la burbuja v2. NO appendea (cada chat inserta
  // con su mecanismo: __cnBubble en Consulta, __tcBubble en Test Clas).
  // ⚠ La franja de veredicto (.v2-verdict) NO puede contener <div> anidados: __v2MarcarVotado
  // la reemplaza en los historiales con un regex no-greedy hasta el primer </div>.
  // `mostrarVia` = traza de QUÉ capa resolvió (regex/LLM). Es información de diagnóstico: solo la
  // pide «Test Clas» (laboratorio del clasificador). En Consulta se OMITE — al usuario final no le
  // dice nada sobre la respuesta y ensucia la cabecera.
  // [2026-08-24] Burbuja de FALLO — distinta de una clasificación. Dice que el problema es del
  // sistema, no de la pregunta, y muestra el motivo real del backend (el 502 del proxy trae
  // "INGESTA no disponible: …"). Sin ✓/✗: no hay nada que calificar, no se registró en la libreta.
  // [2026-08-26] `segs` = segundos REALES medidos en el cliente. Antes el texto afirmaba SIEMPRE
  // "tardó más de lo previsto", incluso cuando el fallo era instantáneo (un 502 del proxy, o un
  // 200 sin `grupo` — los tres casos entran por la misma puerta, :6106). Eso mandó un diagnóstico
  // entero por el camino equivocado: se buscó un timeout de 90 s donde el corte podía ser otra
  // cosa. El mensaje ahora dice lo que de verdad pasó, y deja la traza a la vista.
  function __cnErrorV2(motivo, status, mostrarDetalle, segs) {
    // [2026-08-24] El detalle técnico crudo (excepción de requests/urllib3) no se muestra al
    // usuario final: queda en consola y, para diagnóstico, en el laboratorio Test Clas
    // (mostrarDetalle=true) — ver __tcPreguntar.
    var det = motivo ? esc(String(motivo)) : (status ? "El servidor respondió " + status + "." : "");
    if (motivo) try { console.error("[Motor v2]", motivo); } catch (e) {}
    // Umbral en 20 s: por debajo NINGUNA de las rutas lentas conocidas ha terminado todavía
    // (los 3 caminos de LLM tienen techo de 30 s), así que un fallo ahí no es de tiempo.
    var lento = (segs == null) || (segs >= 20);
    var causa = lento ? "el Motor v2 tardó más de lo previsto"
                      : "el Motor v2 devolvió un fallo";
    // Traza SIEMPRE visible, en Consulta también. NO es jerga técnica: son dos números, y sin
    // ellos no hay forma de distinguir "esperó un minuto" de "falló al instante" sin entrar al
    // servidor a leer el log — que es justo lo que costó tiempo en el diagnóstico de hoy.
    var tz = [];
    if (segs != null) tz.push("cortó a los " + segs.toFixed(0) + " s");
    if (status) tz.push("HTTP " + status);
    return '<span class="v2-badge v2-badge--err"><i class="bi bi-exclamation-triangle"></i> Sin respuesta</span>' +
      '<p class="v2-msg">No pude procesar tu pregunta: ' + causa + '. ' +
      'Tu pregunta sigue en el cuadro de texto — vuelve a enviarla en un momento.</p>' +
      (tz.length ? '<p class="v2-msg v2-msg--det">' + esc(tz.join(" · ")) + '</p>' : '') +
      (det && mostrarDetalle ? '<p class="v2-msg v2-msg--det">' + det + '</p>' : '');
  }

  function __cnRenderV2(d, lab) {
    d = d || {};
    // Guarda dura: si el backend respondiera sin grupo o sin mensaje, se pinta el fallo — NUNCA
    // una burbuja muda. El backend siempre manda TEXTO_FALLBACK en OUT (respuesta_out.py), así que
    // llegar aquí vacío significa que la respuesta no vino del clasificador.
    if (!d.grupo || !d.mensaje) return __cnErrorV2(d.error || d.detail, 0, lab);
    var g = __V2_GRUPO[d.grupo] || __V2_GRUPO.desconocido;
    var __V2VIA = { regex: "regex", "regex+filtro": "regex + filtro", llm: "LLM",
                    "regex+llm": "regex + LLM", "regex+llm_fallo": "regex (LLM no respondió)" };
    var via = __V2VIA[d.capa_resolutora] || "LLM";
    var h = "";
    if (lab) {   // Test Clas — laboratorio: la traza SÍ se muestra (render histórico, intacto)
      h = '<span class="v2-badge"><i class="bi bi-cpu"></i> Motor v2</span> ' +
        '<span class="v2-grupo" style="--v2c:' + g.color + ';--v2s:' + g.soft + ';">' +
        '<i class="bi bi-' + g.icon + '"></i> ' + g.label + '</span> ' +
        '<span class="v2-capa">vía ' + via + '</span>';
    }
    // Consulta: motor, grupo y capa son DIAGNÓSTICO y salen de la vista (chat_n.md §8). El grupo
    // sobrevive como filete de color en la burbuja + title (D-2, ver __cnAppendRaw).
    if (d.entidad_cruda) {
      h += '<span class="v2-ent"><i class="bi bi-geo-alt"></i> ' + esc(d.entidad_cruda) + '</span>';
    }
    h += '<p class="v2-msg">' + __cnMarcador(esc(d.mensaje || "")) + '</p>';
    if (d.log_id) {
      // Control 1 — microcopy declarativo, SIN pregunta: solo ✓/✗ discretos junto al badge.
      h += '<div class="v2-verdict" id="v2v-' + d.log_id + '">' +
        '<span class="v2-vask">¿Mi respuesta es acertada?</span>' +
        '<button type="button" class="v2-vbtn v2-vbtn--ok" title="Clasificación correcta" ' +
        'onclick="window.__v2Votar(' + d.log_id + ',null)"><i class="bi bi-check-lg"></i></button>' +
        '<button type="button" class="v2-vbtn v2-vbtn--no" title="No era eso" ' +
        'onclick="window.__v2No(' + d.log_id + ',\'' + esc(d.grupo) + '\')"><i class="bi bi-x-lg"></i></button>' +
        '</div>';
    }
    return h;
  }

  // Reemplaza la franja de veredicto (DOM + AMBOS historiales) — patrón __cnSaludoRefresh:
  // si no se reescribe el html guardado, la franja votada reviviría al cambiar de pestaña.
  function __v2MarcarVotado(logId, textoHtml) {
    var nuevo = '<div class="v2-verdict" id="v2v-' + logId + '">' +
      '<span class="v2-vdone">' + textoHtml + '</span></div>';
    var caja = el("v2v-" + logId);
    if (caja) caja.outerHTML = nuevo;
    var rx = new RegExp('<div class="v2-verdict" id="v2v-' + logId + '">[\\s\\S]*?<\\/div>');
    [__cnHistory, __tcHistory].forEach(function (hist) {
      hist.forEach(function (item) {
        if (item.html && item.html.indexOf('v2v-' + logId) !== -1) item.html = item.html.replace(rx, nuevo);
      });
    });
    // La tabla de Test Clas puede estar visible con la fila aún 'pendiente' → refrescar
    if (el("tc-tabla")) __tcCargarTabla(__tcFiltroActual);
  }

  window.__v2Votar = function (logId, grupoCorrecto) {
    var body = grupoCorrecto
      ? {log_id: logId, veredicto: "corregido_usuario", grupo_correcto: grupoCorrecto, fuente: "usuario"}
      : {log_id: logId, veredicto: "confirmado_usuario", fuente: "usuario"};
    fetch("/api/consulta2/veredicto", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)})
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) return;
        var g = grupoCorrecto ? (__V2_GRUPO[grupoCorrecto] || __V2_GRUPO.desconocido) : null;
        __v2MarcarVotado(logId, grupoCorrecto
          ? ('<i class="bi bi-arrow-right"></i> ' + g.label + ' <span class="v2-vsrc">(usuario)</span>')
          : ('<i class="bi bi-check-lg"></i> Confirmada <span class="v2-vsrc">(usuario)</span>'));
      })
      .catch(function () {});
  };

  window.__v2No = function (logId, grupoAsignado) {
    // ✗ → chips con los OTROS grupos + "Ninguno" (desconocido). Solo spans/buttons (ver __cnRenderV2).
    var caja = el("v2v-" + logId); if (!caja) return;
    var chips = "";
    ["jerarquizar", "cuantificar", "analizar"].forEach(function (k) {
      if (k === grupoAsignado) return;
      var g = __V2_GRUPO[k];
      chips += '<button type="button" class="v2-chip" style="--v2c:' + g.color + ';--v2s:' + g.soft + ';" ' +
        'onclick="window.__v2Votar(' + logId + ',\'' + k + '\')">' + g.label + '</button>';
    });
    if (grupoAsignado !== "desconocido") {
      chips += '<button type="button" class="v2-chip" style="--v2c:#6B7A74;--v2s:#EEF1EF;" ' +
        'onclick="window.__v2Votar(' + logId + ',\'desconocido\')">Ninguno</button>';
    }
    caja.innerHTML = '<span class="v2-vlbl">Era:</span>' + chips;
  };

  // ---------- Pestaña «Test Clas»: chat de prueba (__tc*) ----------
  var __tcCid = "tc-" + Math.floor(Math.random() * 1e9);
  var __tcHistory = [];
  var __tcFiltroActual = "todas";
  // Calificación rápida: cola de pendientes cargados (en orden), cursor de teclado y las filas
  // crudas de la última carga (para saber el grupo asignado de cada una). __tcPendGlobal = el
  // contador «sin veredicto» del KPI, que decremento localmente al calificar.
  var __tcFilas = [];
  var __tcPendIds = [];
  var __tcCursor = -1;
  var __tcPendGlobal = 0;

  function renderTestClasBody() {
    return '' +
      '<div class="tc-head"><i class="bi bi-cpu"></i> Motor v2 · laboratorio del clasificador</div>' +
      '<div class="rb-chat" id="tc-messages" style="flex:1;min-height:0;"></div>' +
      '<div class="chat-input-container" style="min-height:auto;padding:10px;border-radius:0;">' +
      '  <div class="input-group">' +
      '    <input type="text" class="form-control" id="tc-input" autocomplete="off" ' +
      '      placeholder="Escribe una pregunta para clasificar…" ' +
      '      onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();window.__tcPreguntar();}">' +
      '    <button class="btn btn-primary" type="button" id="tc-send-btn" onclick="window.__tcPreguntar()" ' +
      '      title="Clasificar"><i class="fas fa-paper-plane"></i></button>' +
      '  </div>' +
      '  <details class="tc-lote">' +
      '    <summary><i class="bi bi-list-ol"></i> Cargar un lote de preguntas</summary>' +
      '    <textarea id="tc-lote-txt" class="form-control tc-lote__txt" rows="5" ' +
      '      oninput="window.__tcLoteCount()" ' +
      '      placeholder="Una pregunta por línea…&#10;cuánto crudo en Rubiales&#10;por qué cayó Caño Limón&#10;qué es HBOMAX"></textarea>' +
      '    <div class="tc-lote__bar">' +
      '      <span class="tc-lote__hint" id="tc-lote-hint">0 preguntas</span>' +
      '      <button class="btn btn-primary btn-sm" type="button" id="tc-lote-btn" ' +
      '        onclick="window.__tcPreguntarLote()">Clasificar lote</button>' +
      '    </div>' +
      '  </details>' +
      '</div>';
  }

  function __tcAppendRaw(role, html) {
    var m = el("tc-messages"); if (!m) return null;
    var b = document.createElement("div");
    b.className = (role === "user") ? "rb-chat__user" : "rb-chat__bot";
    b.innerHTML = html;
    m.appendChild(b);
    m.scrollTop = m.scrollHeight;
    return b;
  }
  function __tcBubble(role, html) { __tcHistory.push({role: role, html: html}); return __tcAppendRaw(role, html); }
  function __tcReplay() {
    var m = el("tc-messages"); if (!m) return;
    if (!__tcHistory.length) {
      __tcHistory.push({role: "assistant", html:
        '<span class="v2-badge"><i class="bi bi-cpu"></i> Motor v2</span>' +
        '<p class="v2-msg">Escribe una pregunta y te digo cómo la clasifico: ' +
        '<b>Jerarquizar</b> (estructura), <b>Cuantificar</b> (cifras) o <b>Analizar</b> (causas). ' +
        'Cada clasificación queda en la libreta de la derecha, lista para calificar.</p>'});
    }
    m.innerHTML = "";
    __tcHistory.forEach(function (b) { __tcAppendRaw(b.role, b.html); });
  }

  window.__tcPreguntar = function () {
    var inp = el("tc-input"); if (!inp) return;
    var texto = (inp.value || "").trim(); if (!texto) return;
    __tcBubble("user", esc(texto));
    inp.value = "";
    var load = __tcAppendRaw("assistant", '<div class="simple-loading">' +
      '<div class="spinner-border spinner-border-sm"></div> Clasificando…</div>');
    fetch("/api/consulta2/preguntar", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({texto: texto, conversation_id: __tcCid, usuario: __cnNombre()})})
      // Mismo criterio que Consulta (2026-08-24): un 502 del proxy es JSON válido, así que sin
      // mirar r.ok se colaba como clasificación vacía. Aquí además NO se recarga la tabla ante un
      // fallo: no hay fila nueva que mostrar y el recargar tapaba el error con un repintado.
      .then(function (r) {
        return r.json().catch(function () { return {}; })
          .then(function (d) { return {ok: r.ok, status: r.status, d: d}; });
      })
      .then(function (res) {
        if (load) load.remove();
        var d = res.d || {};
        if (!res.ok || d.error || !d.grupo) {
          __tcBubble("assistant", __cnErrorV2(d.error || d.detail, res.status, true));
          // [2026-08-24] Igual que en Consulta: no perder la pregunta del laboratorio.
          if (!inp.value) inp.value = texto;
          return;
        }
        __v2UltimaClas = {ts: Date.now(), texto: texto};
        __tcBubble("assistant", __cnRenderV2(d, true));   // laboratorio: la traza SÍ se muestra
        __tcCargarTabla(__tcFiltroActual);   // la fila nueva aparece arriba
      })
      .catch(function (e) { if (load) load.remove();
        __tcBubble("assistant", __cnErrorV2(String(e && e.message || e), 0, true)); });
  };

  // ---------- Carga por lote (20-50 preguntas de una) ----------
  function __tcLoteLineas() {
    var t = el("tc-lote-txt"); if (!t) return [];
    var seen = {}, out = [];
    (t.value || "").split("\n").forEach(function (l) {
      l = l.trim(); var k = l.toLowerCase();
      if (l && !seen[k]) { seen[k] = 1; out.push(l); }   // dedup preservando orden
    });
    return out;
  }
  window.__tcLoteCount = function () {
    var h = el("tc-lote-hint"); if (!h) return;
    var n = __tcLoteLineas().length;
    h.textContent = n + (n === 1 ? " pregunta" : " preguntas");
  };
  // Mapea la respuesta de /preguntar (clasificación) a la forma de fila de la libreta,
  // para poder pintarla en vivo sin esperar a que /log la devuelva.
  function __tcFilaDesdeClas(d) {
    return {id: d.log_id, ts: d.timestamp, texto_pregunta: d.texto_original,
            grupo_asignado: d.grupo, capa_resolutora: d.capa_resolutora,
            entidad_cruda: d.entidad_cruda, llm_diag: d.llm_diag,
            veredicto: "pendiente", grupo_correcto: null};
  }

  // Clasifica el lote UNA POR UNA (llamando /preguntar en serie): cada respuesta pinta su fila al
  // instante y avanza la barra de progreso. Más robusto que un lote atómico — si una tropieza con
  // Gemma fría, solo falla esa. Al terminar, un __tcCargarTabla deja la libreta en su orden canónico.
  window.__tcPreguntarLote = function () {
    var textos = __tcLoteLineas();
    if (!textos.length) return;
    var total = textos.length, hechas = 0, errores = 0;
    var btn = el("tc-lote-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Clasificando…"; }
    var t = el("tc-lote-txt"); if (t) { t.value = ""; window.__tcLoteCount(); }
    var det = document.querySelector(".tc-lote"); if (det) det.open = false;

    var prog = __tcAppendRaw("assistant", "");
    function pintarProg(idx) {
      if (!prog) return;
      var vistas = hechas + errores;
      var pct = Math.round(100 * vistas / total);
      prog.innerHTML =
        '<span class="v2-badge"><i class="bi bi-list-ol"></i> Lote</span>' +
        '<p class="v2-msg">Clasificando <b>' + Math.min(idx, total) + '</b> de <b>' + total + '</b>…' +
        (errores ? ' <span class="text-danger">(' + errores + ' con error)</span>' : '') + '</p>' +
        '<div class="tc-prog"><div class="tc-prog__fill" style="width:' + pct + '%"></div></div>';
      var m = el("tc-messages"); if (m) m.scrollTop = m.scrollHeight;
    }
    pintarProg(1);
    __tcAsegurarTabla();

    function siguiente(i) {
      if (i >= total) return finalizar();
      pintarProg(i + 1);
      fetch("/api/consulta2/preguntar", {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({texto: textos[i], conversation_id: __tcCid, usuario: __cnNombre()})})
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.grupo) { __tcPrependFila(__tcFilaDesdeClas(d)); hechas++; }
          else errores++;
        })
        .catch(function () { errores++; })
        .then(function () { siguiente(i + 1); });
    }
    function finalizar() {
      if (prog) prog.remove();
      __tcBubble("assistant",
        '<span class="v2-badge"><i class="bi bi-list-ol"></i> Lote</span>' +
        '<p class="v2-msg">Listo: <b>' + hechas + '</b> clasificadas' +
        (errores ? ', <b>' + errores + '</b> con error' : '') + '. ' +
        'Pulsa <b>Confirmar todos</b> o corrige con <b>1/2/3/4</b>.</p>');
      if (btn) { btn.disabled = false; btn.textContent = "Clasificar lote"; }
      __tcCargarTabla(__tcFiltroActual);   // orden canónico + KPIs + cursor del teclado
    }
    siguiente(0);
  };

  // Garantiza que exista un <tbody> donde ir prependiendo las filas nuevas del lote.
  function __tcAsegurarTabla() {
    var cont = el("tc-tabla"); if (!cont) return;
    if (cont.querySelector("table.tc-tbl tbody")) return;
    cont.innerHTML =
      '<div class="tc-scroll"><table class="tc-tbl">' +
      '<thead><tr><th>Pregunta</th><th>Decisión del motor</th><th>Veredicto</th><th>Fecha</th></tr></thead>' +
      '<tbody></tbody></table></div>';
  }
  // Inserta una fila recién clasificada al tope (feedback visual; el estado canónico lo fija el
  // __tcCargarTabla final). Mantiene también la cola de pendientes por si califica en pleno lote.
  function __tcPrependFila(f) {
    __tcAsegurarTabla();
    var tb = document.querySelector("#tc-tabla table.tc-tbl tbody");
    if (!tb) return;
    var tr = document.createElement("tr");
    tr.id = "tcrow-" + f.id;
    tr.className = "tc-row--pend tc-row--nuevo";
    tr.innerHTML = __tcRowInner(f);
    tb.insertBefore(tr, tb.firstChild);
    __tcFilas.unshift(f);
    if (f.id != null) { __tcPendIds.unshift(f.id); __tcPendGlobal++; }
    __tcActualizarContadores();
  }

  // ---------- Pestaña «Test Clas»: libreta tabulada ----------
  var __TC_FILTROS = [["todas", "Todas"], ["pendientes", "Pendientes"],
                      ["sospecha", "Sospecha"], ["corregidas", "Corregidas"]];

  function __tcFiltrosHtml(activo) {
    return __TC_FILTROS.map(function (f) {
      return '<button type="button" class="tc-chip' + (f[0] === activo ? " is-active" : "") + '" ' +
        'onclick="window.__tcFiltro(\'' + f[0] + '\')">' + f[1] + '</button>';
    }).join("");
  }

  window.__tcFiltro = function (f) {
    __tcFiltroActual = f;
    var cont = el("tc-filtros");
    if (cont) cont.innerHTML = __tcFiltrosHtml(f);
    __tcCargarTabla(f);
  };

  // Badge de un veredicto YA resuelto (mismo look que el server). Devuelve null si sigue pendiente.
  // Lo comparten la carga de la tabla y la actualización en vivo al calificar (no recargar toda la tabla).
  function __tcVeredictoBadge(v, grupoCorrecto) {
    if (v === "confirmado_usuario") return '<span class="tc-ok"><i class="bi bi-check-lg"></i> usuario</span>';
    if (v === "confirmado_revision") return '<span class="tc-ok"><i class="bi bi-check-lg"></i> revisión</span>';
    if (v === "corregido_usuario" || v === "corregido_revision") {
      var g = __V2_GRUPO[grupoCorrecto] || __V2_GRUPO.desconocido;
      var src = (v === "corregido_usuario") ? "usuario" : "revisión";
      return '<span class="tc-no"><i class="bi bi-x-lg"></i>→ ' + g.label +
        ' <span class="v2-vsrc">(' + src + ')</span></span>';
    }
    return null;
  }

  function __tcVeredictoCell(f) {
    var badge = __tcVeredictoBadge(f.veredicto, f.grupo_correcto);
    if (badge) return badge;
    var v = f.veredicto;
    // pendiente / sospecha → franja de calificación inline (fuente = revision).
    // "sospecha" NO es un veredicto: se pinta como pendiente con bandera de prioridad.
    var lbl = (v === "sospecha")
      ? '<span class="tc-pend tc-pend--sosp"><i class="bi bi-flag-fill"></i> pendiente (sospecha)</span>'
      : '<span class="tc-pend">pendiente</span>';
    var chips = '<button type="button" class="tc-rate tc-rate--ok" title="Clasificación correcta" ' +
      'onclick="window.__tcCalificar(' + f.id + ',null,\'' + esc(f.grupo_asignado) + '\')">' +
      '<i class="bi bi-check-lg"></i> Correcta</button>';
    ["jerarquizar", "cuantificar", "analizar"].forEach(function (k) {
      if (k === f.grupo_asignado) return;
      chips += '<button type="button" class="tc-rate" onclick="window.__tcCalificar(' +
        f.id + ',\'' + k + '\',\'' + esc(f.grupo_asignado) + '\')">' + __V2_GRUPO[k].label + '</button>';
    });
    if (f.grupo_asignado !== "desconocido") {
      chips += '<button type="button" class="tc-rate" onclick="window.__tcCalificar(' +
        f.id + ',\'desconocido\',\'' + esc(f.grupo_asignado) + '\')">Ninguno</button>';
    }
    return lbl + '<span class="tc-ratewrap" id="tcv-' + f.id + '">' + chips + '</span>';
  }

  // Calificación OPTIMISTA en el sitio: pinta el veredicto YA (no espera la red ni recarga la
  // tabla entera → el teclado y el mouse se sienten instantáneos), saca la fila de la cola de
  // pendientes y dispara el POST en segundo plano. La calificación es idempotente.
  function __tcCalificarLocal(logId, grupo, asignado) {
    // Franja estilo barra de feedback: Correcta → confirmado_revision; grupo → corregido_revision
    // (si coincide con el asignado, confirma). Fuente SIEMPRE 'revision' (es la tabla del revisor).
    var confirmar = (grupo === null || grupo === asignado);
    var veredicto = confirmar ? "confirmado_revision" : "corregido_revision";
    var body = confirmar
      ? {log_id: logId, veredicto: veredicto, fuente: "revision"}
      : {log_id: logId, veredicto: veredicto, grupo_correcto: grupo, fuente: "revision"};
    var row = el("tcrow-" + logId);
    if (row) {
      var cell = row.querySelector(".tc-vcell");
      if (cell) cell.innerHTML = __tcVeredictoBadge(veredicto, confirmar ? null : grupo);
      row.classList.remove("tc-row--pend", "tc-row--cursor");
    }
    var i = __tcPendIds.indexOf(logId);
    if (i >= 0) {
      __tcPendIds.splice(i, 1);
      if (i < __tcCursor) __tcCursor--;                       // se removió una fila por encima del cursor
      if (__tcCursor >= __tcPendIds.length) __tcCursor = __tcPendIds.length - 1;
      if (__tcPendGlobal > 0) __tcPendGlobal--;
    }
    __tcActualizarContadores();
    __tcPintarCursor();
    fetch("/api/consulta2/veredicto", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)}).catch(function () {});
  }
  window.__tcCalificar = function (logId, grupo, asignado) { __tcCalificarLocal(logId, grupo, asignado); };

  // «Confirmar todos los pendientes»: un POST por lote marca correctas las cargadas sin veredicto.
  window.__tcConfirmarPendientes = function () {
    if (!__tcPendIds.length) return;
    var items = __tcPendIds.map(function (id) { return {log_id: id, veredicto: "confirmado_revision"}; });
    var btn = document.querySelector(".tc-confirmall");
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Confirmando…'; }
    fetch("/api/consulta2/veredicto_lote", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({items: items, fuente: "revision"})})
      .then(function (r) { return r.json(); })
      .then(function () { __tcCargarTabla(__tcFiltroActual); })
      .catch(function () { if (btn) { btn.disabled = false; btn.textContent = "Reintentar"; } });
  };

  // «Correr golden»: el gate del clasificador (>=90%) desde la UI. El backend reusa
  // run_golden.ejecutar(), el mismo cálculo del CLI. NO escribe en la libreta (log=False),
  // así que se puede correr cuantas veces haga falta sin ensuciar la cola de revisión.
  window.__tcGolden = function () {
    var btn = document.querySelector(".tc-golden__btn");
    var out = el("tc-golden-out");
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Corriendo…'; }
    // Puede tardar: recorre todos los casos y alguno escala a Capa 2 con Ollama frío.
    if (out) { out.className = "tc-golden__out"; out.textContent = "Clasificando los casos del golden…"; }
    fetch("/api/consulta2/golden")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-shield-check"></i> Correr golden'; }
        if (!out) return;
        if (d.error) { out.className = "tc-golden__out is-fail"; out.textContent = "Error: " + d.error; return; }
        out.className = "tc-golden__out " + (d.pasa ? "is-ok" : "is-fail");
        var txt = (d.pasa ? "✓ " : "✗ ") + d.aciertos + "/" + d.total + " = " + d.pct + "%" +
                  " (gate ≥" + d.gate + "%) · Capa 1 regex: " + d.pct_regex + "%";
        if (d.fallos && d.fallos.length) {
          // Los fallos son el dato accionable: sin ellos el % no dice qué patrón revisar.
          txt += "\nFallos (" + d.fallos.length + "):";
          d.fallos.forEach(function (f) {
            txt += "\n  · " + f.pregunta + "  [esperado " + f.esperado + " → dio " + f.obtenido + ", " + f.capa + "]";
          });
        }
        out.textContent = txt;
      })
      .catch(function (e) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-shield-check"></i> Correr golden'; }
        if (out) { out.className = "tc-golden__out is-fail"; out.textContent = "No se pudo correr: " + e; }
      });
  };

  // Refresca los contadores visibles (barra de acciones + KPI «sin veredicto») sin recargar.
  function __tcActualizarContadores() {
    var n = __tcPendIds.length;
    var ab = el("tc-actions");
    if (ab) {
      if (!n) ab.innerHTML = '<span class="tc-kbhint tc-kbhint--muted">No hay pendientes en esta vista.</span>';
      else {
        var btn = ab.querySelector(".tc-confirmall");
        if (btn) btn.innerHTML = '<i class="bi bi-check2-all"></i> Confirmar todos los pendientes (' + n + ')';
      }
    }
    var kp = el("tc-kpi-pend");
    if (kp) kp.textContent = __tcPendGlobal;
  }

  // ---------- Navegación por teclado (1/2/3/4/Enter/↑↓) sobre las filas pendientes ----------
  var __TC_TECLA = {"1": "jerarquizar", "2": "cuantificar", "3": "analizar", "4": "desconocido"};
  function __tcFilaPorId(id) {
    for (var i = 0; i < __tcFilas.length; i++) if (__tcFilas[i].id === id) return __tcFilas[i];
    return null;
  }
  function __tcPintarCursor() {
    var prev = document.querySelectorAll(".tc-row--cursor");
    for (var j = 0; j < prev.length; j++) prev[j].classList.remove("tc-row--cursor");
    if (__tcCursor < 0 || __tcCursor >= __tcPendIds.length) return;
    var row = el("tcrow-" + __tcPendIds[__tcCursor]);
    if (row) { row.classList.add("tc-row--cursor"); row.scrollIntoView({block: "nearest"}); }
  }
  function __tcMovCursor(delta) {
    if (!__tcPendIds.length) { __tcCursor = -1; return; }
    __tcCursor = (__tcCursor < 0) ? 0 : Math.max(0, Math.min(__tcPendIds.length - 1, __tcCursor + delta));
    __tcPintarCursor();
  }
  function __tcRateCursor(grupo) {   // grupo=null → Correcta (Enter)
    if (__tcCursor < 0 || __tcCursor >= __tcPendIds.length) return;
    var id = __tcPendIds[__tcCursor];
    var f = __tcFilaPorId(id);
    if (f) __tcCalificarLocal(id, grupo, f.grupo_asignado);
  }
  function __tcKeydown(e) {
    if (state.activeTab !== "testclas") return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    var k = e.key;
    if (__TC_TECLA[k]) { e.preventDefault(); __tcRateCursor(__TC_TECLA[k]); }
    else if (k === "Enter") { e.preventDefault(); __tcRateCursor(null); }
    else if (k === "ArrowDown") { e.preventDefault(); __tcMovCursor(1); }
    else if (k === "ArrowUp") { e.preventDefault(); __tcMovCursor(-1); }
  }
  document.addEventListener("keydown", __tcKeydown);

  // Las 4 celdas de una fila (sin el <tr>). Compartido por la carga de tabla y el pintado en vivo.
  function __tcRowInner(f) {
    var g = __V2_GRUPO[f.grupo_asignado] || __V2_GRUPO.desconocido;
    var fecha = (f.ts || "").replace("T", " ").slice(0, 16);
    var diag = f.llm_diag ? ' <span class="tc-diag" title="Diagnóstico LLM">' + esc(f.llm_diag) + '</span>' : '';
    return '<td class="tc-preg">' + esc(f.texto_pregunta) + '</td>' +
      '<td><span class="v2-grupo" style="--v2c:' + g.color + ';--v2s:' + g.soft + ';">' +
      '<i class="bi bi-' + g.icon + '"></i> ' + g.label + '</span>' +
      '<span class="v2-capa">' + esc(f.capa_resolutora) + '</span>' + diag +
      (f.entidad_cruda ? '<span class="v2-ent">' + esc(f.entidad_cruda) + '</span>' : '') + '</td>' +
      '<td class="tc-vcell">' + __tcVeredictoCell(f) + '</td>' +
      '<td class="tc-fecha">' + esc(fecha) + '</td>';
  }

  function __tcCargarTabla(filtro) {
    var cont = el("tc-tabla"); if (!cont) return;
    fetch("/api/consulta2/log?limit=100&filtro=" + encodeURIComponent(filtro || "todas"))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!el("tc-tabla")) return;   // cambió de pestaña mientras cargaba
        var res = d.resumen || {};
        var rc = el("tc-resumen");
        if (rc) {
          var pv = res.por_veredicto || {};
          var pend = (pv.pendiente || 0) + (pv.sospecha || 0);
          rc.innerHTML =
            '<span class="tc-kpi"><b>' + (res.total || 0) + '</b> clasificadas</span>' +
            '<span class="tc-kpi"><b id="tc-kpi-pend">' + pend + '</b> sin veredicto</span>' +
            '<span class="tc-kpi tc-kpi--gold"><b>' +
            (res.pct_capa1 == null ? "—" : res.pct_capa1 + "%") + '</b> resueltas por regex (Capa 1)</span>';
        }
        var filas = d.filas || [];
        __tcFilas = filas;
        __tcPendGlobal = ((res.por_veredicto || {}).pendiente || 0) + ((res.por_veredicto || {}).sospecha || 0);
        __tcPendIds = filas.filter(function (f) {
          return f.veredicto === "pendiente" || f.veredicto === "sospecha";
        }).map(function (f) { return f.id; });
        // Barra de acciones (confirmar-todo + recordatorio de teclas)
        var ab = el("tc-actions");
        if (ab) {
          ab.innerHTML = __tcPendIds.length
            ? '<button type="button" class="tc-confirmall" onclick="window.__tcConfirmarPendientes()">' +
              '<i class="bi bi-check2-all"></i> Confirmar todos los pendientes (' + __tcPendIds.length + ')</button>' +
              '<span class="tc-kbhint"><i class="bi bi-keyboard"></i> ' +
              '<b>1</b> Jerarq · <b>2</b> Cuant · <b>3</b> Anal · <b>4</b> Descon · <b>Enter</b> Correcta · <b>↑↓</b> mover</span>'
            : '<span class="tc-kbhint tc-kbhint--muted">No hay pendientes en esta vista.</span>';
        }
        if (!filas.length) {
          el("tc-tabla").innerHTML = '<div class="text-muted small p-3">Sin registros para este filtro.</div>';
          __tcCursor = -1;
          return;
        }
        var rows = filas.map(function (f) {
          var esPend = (f.veredicto === "pendiente" || f.veredicto === "sospecha");
          return '<tr id="tcrow-' + f.id + '"' + (esPend ? ' class="tc-row--pend"' : '') + '>' +
            __tcRowInner(f) + '</tr>';
        }).join("");
        el("tc-tabla").innerHTML =
          '<div class="tc-scroll"><table class="tc-tbl">' +
          '<thead><tr><th>Pregunta</th><th>Decisión del motor</th><th>Veredicto</th><th>Fecha</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>';
        __tcCursor = __tcPendIds.length ? 0 : -1;   // el cursor arranca en el 1.er pendiente
        __tcPintarCursor();
      })
      .catch(function () {
        var c2 = el("tc-tabla");
        if (c2) c2.innerHTML = '<div class="alert alert-danger m-2 small">No pude cargar la libreta.</div>';
      });
  }

  // ===== [2026-07-29] Respuesta de datos «Titular + métricas» (spec resp.md) =====
  // A1 · Vocabulario REAL del backend: ejecucion._ESTADO_LABEL = Alineado/Rezagado/Foco/"sin meta"
  // (umbrales de analisis.api._estado: ok>=90, warn>=75, alert<75). NO son las claves de
  // __CP_STATUS. "sin meta" cae en null a propósito → sin chip, que es lo honesto.
  var __DA_EST = {
    "alineado": { label: "Alineado", color: "#1E9E5A", soft: "#E9F3EC", icon: "check-circle-fill" },
    "rezagado": { label: "Rezagado", color: "#E8912B", soft: "#FBF1E4", icon: "exclamation-triangle-fill" },
    "foco":     { label: "Foco",     color: "#C5311E", soft: "#FBECEA", icon: "exclamation-octagon-fill" }
  };
  function __daEst(txt) { return __DA_EST[String(txt || "").trim().toLowerCase()] || null; }

  // D3 · misma convención que el panel: GAS en MSCF (÷1e6), el resto en bbl exactos. Evita que el
  // chat y el tablero digan cosas distintas del mismo número. A4: null NO se concatena como "null".
  function __daNum(v, prod) {
    if (v == null) return "—";
    return (String(prod).toUpperCase() === "GAS") ? __cnGasM(v) : __cnMilesEC(Math.round(v));
  }
  function __daUni(prod, porMes) {
    var u = (String(prod).toUpperCase() === "GAS") ? "MSCF" : "bbl";
    return porMes ? (u + "/mes") : u;
  }
  // A5 · "vivo" = produjo, o tiene curva diaria, o TIENE META (real=0 con meta es el peor caso
  // posible — ARAUCA/gas, PAUTO SUR/blancos — y debe verse, no desaparecer).
  function __daVivo(l) {
    return (l.real != null && l.real > 0) || l.mtd != null || (l.ppto != null && l.ppto > 0);
  }
  // D1.1 · titular = el PRIMERO con meta en el orden de negocio que ya emite el backend
  // (CRUDO→GAS→BLANCOS); si ninguno tiene meta, el primero con dato. NO se compara por volumen:
  // el gas crudo de la BD es numéricamente mayor que el crudo en barriles SIEMPRE (unidades
  // distintas), así que "el de mayor real" habría hecho titular al gas casi siempre.
  function __daTitular(lineas) {
    var vivos = (lineas || []).filter(__daVivo);
    if (!vivos.length) return null;
    for (var i = 0; i < vivos.length; i++) if (vivos[i].cumplimiento != null) return vivos[i];
    return vivos[0];
  }

  // ===== [2026-07-30] Invitación de cierre de la respuesta (TEXTO PLANO, sin botones) =====
  // Registro declarativo de los temas del panel derecho. `disponible` es el interruptor: los módulos
  // están EN CONSTRUCCIÓN y se ofrecen igual (decisión del usuario 2026-07-30 — el mock completo es
  // parte del desarrollo); si alguna vez hay que esconder uno, se apaga aquí y la copia no se toca.
  // "comportamiento diario" NO está en la lista a propósito (H4): es la pill que YA está abierta en
  // el panel cuando el usuario lee la frase, y ofrecer lo que está en pantalla resta credibilidad.
  // Dos campos de concordancia (AI4): `pos` para la variante A ("sus diferidas") y `art` para la B
  // ("las diferidas, los mantenimientos o el EBITDA-NOPAT de X").
  var __DA_TEMAS = [
    { id: "diferidas", label: "diferidas",      pos: "sus", art: "las", disponible: true },
    { id: "manten",    label: "mantenimientos", pos: "sus", art: "los", disponible: true },
    { id: "ebitda",    label: "EBITDA-NOPAT",   pos: "su",  art: "el",  disponible: true }
  ];
  var __DA_PROD_ART = { CRUDO: "el crudo", GAS: "el gas", BLANCOS: "los blancos" };
  var __daInvitaN = 0;   // rotación DETERMINISTA de sesión (nunca Math.random: no repite dos veces
                         // seguidas y el repintado del historial es estable — __cnHistory guarda el
                         // HTML ya generado, así que la función corre UNA vez por respuesta).

  function __daLista(xs) {            // ["a","b","c"] -> "a, b o c"
    if (!xs.length) return "";
    if (xs.length === 1) return xs[0];
    return xs.slice(0, -1).join(", ") + " o " + xs[xs.length - 1];
  }
  function __daCap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // 🔑 H1 · La entidad va NOMBRADA a propósito: el chat NO la arrastra entre preguntas
  // (maquina._PARCIAL se borra al resolver), así que un seguimiento como «diferidas» a secas moriría
  // en la extracción con "No identifiqué ninguna entidad". Nombrarla hace que el seguimiento natural
  // del usuario sí resuelva. NO se usan botones: decisión explícita del usuario (2026-07-30).
  // 🔑 AI1 · La variante B NO repite "solo reporta X este periodo": la tarjeta ya lo declara arriba
  // (línea "No reporta ... en el periodo"), y con la MISMA condición mudos.length -> era duplicación
  // garantizada, no ocasional.
  function __daInvitacion(resp, t, vivos, mudos) {
    var temas = __DA_TEMAS.filter(function (x) { return x.disponible; });
    var otros = vivos.filter(function (l) { return l !== t; })
                     .map(function (l) { return __DA_PROD_ART[String(l.producto).toUpperCase()]; })
                     .filter(Boolean);
    if (!temas.length && !otros.length) return "";
    var ent = esc(resp.entidad || "");
    var labels = temas.map(function (x) { return x.label; });
    var v = [];
    if (otros.length) {                                   // A
      v.push("Puedo correr esto mismo para " + __daLista(otros) + " de " + ent +
        (temas.length ? ", o entrar en " + temas[0].pos + " " + __daLista(labels) : "") + ".");
    } else if (mudos.length && temas.length) {            // B (solo si mudos lo respalda)
      v.push("¿Miramos " +
        __daLista(temas.map(function (x) { return x.art + " " + x.label; })) + " de " + ent + "?");
    }
    if (temas.length) {                                   // C
      v.push("¿Seguimos con otro ángulo de " + ent + "? " + __daCap(__daLista(labels)) + ".");
    }
    if (!v.length) return "";
    return v[(__daInvitaN++) % v.length];
  }

  function __cnRespuestaHtml(resp) {
    // Fase 3 determinista: burbuja con la cifra REAL vs PPTO. Sin resp -> nota honesta (compat).
    if (!resp) return '<p class="rb-chat__note">Por ahora dejo el pedido listo; el número real llega en la siguiente fase.</p>';
    if (!resp.aplica) return '<p class="rb-chat__note">' + esc(resp.texto || "") + '</p>';
    var av = (resp.avisos && resp.avisos.length)
      ? '<p class="rb-chat__note">' + resp.avisos.map(esc).join(" ") + '</p>' : "";
    // Fase 3.1: el diag de la narración se loguea SIEMPRE que venga (aunque sea fallback) → sigue
    // siendo el único rastro de por qué el LLM falla. La PROSA ya no se pinta aquí (ver D2 abajo).
    if (resp.narracion) {
      try { console.log("[narración] " + (resp.narracion.generado_por || "?"), resp.narracion.diag || {}); } catch (e) {}
    }
    // [2026-07-29 · D2] La prosa del LLM se RETIRA de esta burbuja (resp.md §7: no repetir en texto
    // lo que ya está en las métricas). ⚠️ Ops: con CONSULTA_NARRA_LLM=true el backend seguiría
    // generando la prosa para tirarla — apagar el flag en el .env de 139 (maquina.py llama a
    // narrar() SIEMPRE, antes de que el frontend decida qué pintar).

    // D4 · Rama B (filial): no tiene presupuesto sino "proyección vs su promedio 2026", y la
    // variación solo existe dentro de l.texto (el backend no la expone como campo). La tarjeta la
    // perdería → conserva el render de lista, que es TODO su contenido.
    if (resp.nivel === "filial" || resp.modo === "tendencia_filial") {
      var lisF = (resp.lineas || []).map(function (l) {
        return '<li class="cn-answer__row">' + esc(l.texto) + '</li>';
      }).join("");
      return '<div class="cn-answer">' +
        '<div class="cn-answer__head">' + esc(resp.encabezado || "") + '</div>' +
        '<ul class="cn-answer__list">' + lisF + '</ul>' +
        (resp.pie ? '<p class="rb-chat__note">' + esc(resp.pie) + '</p>' : "") + av + '</div>';
    }

    var L = resp.lineas || [];
    var t = __daTitular(L);
    if (!t) {   // ninguna línea con dato → nota honesta, no una tarjeta vacía (spec §8)
      return '<div class="cn-answer"><p class="rb-chat__note">' +
        esc(resp.encabezado || "") + '</p>' + av + '</div>';
    }
    var mes = resp.mes || {};
    var mesTxt = esc((mes.nombre || "") + (mes.anio ? " " + mes.anio : "")).trim();
    var est = __daEst(t.estado);
    var S = est || { color: "#3C4A44", soft: "#F1F4F1" };
    var nivLbl = (__cnNivelLabel[resp.nivel] || "").replace(/\s*\(.*\)\s*/, "");   // F4: sin paréntesis
    var esProy = !!resp.proyeccion;

    // --- Cabecera: nivel + entidad + chip de estado del titular (D-A5: el nivel se DICE) ---
    var head = '<div class="da__head">' +
      (nivLbl ? '<span class="da__eyebrow">' + esc(nivLbl) + '</span>' : "") +
      '<span class="da__entidad">' + esc(resp.entidad || "") + '</span>' +
      (est ? '<span class="da__chip"><i class="bi bi-' + est.icon + '"></i> ' + est.label + '</span>' : "") +
      '</div>';

    // --- Dato principal. A6: si hay curva diaria (solo CRUDO) el titular es lo PRODUCIDO y la
    // proyección baja a la grilla; si no, el titular ES la cifra del mes y NO se repite abajo.
    var hayMtd = (t.mtd != null);
    var bigVal = hayMtd ? t.mtd : t.real;
    var bigLbl = hayMtd
      ? ('Producido' + (mesTxt ? ' · ' + mesTxt : '') +
         (mes.dias_con_data ? ' · ' + mes.dias_con_data + ' de ' + mes.dias_del_mes + ' días con reporte' : ''))
      : ((esProy ? 'Proyección de cierre' : 'Cierre') + (mesTxt ? ' · ' + mesTxt : ''));
    var headline = '<div class="da__headline">' +
      '<div class="da__periodo">' + bigLbl + '</div>' +
      '<div class="da__big"><b>' + __daNum(bigVal, t.producto) + '</b>' +
        '<span>' + __daUni(t.producto, false) + ' de ' + esc(String(t.producto).toLowerCase()) + '</span></div>' +
      (t.bopd_avg != null
        ? '<div class="da__ritmo">ritmo promedio <b>' + __cnMilesEC(t.bopd_avg) + '</b> BOPD-avg</div>'
        : "") +
      '</div>';

    // --- Grilla: 1, 2 o 3 celdas según lo que EXISTA (nunca repite el número del titular) ---
    var uMes = __daUni(t.producto, true);
    var celda = function (lbl, val, uni, hero) {
      return '<div><dt class="da__m-label">' + lbl + '</dt>' +
        '<dd class="da__m-value' + (hero ? ' is-hero' : '') + '">' + val + '</dd>' +
        '<dd class="da__m-unit">' + uni + '</dd></div>';
    };
    var conMeta = (t.cumplimiento != null);
    var pctTxt = conMeta ? (String(t.cumplimiento).replace(".", ",") + "%") : "";
    var celdas = [];
    if (hayMtd) celdas.push(celda(esProy ? "Proyección de cierre" : "Cierre real",
                                  __daNum(t.real, t.producto), uMes, false));
    if (conMeta) {
      celdas.push(celda("Presupuesto", __daNum(t.ppto, t.producto), uMes, false));
      celdas.push(celda("Cumplimiento", pctTxt, "de la meta", true));
    }
    var grid = celdas.length
      ? '<dl class="da__grid da__grid--' + celdas.length + '">' + celdas.join("") + '</dl>' : "";

    // --- D1 · los demás productos con dato, una línea cada uno ---
    var otros = L.filter(function (l) { return l !== t && __daVivo(l); }).map(function (l) {
      var e2 = __daEst(l.estado);
      return '<div class="da__otro" style="--da-st2:' + (e2 ? e2.color : "#3C4A44") + '">' +
        '<span class="da__otro-prod">' + esc(l.producto) + '</span>' +
        '<span class="da__otro-val">' + __daNum(l.real, l.producto) + ' ' + __daUni(l.producto, true) + '</span>' +
        '<span class="da__otro-est">' + (l.cumplimiento != null
          ? String(l.cumplimiento).replace(".", ",") + '% · ' + esc(l.estado || "")
          : 'sin meta') + '</span></div>';
    }).join("");
    var bloqueOtros = otros ? '<div class="da__otros">' + otros + '</div>' : "";

    // --- Cierre: UNA oración, derivada del MISMO estado que pinta el chip (D5). Con un umbral
    // propio (>=100) un chip verde "Alineado" al 95,6% habría quedado junto a "por debajo de la
    // meta" — el mismo defecto ya reportado en las tarjetas P50. ---
    var cierre = "";
    if (conMeta) {
      cierre = 'Cerraría <b>' +
        (t.cumplimiento >= 100 ? "por encima de la meta"
          : (est && est.label === "Alineado" ? "alineado con la meta" : "por debajo de la meta")) +
        '</b> (' + pctTxt + ').';
    }
    // Productos que la entidad NO reporta (real 0 y sin meta): se declaran, no se ocultan.
    var mudos = L.filter(function (l) { return !__daVivo(l); }).map(function (l) { return l.producto; });
    if (mudos.length) cierre += (cierre ? " " : "") + "No reporta " + esc(mudos.join(" ni ")) + " en el periodo.";
    var pieCierre = cierre ? '<p class="da__cierre">' + cierre + '</p>' : "";

    // A2 · `pie` SE CONSERVA: es el descargo de proyección del 16-jul ("la cifra es del mes completo
    // y el reporte lleva N de M días"). Sin él se vuelve a leer una proyección como acumulado.
    var pieNota = resp.pie ? '<p class="rb-chat__note">' + esc(resp.pie) + '</p>' : "";

    // Invitación de cierre: último elemento de la tarjeta, debajo del pie y los avisos.
    var invita = __daInvitacion(resp, t, L.filter(__daVivo), mudos);
    var invitaHtml = invita ? '<p class="da__invita">' + invita + '</p>' : "";

    return '<div class="cn-answer da" style="--da-st:' + S.color + ';--da-st-soft:' + S.soft + '">' +
      head + headline + grid + bloqueOtros + pieCierre + pieNota + av + invitaHtml + '</div>';
  }
  window.__cnReanalizar = function (rama, valor, nivel, periodo, entidad) {
    // Cada botón "Analizar X" lleva SU propia entidad → clicar un análisis anterior reabre ESE, no el
    // último resuelto. (Antes usaba solo __cnLastIntent → todos los botones abrían el mismo reporte.)
    var it = (rama || valor)
      ? { rama: rama || null, valor: valor || null, nivel: nivel || null, periodo: periodo || null,
          entidad: entidad || valor || null }
      : __cnLastIntent;
    if (!it) return;
    __cnLastIntent = it;   // el análisis mostrado pasa a ser el intent activo (Volver/riel coherentes)
    // Filial (rama B): panel EXCLUSIVO de esa filial (su tendencia vs su promedio 2026), NO el panorama
    // de las 3 ni "Hocol como operador ECP". El resto (ECP) va a su Desempeño del mes de siempre.
    if (it.rama === "B") { window.__cnTendenciaFilial(it.valor || it.entidad); return; }
    window.__cnAnalizar(it.valor || it.entidad, "ecp", it.nivel, it.periodo);
  };
  function __cnRender(d) {
    if (d.status === "reformular" || d.status === "expirado" || d.status === "error") {
      var msg = d.mensaje || "";
      if (d.status !== "error") msg = __cnConNombre(msg);   // "Javier, no identifiqué…"
      __cnBubble("assistant", '<i class="bi bi-exclamation-triangle-fill me-1" style="color:var(--rb-chat-gold);"></i>' + esc(msg)); return;
    }
    // "¿Qué información hay de X?" → panel de huella (Densidad + Cobertura). Es su única puerta de
    // entrada desde que "Volver al panorama" devuelve al Desempeño global. Sin opciones: la huella
    // se resuelve por NOMBRE, así que es la misma para el Campo y para el Activo (ver meta.py).
    if (d.status === "huella") {
      __cnBubble("assistant", '<i class="bi bi-clipboard2-data me-1" style="color:var(--rb-chat-gold);"></i>' +
        esc(__cnConNombre(d.mensaje || "")));
      if (d.intent) {
        __cnLastIntent = d.intent;
        __cnRailSync(null);   // se muestra la huella, no un análisis del riel
        window.__cnDashboard(d.intent);
      }
      return;
    }
    if (d.status === "pendiente") {
      var rows = d.opciones.map(function (o) {
        return '<li><button type="button" class="rb-chat__option cn-opt-btn" ' +
          'onclick="window.__cnResponder(\'' + esc(o.id) + '\',\'' + esc(o.label) + '\')">' +
          '<span class="rb-chat__option-tile"><i class="bi bi-' + esc(__cnOptIcon(o)) + '"></i></span>' +
          '<span class="rb-chat__option-body"><span class="rb-chat__option-title">' + esc(o.label) + '</span>' +
          (o.desc ? '<span class="rb-chat__option-desc">' + esc(o.desc) + '</span>' : '') +
          '</span><i class="rb-chat__option-chev bi bi-chevron-right"></i></button></li>';
      }).join("");
      __cnBubble("assistant", esc(__cnConNombre(d.pregunta)) +
        '<ul class="rb-chat__options" role="list">' + rows + '</ul>');
      __cnOptsOpen = true;     // desambiguación viva → sus botones quedan activos
      __cnLastIntent = null;   // F3: olvida el dashboard de la entidad ANTERIOR mientras se elige
      // Preguntas de catálogo ("qué es X"): la entidad ya está resuelta y solo falta el nivel, del
      // que la huella NO depende → se pinta aquí en vez del aviso vacío. __cnDashboard reasigna
      // __cnLastIntent a la entidad NUEVA (no rompe F3: lo que se olvidó fue la anterior).
      // La desambiguación de la CIFRA no trae huella_intent → conserva el aviso de siempre.
      if (d.huella_intent) window.__cnDashboard(d.huella_intent);
      else __cnDashHint("Elige una de las opciones para ver su panorama de datos.");
      return;
    }
    if (d.status === "completo") {
      var it = d.intent, h = d.huella || {};
      // [2026-07-29] D-A5 en el BOTÓN: "Analizar castilla" era ambiguo por partida doble — no decía
      // el NIVEL (el Campo CASTILLA son 6,9M bbl y el Activo CASTILLA 11,7M: dos cifras distintas
      // bajo el mismo rótulo) y además ecoaba el término TAL COMO lo escribió el usuario
      // ("castilla"), no el nombre canónico de la BD. Ahora dice "Analizar el Activo CASTILLA",
      // igual que la respuesta (ejecucion._NIVEL_TEXTO) y que el título del panel (__cnTituloEnt).
      // Sin nivel conocido degrada al nombre a secas.
      var entName = esc(it.valor || it.entidad);
      var nivBtn = (__cnNivelLabel[it.nivel] || "").replace(/\s*\(.*\)\s*/, "");   // sin "(pozo)"/"(empresa)"
      var entTitulo = nivBtn
        ? ((__cnNivelArt[it.nivel] === "la" ? "la " : "el ") + esc(nivBtn) + " " + entName)
        : entName;
      // Botón analítico. Se marca SELECCIONADO (--active) porque su análisis es la vista que el panel
      // derecho abre por default — tanto en ECP (rama A, Desempeño) como en filial (rama B, tendencia).
      var entArg = (it.valor || it.entidad || "").replace(/'/g, "\\'");
      var analizarActiva = " rb-chat__option--active";
      // Filial (rama B) no tiene desglose por campo (la fuente es consolidada) → descripción acorde.
      var analizarDesc = (it.rama === "B")
        ? "Su proyección de cierre vs su promedio 2026, por producto"
        : "Cuánto produce, cómo ha cambiado y qué campos aportan más";
      // El botón fija SU propia entidad (rama/valor/nivel/periodo/entidad) en el onclick — así cada
      // "Analizar X" reabre su reporte, no el del último intent resuelto.
      var _v = function (s) { return esc(String(s == null ? "" : s)); };
      var reanCall = "window.__cnReanalizar('" + _v(it.rama) + "','" + _v(it.valor || it.entidad) + "','" +
        _v(it.nivel) + "','" + _v(it.periodo) + "','" + _v(it.entidad) + "')";
      var btnAnalizar = '<li><button type="button" class="rb-chat__option' + analizarActiva + '" onclick="' + reanCall + '">' +
        '<span class="rb-chat__option-tile"><i class="bi bi-bar-chart-line"></i></span>' +
        '<span class="rb-chat__option-body"><span class="rb-chat__option-title">Analizar ' + entTitulo + '</span>' +
        '<span class="rb-chat__option-desc">' + esc(analizarDesc) + '</span></span>' +
        '<i class="rb-chat__option-chev bi bi-chevron-right"></i></button></li>';
      // Botón "reporte de un día" (solo si hay grano diario). F4: <div role=button> con DIVS (para el mensaje de validación).
      var btnDia = "";
      if (h.aplica) {
        btnDia = '<li><div class="rb-chat__option">' +
          '<span class="rb-chat__option-tile"><i class="bi bi-calendar-event"></i></span>' +
          '<div class="rb-chat__option-body"><span class="rb-chat__option-title">Ver el reporte de un día</span>' +
          '<span class="rb-chat__option-desc">Consulta puntual de una fecha</span>' +
          '<div class="rb-chat__date" onclick="event.stopPropagation();">' +
          '<input type="date" aria-label="Fecha del reporte" min="' + esc(h.desde) + '" max="' + esc(h.hasta) + '" ' +
          'data-ent="' + esc(it.valor || it.entidad) + '" onchange="window.__cnVerReporteDia(this)">' +
          '<span class="rb-chat__date-badge">solo días con reporte</span></div>' +
          '</div><i class="rb-chat__option-chev bi bi-chevron-right"></i></div></li>';
      }
      // D-D5: zoom a Activo — nota determinista + botón; el clic reusa __cnResponder (flujo S3 del
      // backend, igual que una desambiguación). Botones cn-opt-btn → se deshabilitan solos con la
      // siguiente interacción (mismos rieles que la desambiguación: __cnOptsOpen/__cnDisableOpts).
      var zoomHtml = "";
      if (d.zoom && d.zoom.opciones && d.zoom.opciones.length) {
        var zrows = d.zoom.opciones.map(function (o) {
          return '<li><button type="button" class="rb-chat__option cn-opt-btn" ' +
            'onclick="window.__cnResponder(\'' + esc(o.id) + '\',\'' + esc(o.label) + '\')">' +
            '<span class="rb-chat__option-tile"><i class="bi bi-' + esc(__cnOptIcon(o)) + '"></i></span>' +
            '<span class="rb-chat__option-body"><span class="rb-chat__option-title">' + esc(o.label) + '</span>' +
            (o.desc ? '<span class="rb-chat__option-desc">' + esc(o.desc) + '</span>' : '') +
            '</span><i class="rb-chat__option-chev bi bi-chevron-right"></i></button></li>';
        }).join("");
        zoomHtml = '<p class="rb-chat__note cn-zoom-nota">' + esc(d.zoom.nota || "") + '</p>' +
          '<ul class="rb-chat__options" role="list">' + zrows + '</ul>';
      }
      __cnBubble("assistant",
        __cnRespuestaHtml(d.respuesta) +
        '<ul class="rb-chat__options" role="list">' + btnAnalizar + btnDia + '</ul>' + zoomHtml);
      if (zoomHtml) __cnOptsOpen = true;   // la oferta de zoom queda viva hasta la próxima interacción
      // Default del panel derecho = el ANÁLISIS de la entidad solicitada (no la huella/panorama). Guardamos
      // el intent para que "Volver" siga funcionando. Rama B (filial) → su panel EXCLUSIVO (tendencia +
      // gráfico mensual), NO la huella de datos: al preguntar por una filial se quiere ver su análisis.
      if (d.intent) {
        __cnLastIntent = d.intent;
        if (d.intent.rama === "B") {
          __cnPanelEntidad = null;   // filial (rama B) → Filiales SÍ aplica
          __cnRailSync(null);
          window.__cnTendenciaFilial(d.intent.valor || d.intent.entidad);
        } else {
          // __cnAnalizar fija __cnPanelEntidad y repinta el riel (Filiales deshabilitado por ser entidad ECP)
          window.__cnAnalizar(d.intent.valor || d.intent.entidad, "ecp", d.intent.nivel, d.intent.periodo);
        }
      }
    }
  }

  // paintFocoStk: los bloques "analiza_foco" que se encolan sin dimensión real
  // quedan marcados con data-pend-paint="1" y solo se vacían dentro de
  // renderViewer(). Quien hospede el viewer fuera de este shell (MainChat lo
  // reparte entre dos paneles colapsables, con el riel oculto) nunca dispara
  // renderViewer() y necesita poder saldar esa cola por su cuenta. Solo se
  // expone la función; el flujo de '/' no cambia.

  // MainChat necesita un historial de conversaciones, y __cnCid/__cnHistory son privadas
  // del IIFE. Manipular solo el DOM de #cn-messages no sirve: __cnHistory quedaría
  // desincronizado y el siguiente __cnReplay() repintaría la conversación anterior; además
  // "nueva conversación" debe cambiar el cid, o el backend sigue hilando el mismo thread.
  // Aditivo, como paintFocoStk: el flujo de '/' no cambia — nadie llama a esto allí.
  window.ConsultaHist = {
    snapshot: function () { return { cid: __cnCid, hist: __cnHistory.slice() }; },
    cargar: function (s) {
      if (!s || !s.cid || !Array.isArray(s.hist)) return false;
      __cnCid = s.cid;
      __cnHistory = s.hist.slice();
      __cnOptsOpen = false;   // una conversación restaurada no tiene desambiguación viva
      // [2026-08-26] El desplegable de "preguntas de esta conversación" no vive en #cn-messages
      // (__cnReplay no lo toca), así que si quedó ABIERTO se cierra a mano — si no, mostraría
      // preguntas de la conversación anterior hasta el próximo toggle.
      var _hd = el("cn-hist-drop"); if (_hd) _hd.hidden = true;
      __cnReplay();
      return true;
    },
    nueva: function () {
      __cnCid = "cn-" + Math.floor(Math.random() * 1e9);
      __cnHistory = [];
      __cnOptsOpen = false;
      var _hd2 = el("cn-hist-drop"); if (_hd2) _hd2.hidden = true;   // mismo motivo que cargar()
      __cnReplay();           // con el historial vacío, siembra el saludo
      return __cnCid;
    }
  };

  // stackScroll: lo usa acordeon.js tras repintar Plotly al expandir Insights — el resize cambia
  // la altura del contenido y la vista se quedaba arriba. Se expone para no duplicar allí la
  // búsqueda del scroller ni la doble medición.
  // [2026-08-30] analisisBtnHtml: acordeon.js lo llama al construir la cabecera del panel
  // Insights, donde ahora vive el waffle. Devuelve el HTML ya con el estado correcto
  // (punto indicador y title del análisis activo), porque esa cabecera se reconstruye en
  // cada colapsar/expandir y __cnRailActiva es privada de este módulo.
  window.MultiTabShell = { mount: mount, unmount: unmount, prewarm: __cnPrewarmGlobal, setActiveTab: setActiveTab, paintFocoStk: __cnPaintFocoStk, stackScroll: __cnStackScroll, compProdCargar: __cnCompProdCargar, analisisBtnHtml: __cnAnMenuBtn };
})();
