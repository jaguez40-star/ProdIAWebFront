// =====================================================================
// Shell MultiTab · pestañas verticales (variante A · pastillas rotadas)
// Prototipo aislado — solo se carga en /layout/colapsable.
// Vanilla JS (patrón del proyecto: clase + estado en memoria, sin deps).
// Fase actual: datos MOCK hardcodeados. La conexión a la API real de
// ingesta (/ingesta/*, /tablas/*) es una fase posterior.
// =====================================================================

(function () {
  "use strict";

  // ---------- Definición declarativa de pestañas ----------
  var TABS = [
    { id: "ingesta", label: "Ingesta", icon: "cloud-arrow-up-fill", sub: "Cargar y mapear reporte" },
    { id: "control", label: "Control", icon: "sliders2", sub: "Parámetros y reglas" },
    { id: "analisis", label: "Análisis", icon: "graph-up-arrow", sub: "Vistas avanzadas" },
  ];

  // ---------- Datos MOCK (espejo visual de la ingesta real) ----------
  var MOCK_SHEETS = [
    {
      id: "s-p50",
      name: "P50 Quemado 2024 ECP y Fili",
      tablas: 2,
      open: false,
      tables: [
        { id: "t-p50-1", name: "Tabla 1", tag: "P50 ECP", filas: 54 },
        { id: "t-p50-2", name: "Tabla 2", tag: "P50 Filiales", filas: 54 },
      ],
    },
    {
      id: "s-fili",
      name: "Producción filiales",
      tablas: 8,
      open: true,
      respaldoFilas: 69,
      raw: { destino: "fact_produccion_diaria", filas: 434 },
      tables: [
        { id: "t1", name: "Tabla 1", tag: "REAL", filas: 217 },
        { id: "t2", name: "Tabla 2", tag: "PROGRAMA", filas: 217 },
        { id: "t3", name: "Tabla 3", tag: "PROYECCIÓN", filas: 217 },
        { id: "t4", name: "Tabla 4", tag: "FILIALES mes/semana", filas: 52 },
        { id: "t5", name: "Tabla 5", tag: "Seguimiento semanal", filas: 20 },
        { id: "t6", name: "Tabla 6", tag: "REAL total empresa", filas: 90 },
        { id: "t7", name: "Tabla 7", tag: "PROGRAMA total empresa", filas: 93 },
        { id: "t8", name: "Tabla 8", tag: "Desempeño P50", filas: 16 },
      ],
    },
    {
      id: "s-bit",
      name: "(Bitacora)",
      tablas: 3,
      open: false,
      tables: [
        { id: "t-bit-1", name: "Tabla 1", tag: "Bitácora", filas: 12 },
        { id: "t-bit-2", name: "Tabla 2", tag: "Eventos", filas: 8 },
        { id: "t-bit-3", name: "Tabla 3", tag: "Notas", filas: 5 },
      ],
    },
  ];

  // Tabla mock del visualizador (mismos datos para cualquier selección — es solo shell)
  var MOCK_TABLE = {
    columns: ["EMPRESA", "PRODUCTO", "30/11", "01/12", "02/12", "03/12", "04/12", "05/12", "06/12", "07/12"],
    rows: [
      ["Hocol", "CRUDO", "16.885,6", "17.910,7", "17.590,9", "17.341,3", "17.668,2", "17.635,7", "17.599,4", "17.797,8"],
      ["Hocol", "GAS", "17.589,2", "18.622,3", "16.337", "20.730,1", "18.027,3", "18.070,6", "18.276,6", "18.198,3"],
      ["America", "CRUDO", "3.877,6", "5.112", "7.279", "8.397", "7.392", "7.352", "8.167", "9.155"],
      ["America", "GAS", "855,2", "1.049", "1.210", "1.332", "1.212", "1.190", "1.272", "1.319"],
      ["Permian", "CRUDO", "54.304", "58.804,6", "57.885,9", "59.215,5", "61.494,2", "61.219,3", "60.708,3", "60.457,4"],
      ["Permian", "GAS", "16.580,3", "17.796,7", "17.105,2", "17.672,9", "18.075", "18.377,1", "18.210,9", "18.577,6"],
      ["Permian", "BLANCOS", "19.276,3", "21.158", "20.387,3", "21.139,6", "21.588", "22.013,2", "21.810,1", "22.201,1"],
    ],
  };

  // ---------- Estado en memoria (sin localStorage) ----------
  var state = {
    activeTab: "ingesta",
    selection: null, // { tableId, sheetName, name, tag, filas }
    collapsed: false,
    openSheets: {}, // sheetId -> bool
  };

  MOCK_SHEETS.forEach(function (s) {
    state.openSheets[s.id] = !!s.open;
  });

  // ---------- Utilidades ----------
  // Escape explícito (incluye comillas — seguro también en contexto de atributo)
  function esc(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function el(id) {
    return document.getElementById(id);
  }

  function tabDef(id) {
    for (var i = 0; i < TABS.length; i++) if (TABS[i].id === id) return TABS[i];
    return TABS[0];
  }

  // ---------- Render · pestaña Ingesta (mock card + árbol) ----------
  function renderIngestaBody() {
    var html =
      '<div class="rb-cp-upcard">' +
      '  <div class="rb-cp-upcard__head">' +
      '    <i class="bi bi-cloud-arrow-up-fill" aria-hidden="true"></i>' +
      '    <div><strong>Cargar Reporte Diario</strong>' +
      '    <small>nombre con fecha YYYYMMDD</small></div>' +
      '    <span class="rb-cp-upcard__new">NEW</span>' +
      "  </div>" +
      '  <div class="rb-cp-upcard__file">' +
      '    <i class="bi bi-filetype-xlsx" aria-hidden="true"></i>' +
      "    <div><strong>20241004_Repor…TEST.xlsm</strong>" +
      '    <small><i class="bi bi-check-circle-fill"></i> Fecha 04/10/2024 · destino CPF</small></div>' +
      '    <button type="button" class="rb-cp-upcard__change" disabled title="Mock — sin conexión en esta fase">Cambiar</button>' +
      "  </div>" +
      '  <button type="button" class="rb-cp-upcard__submit" disabled title="Mock — sin conexión en esta fase">' +
      '    <i class="bi bi-box-arrow-in-down" aria-hidden="true"></i> CARGAR E INGERIR</button>' +
      "</div>" +
      '<div class="rb-cp-treehd"><strong>Hojas del archivo</strong>' +
      '  <span class="rb-cp-badge">' + MOCK_SHEETS.length + " / " + MOCK_SHEETS.length + "</span></div>" +
      '<ul class="rb-cp-tree" id="rb-cp-tree">';

    MOCK_SHEETS.forEach(function (sheet) {
      var open = state.openSheets[sheet.id];
      html +=
        '<li class="rb-cp-tree__sheet' + (open ? " is-open" : "") + '" data-sheet="' + sheet.id + '">' +
        '  <button type="button" class="rb-cp-tree__sheethd" data-action="toggle-sheet" data-sheet="' + sheet.id + '"' +
        '          aria-expanded="' + (open ? "true" : "false") + '">' +
        '    <i class="bi bi-chevron-right rb-cp-chev" aria-hidden="true"></i>' +
        '    <i class="bi bi-check-circle-fill rb-cp-ok" aria-hidden="true"></i>' +
        "    <span>" + esc(sheet.name) + "</span>" +
        '    <span class="rb-cp-badge">' + sheet.tablas + " tablas</span>" +
        "  </button>" +
        '  <div class="rb-cp-tree__kids">';

      if (sheet.respaldoFilas) {
        html +=
          '<div class="rb-cp-tree__meta"><i class="bi bi-archive" aria-hidden="true"></i>' +
          "<span>Respaldo</span><span class=\"rb-cp-badge\">" + sheet.respaldoFilas + " filas</span></div>";
      }
      if (sheet.raw) {
        html +=
          '<div class="rb-cp-tree__meta"><i class="bi bi-database" aria-hidden="true"></i>' +
          "<span>RAW →</span><code>" + esc(sheet.raw.destino) + "</code>" +
          '<span class="rb-cp-badge rb-cp-badge--blue">' + sheet.raw.filas + " filas</span></div>";
      }
      html +=
        '<div class="rb-cp-tree__grouphd"><i class="bi bi-diagram-3" aria-hidden="true"></i>' +
        "<span>Para análisis</span><span class=\"rb-cp-badge\">" + sheet.tables.length + " tablas</span></div>";

      sheet.tables.forEach(function (t) {
        var active = state.selection && state.selection.tableId === t.id;
        html +=
          '<button type="button" class="rb-cp-tree__row' + (active ? " is-active" : "") + '"' +
          '        data-action="pick-table" data-table="' + t.id + '" data-sheet="' + sheet.id + '">' +
          '  <i class="bi bi-table" aria-hidden="true"></i>' +
          "  <span>" + esc(t.name) + "</span>" +
          '  <span class="rb-cp-tree__rowtag">· ' + esc(t.tag) + "</span>" +
          '  <span class="rb-cp-badge">' + t.filas + " filas</span>" +
          "</button>";
      });

      html += "</div></li>";
    });

    html += "</ul>";
    return html;
  }

  // ---------- Render · placeholders Control / Análisis ----------
  function renderEmptyBody(tab) {
    return (
      '<div class="rb-cp-empty">' +
      '  <div class="rb-cp-empty__eyebrow">' + esc(tab.label) + "</div>" +
      '  <h6 class="rb-cp-empty__title"><i class="bi bi-' + tab.icon + '" aria-hidden="true"></i> ' + esc(tab.label) + "</h6>" +
      '  <p class="rb-cp-empty__sub">Contenedor reservado — sin contenido aún</p>' +
      '  <div class="rb-cp-empty__drop">' +
      '    <div><i class="bi bi-plus-square-dotted" aria-hidden="true"></i>' +
      "    <span>" + esc(tab.sub) + "</span></div>" +
      "  </div>" +
      "</div>"
    );
  }

  // ---------- Render · panel de contenido ----------
  function renderPanelBody() {
    var body = el("rb-cp-panel-body");
    if (!body) return;
    if (state.activeTab === "ingesta") {
      body.innerHTML = renderIngestaBody();
    } else {
      body.innerHTML = renderEmptyBody(tabDef(state.activeTab));
    }
  }

  // ---------- Render · visualizador (router por pestaña + selección) ----------
  function viewerEmpty(icon, eyebrow, hint, gold, headIcon, headTitle) {
    return (
      '<div class="rb-cp-vhead">' +
      '  <i class="bi bi-' + headIcon + '" aria-hidden="true"></i>' +
      '  <span class="rb-cp-vhead__title' + (gold ? " is-gold" : "") + '">' + esc(headTitle) + "</span>" +
      "</div>" +
      '<div class="rb-cp-vempty"><div class="rb-cp-vempty__inner">' +
      '  <div class="rb-cp-vempty__chip"><i class="bi bi-' + icon + '" aria-hidden="true"></i></div>' +
      '  <div class="rb-cp-vempty__eyebrow">' + esc(eyebrow) + "</div>" +
      '  <p class="rb-cp-vempty__hint">' + esc(hint) + "</p>" +
      "</div></div>"
    );
  }

  function viewerTable(sel) {
    var title = sel.sheetName + " — " + sel.name + (sel.tag ? " (" + sel.tag + ")" : "");
    var html =
      '<div class="rb-cp-vhead">' +
      '  <i class="bi bi-table" aria-hidden="true"></i>' +
      '  <span class="rb-cp-vhead__title">' + esc(title) + "</span>" +
      '  <span class="rb-cp-vhead__meta">' + MOCK_TABLE.rows.length + " filas × " +
      (MOCK_TABLE.columns.length - 2) + " días (mock)</span>" +
      "</div>" +
      '<div class="rb-cp-vtable"><table><thead><tr>';

    MOCK_TABLE.columns.forEach(function (c) {
      html += "<th>" + esc(c) + "</th>";
    });
    html += "</tr></thead><tbody>";

    MOCK_TABLE.rows.forEach(function (r) {
      html += '<tr><th scope="row">' + esc(r[0]) + '</th><td class="is-dim">' + esc(r[1]) + "</td>";
      for (var i = 2; i < r.length; i++) html += "<td>" + esc(r[i]) + "</td>";
      html += "</tr>";
    });

    html +=
      "</tbody></table></div>" +
      '<div class="rb-cp-vfoot"><span>' + MOCK_TABLE.rows.length + " filas visibles · datos MOCK (shell sin conexión)</span>" +
      '<span><i class="bi bi-arrow-left-right" aria-hidden="true"></i> Desplaza para ver todas las columnas · 1ª columna fija</span></div>';
    return html;
  }

  function renderViewer() {
    var viewer = el("rb-cp-viewer");
    if (!viewer) return;
    if (state.activeTab === "ingesta") {
      viewer.innerHTML = state.selection
        ? viewerTable(state.selection)
        : viewerEmpty("hand-index-thumb", "Visualizador",
            "Selecciona una tabla del árbol para inspeccionarla", false,
            "clipboard2-data", "Visualizador");
    } else if (state.activeTab === "control") {
      viewer.innerHTML = viewerEmpty("sliders2", "Panel de control",
        "Configura parámetros y reglas de negocio", false,
        "clipboard2-data", "Panel de Control");
    } else {
      viewer.innerHTML = viewerEmpty("graph-up-arrow", "Análisis",
        "Vistas y KPIs avanzados de producción", true,
        "clipboard2-data", "Análisis Avanzado de Producción Diaria");
    }
  }

  // ---------- Navegación de pestañas ----------
  function setActiveTab(tabId) {
    var reopening = state.collapsed;
    if (reopening) {
      // Clic en el riel con panel colapsado → reabrir (contrato adaptado al sandbox)
      state.collapsed = false;
      var root0 = el("rb-cp");
      if (root0) root0.classList.remove("is-collapsed");
    }
    // Clic/Enter en la pestaña ya activa sin colapso: no re-renderizar
    // (evita reconstruir el árbol y perder la posición de scroll del panel)
    if (!reopening && state.activeTab === tabId) return;
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

  // ---------- Selección de tabla (solo Ingesta) ----------
  function pickTable(tableId, sheetId) {
    var sheet = null, table = null;
    MOCK_SHEETS.forEach(function (s) {
      if (s.id === sheetId) {
        sheet = s;
        s.tables.forEach(function (t) { if (t.id === tableId) table = t; });
      }
    });
    if (!sheet || !table) return;
    state.selection = {
      tableId: table.id,
      sheetName: sheet.name,
      name: table.name,
      tag: table.tag,
      filas: table.filas,
    };
    // Marcar fila activa sin re-render completo del árbol
    document.querySelectorAll("#rb-cp-tree .rb-cp-tree__row").forEach(function (row) {
      row.classList.toggle("is-active", row.dataset.table === tableId);
    });
    renderViewer();
  }

  function toggleSheet(sheetId) {
    state.openSheets[sheetId] = !state.openSheets[sheetId];
    var li = document.querySelector('#rb-cp-tree .rb-cp-tree__sheet[data-sheet="' + sheetId + '"]');
    if (!li) return;
    li.classList.toggle("is-open", state.openSheets[sheetId]);
    var hd = li.querySelector(".rb-cp-tree__sheethd");
    if (hd) hd.setAttribute("aria-expanded", state.openSheets[sheetId] ? "true" : "false");
  }

  // ---------- Colapso del panel ----------
  function toggleCollapse() {
    state.collapsed = !state.collapsed;
    var root = el("rb-cp");
    if (root) root.classList.toggle("is-collapsed", state.collapsed);
    if (state.collapsed) {
      // El botón "−" desaparece con el panel: mover el foco a la pestaña activa
      // del riel para que el usuario de teclado conserve el punto de retorno.
      var activeBtn = document.querySelector("#rb-cp .rb-cp__tab.is-active");
      if (activeBtn) activeBtn.focus();
    }
  }

  // ---------- Init ----------
  function init() {
    var root = el("rb-cp");
    if (!root) return; // defensivo: este JS solo actúa en /layout/colapsable

    // Riel: clic + teclado
    root.querySelectorAll(".rb-cp__tab").forEach(function (btn) {
      btn.addEventListener("click", function () { setActiveTab(btn.dataset.tab); });
      btn.addEventListener("keydown", onRailKeydown);
    });

    // Botón colapsar
    var collapseBtn = el("rb-cp-collapse");
    if (collapseBtn) collapseBtn.addEventListener("click", toggleCollapse);

    // Delegación de eventos en el cuerpo del panel (árbol mock)
    var body = el("rb-cp-panel-body");
    if (body) {
      body.addEventListener("click", function (e) {
        var target = e.target.closest("[data-action]");
        if (!target) return;
        if (target.dataset.action === "toggle-sheet") toggleSheet(target.dataset.sheet);
        else if (target.dataset.action === "pick-table") pickTable(target.dataset.table, target.dataset.sheet);
      });
    }

    renderPanelBody();
    renderViewer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
