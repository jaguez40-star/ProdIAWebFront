// Chat Manager - WebSocket handling and chat functionality

// Function to open production report modal from welcome screen
window.openProductionReportModal = function openProductionReportModal() {
  console.log("🎯 openProductionReportModal called");

  // Hide welcome screen
  const chatMessages = document.getElementById("chat-messages");
  const welcomeSection = document.querySelector(".chat-welcome-section");
  const chatBanner = document.querySelector(".chat-banner");

  if (welcomeSection) {
    welcomeSection.style.display = "none";
    console.log("👋 Hidden welcome section");
  }

  if (chatBanner) {
    chatBanner.style.display = "none";
    console.log("🏷️ Hidden chat banner");
  }

  // Show chat input (hidden on main page)
  const chatInput1 = document.querySelector(".chat-input-container");
  if (chatInput1) chatInput1.style.display = "";

  if (chatMessages) {
    chatMessages.style.display = "block";
    chatMessages.classList.remove("empty-chat");
    chatMessages.classList.add("has-content");
    console.log("💬 Prepared chat messages area");
  }

  // Restaurar título por defecto del panel derecho
  const panelTitleRep = document.getElementById("analytics-panel-title");
  if (panelTitleRep) panelTitleRep.textContent = "Análisis de Desempeño";

  // Show production report options directly in the chat
  if (window.ChatManager) {
    window.ChatManager.showProductionReportInChat();
  }
};

// Function to handle predefined queries from the welcome screen
window.sendPredefinedQuery = function sendPredefinedQuery(query) {
  console.log("🎯 sendPredefinedQuery called with:", query);

  const chatMessages = document.getElementById("chat-messages");
  const welcomeSection = document.querySelector(".chat-welcome-section");
  const chatBanner = document.querySelector(".chat-banner");

  console.log("📋 Elements found:", {
    chatMessages: !!chatMessages,
    welcomeSection: !!welcomeSection,
    chatBanner: !!chatBanner,
    ChatManager: !!window.ChatManager,
  });

  if (welcomeSection) {
    welcomeSection.style.display = "none";
    console.log("👋 Hidden welcome section");
  }

  if (chatBanner) {
    chatBanner.style.display = "none";
    console.log("🏷️ Hidden chat banner");
  }

  // Show chat input (hidden on main page)
  const chatInput2 = document.querySelector(".chat-input-container");
  if (chatInput2) chatInput2.style.display = "";

  if (chatMessages) {
    chatMessages.style.display = "block";
    chatMessages.classList.remove("empty-chat");
    chatMessages.classList.add("has-content");
    console.log("💬 Prepared chat messages area");
  }

  // Send the predefined query
  if (window.ChatManager && window.ChatManager.sendMessage) {
    // Set the message in the input field first
    const messageInput = document.getElementById("message-input");
    if (messageInput) {
      messageInput.value = query;
      console.log("✍️ Set message in input field");
    }
    // Then send it
    console.log("📤 Calling ChatManager.sendMessage()");
    window.ChatManager.sendMessage();
  } else {
    console.error("❌ ChatManager or sendMessage not available!");
  }
};

// Function to start a Robustez analysis chat session
window.startRobustezChat = function startRobustezChat() {
  console.log("💰 startRobustezChat called");

  const chatMessages = document.getElementById("chat-messages");
  const welcomeSection = document.querySelector(".chat-welcome-section");
  const chatBanner = document.querySelector(".chat-banner");

  if (welcomeSection) {
    welcomeSection.style.display = "none";
  }

  if (chatBanner) {
    chatBanner.style.display = "none";
  }

  // Show chat input (hidden on main page)
  const chatInput3 = document.querySelector(".chat-input-container");
  if (chatInput3) chatInput3.style.display = "";

  if (chatMessages) {
    chatMessages.style.display = "block";
    chatMessages.classList.remove("empty-chat");
    chatMessages.classList.add("has-content");
  }

  if (window.ChatManager) {
    window.ChatManager.setRobustezMode(true);
  }

  // Restaurar título por defecto del panel derecho
  const panelTitleRbt = document.getElementById("analytics-panel-title");
  if (panelTitleRbt) panelTitleRbt.textContent = "Análisis de Desempeño";

  // Mostrar bienvenida en panel de Análisis (derecha) en lugar del chat
  const emptyState = document.getElementById("analytics-empty-state");
  const chartsArea = document.getElementById("charts-display-area");
  if (emptyState) emptyState.style.display = "none";
  if (chartsArea) {
    chartsArea.style.display = "block";
    chartsArea.innerHTML = `
      <div class="robustez-welcome-card">
        <h5><strong>Consulta: Análisis de Producción y Rentabilidad</strong></h5>
        <p>Analiza producción fiscalizada y resultados económicos consultando a nivel de
        <strong>Vicepresidencia, Gerencia, Campo o Pozo</strong>.</p>

        <h6><strong>Tipos de análisis disponibles:</strong></h6>
        <ul>
          <li><strong>Económico:</strong> Breakeven, EBITDA, costos variables, transporte, dilución</li>
          <li><strong>Clasificación:</strong> Pozos rentables, marginales y no rentables</li>
          <li><strong>Producción:</strong> Tasas de aceite, volúmenes mensuales, días de producción</li>
          <li><strong>Temporal:</strong> Evolución mes a mes, variaciones, acumulados YTD</li>
          <li><strong>Comparativo:</strong> Entre campos, gerencias o vicepresidencias</li>
        </ul>

        <h6><strong>Ejemplos de preguntas:</strong></h6>
        <ul class="robustez-examples">
          <li><em>"¿Cuántos pozos son rentables vs no rentables por gerencia?"</em></li>
          <li><em>"¿Cuál es el breakeven promedio por campo?"</em></li>
          <li><em>"En 2025, por mes, cuál es la producción de aceite del campo CASTILLA?"</em></li>
          <li><em>"¿Cuál es el EBITDA total por vicepresidencia?"</em></li>
          <li><em>"En 2025, por mes, cuál es el comportamiento de la producción para la VP GOR?"</em></li>
        </ul>
      </div>
    `;
  }
};

window.startAdvancedDailyAnalysis = function startAdvancedDailyAnalysis() {
  if (window.MultiTabShell) window.MultiTabShell.mount();
};

// Hoja colapsable: chevron + check + nombre + badge "N tablas"; contenedor de hijos.
// I1: conserva la clase 'ingesta-sheet' (la usa ingestaMarkSoloRespaldo) además de 'ig-sheet'.
window.ingestaSheetLi = function ingestaSheetLi(n) {
  const safe = String(n).replace(/"/g, "&quot;");
  return `<li class="ig-sheet ingesta-sheet is-open" data-hoja="${safe}">
    <div class="ig-sheet__hd" onclick="window.igToggleSheet(this)">
      <i class="bi bi-chevron-right ig-chev"></i>
      <i class="bi bi-check-circle-fill ig-ok is-pending ingesta-ic"></i>
      <span class="ig-sheet__name">${n}</span>
      <span class="ig-badge ig-badge--blue ig-sheet__count" style="display:none"></span>
    </div>
    <ul class="ig-sheet__kids ingesta-children list-unstyled mb-0"></ul>
  </li>`;
};

// Tras terminar, marca como "· solo respaldo" las hojas que nunca recibieron destino Core.
window.ingestaMarkSoloRespaldo = function ingestaMarkSoloRespaldo() {
  document.querySelectorAll("#ingesta-sheet-list li.ingesta-sheet").forEach((li) => {
    const kids = li.querySelector(".ingesta-children");
    if (!kids || kids.querySelector(".ingesta-analisis")) return;
    const r = kids.querySelector(".ingesta-respaldo");
    if (r && !r.querySelector(".ingesta-solo")) {
      const note = document.createElement("span");
      note.className = "ingesta-solo fst-italic ms-1";
      note.textContent = "· sin tabla de análisis";
      r.appendChild(note);
    }
  });
};

window.igReadSheetsPreview = async function igReadSheetsPreview(file) {
  const sheetsBox = document.getElementById("ingesta-sheets");
  const status = document.getElementById("ingesta-status");
  const badge = document.getElementById("ingesta-mode-badge");
  if (status) status.innerHTML = "";
  if (!file || !sheetsBox) return;
  sheetsBox.innerHTML = '<div class="text-muted small"><div class="spinner-border spinner-border-sm"></div> Leyendo hojas…</div>';
  try {
    const names = await window.readSheetsFromXlsm(file);
    window.__ingestaTotal = names.length;
    window.__ingestaDone = 0;
    const RAW = ["BDP_datos_dia", "BDP_datos_mes", "BDP_Programa"];
    const esNew = RAW.every((r) => names.includes(r));
    if (badge) badge.textContent = esNew ? "NEW" : "STD";
    const items = names.map((n) => window.ingestaSheetLi(n)).join("");
    sheetsBox.innerHTML = `
      <div class="ig-tree__head">
        <span class="ig-tree__title">Hojas del archivo</span>
        <span class="ig-badge ig-badge--blue" id="ingesta-counter">0 / ${names.length}</span>
        <span class="ig-mode">${esNew ? "NEW" : "STD"}</span>
        <button class="ig-expand-btn" onclick="window.igExpandAll(this)" aria-pressed="true">
          <i class="bi bi-chevron-bar-contract"></i> Colapsar todo</button>
      </div>
      <ul id="ingesta-sheet-list" class="ig-tree__body">${items}</ul>`;
  } catch (err) {
    sheetsBox.innerHTML = `<div class="alert alert-warning py-2">No se pudieron leer las hojas: ${err}</div>`;
  }
};

window.readSheetsFromXlsm = async function readSheetsFromXlsm(file) {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const entry = zip.file("xl/workbook.xml");
  if (!entry) throw new Error("no es un .xlsx/.xlsm válido");
  const xml = await entry.async("string");
  const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return [...xml.matchAll(/<sheet[^>]*\bname="([^"]+)"/g)].map((m) => decode(m[1]));
};

window._ingestaDoUpload = async function _ingestaDoUpload() {
  const status = document.getElementById("ingesta-status");
  const btn = document.getElementById("ingesta-upload-btn");
  window.__ingestaDone = 0;
  document.querySelectorAll("#ingesta-sheet-list li").forEach((li) => {
    const ic = li.querySelector(".ingesta-ic"); if (ic) ic.classList.add("is-pending");
    const cnt = li.querySelector(".ig-sheet__count"); if (cnt) cnt.style.display = "none";
    delete li.dataset.contado;
    const kids = li.querySelector(".ingesta-children"); if (kids) kids.innerHTML = "";
  });
  const counter = document.getElementById("ingesta-counter");
  if (counter && window.__ingestaTotal) counter.textContent = `0 / ${window.__ingestaTotal}`;

  const fd = new FormData();
  fd.append("file", window.__ingestaFile);
  const prev = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-arrow-repeat ig-spin"></i> CARGANDO…'; }
  status.innerHTML = '<div class="d-flex align-items-center gap-2"><div class="spinner-border spinner-border-sm"></div> Ingiriendo… (no cierres esta ventana; un archivo NEW puede tardar varios minutos)</div>';
  try {
    const r = await fetch("/api/ingesta/upload_stream", { method: "POST", body: fd });
    const data = await r.json();
    window.renderIngestaFinal(data);
  } catch (e) {
    status.innerHTML = `<div class="alert alert-danger">Fallo de red: ${e}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = prev; }
  }
};

window._ingestaShowOverwriteModal = function _ingestaShowOverwriteModal(info) {
  let modal = document.getElementById("ingesta-overwrite-modal");
  if (modal) modal.remove();
  modal = document.createElement("div");
  modal.id = "ingesta-overwrite-modal";
  modal.className = "ig-modal-backdrop";
  modal.innerHTML = `
    <div class="ig-modal">
      <div class="ig-modal__icon"><i class="bi bi-exclamation-triangle-fill"></i></div>
      <div class="ig-modal__title">Reporte ya ingestado</div>
      <div class="ig-modal__body">
        Ya existe un reporte para la fecha <strong>${info.fecha || ""}</strong>
        que fue cargado previamente.<br>
        <div class="ig-modal__detail">
          <span class="ig-modal__label">Archivo:</span> ${info.archivo || "—"}<br>
          <span class="ig-modal__label">Tipo:</span> ${info.tipo || "—"}<br>
          <span class="ig-modal__label">Ingestado:</span> ${info.ingested_at || "—"}
        </div>
        <strong>Los datos existentes serán sobrescritos.</strong>
      </div>
      <div class="ig-modal__actions">
        <button class="ig-modal__btn ig-modal__btn--cancel" id="ig-modal-cancel">Cancelar</button>
        <button class="ig-modal__btn ig-modal__btn--confirm" id="ig-modal-confirm">
          <i class="bi bi-arrow-repeat"></i> Sobrescribir e Ingestar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  return new Promise((resolve) => {
    document.getElementById("ig-modal-confirm").onclick = () => { modal.remove(); resolve(true); };
    document.getElementById("ig-modal-cancel").onclick = () => { modal.remove(); resolve(false); };
    modal.addEventListener("click", (e) => { if (e.target === modal) { modal.remove(); resolve(false); } });
  });
};

window.handleIngestaUpload = async function handleIngestaUpload() {
  const status = document.getElementById("ingesta-status");
  const btn = document.getElementById("ingesta-upload-btn");
  const file = window.__ingestaFile;
  if (!file || (btn && btn.disabled)) {
    if (status) status.innerHTML = '<div class="alert alert-warning py-2">Selecciona un archivo con fecha válida (YYYYMMDD) primero.</div>';
    return;
  }
  const fechaMatch = file.name.match(/\d{8}/);
  if (fechaMatch) {
    try {
      const r = await fetch(`/api/ingesta/check_existing?fecha=${fechaMatch[0]}`);
      const info = await r.json();
      if (info.exists) {
        const d = fechaMatch[0];
        info.fecha = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
        const continuar = await window._ingestaShowOverwriteModal(info);
        if (!continuar) {
          if (status) status.innerHTML = '';
          const sheetsBox = document.getElementById("ingesta-sheets");
          if (sheetsBox) sheetsBox.innerHTML = '';
          window.igRenderDropzone();
          return;
        }
      }
    } catch (_) { /* si el check falla, continuar con la ingesta normal */ }
  }
  window._ingestaDoUpload();
};

window.renderIngestaFinal = function renderIngestaFinal(data) {
  const status = document.getElementById("ingesta-status");
  if (!data || data.success === false) {
    status.innerHTML = `<div class="alert alert-danger">Error: ${(data && (data.error || data.detail)) || "desconocido"}</div>`;
    return;
  }
  window.ingestaMarkSoloRespaldo();   // hojas sin destino Core → "· sin tabla de análisis"
  const res = data.resultado || {};
  const nf2 = (x) => Number(x).toLocaleString("es-CO");
  status.innerHTML = `
    <div class="ig-resumen">
      <div class="ig-resumen__hd"><i class="bi bi-check-circle-fill"></i>
        <span>${res.archivo || ""}<span class="ig-resumen__sub">(${res.tipo_archivo || ""}) → reporte_id ${res.reporte_id}</span></span>
      </div>
      ${Object.entries(res.filas_por_tabla || {}).map(([k, v]) =>
        `<div class="ig-resumen__item"><span class="ig-dot"></span>
          <span class="ig-resumen__k">${k}</span><span class="ig-resumen__v">${nf2(v)}</span></div>`).join("")}
    </div>`;
};

window.renderIngestaProgress = function renderIngestaProgress(ev) {
  const counter = document.getElementById("ingesta-counter");
  if (!ev || !ev.tipo) return;

  if (ev.tipo === "advertencia") return;

  // Fallback: construir la lista desde el backend si JSZip falló
  if (ev.tipo === "inicio") {
    const box = document.getElementById("ingesta-sheets");
    if (box && !document.getElementById("ingesta-sheet-list") && Array.isArray(ev.hojas)) {
      window.__ingestaTotal = ev.total || ev.hojas.length;
      window.__ingestaDone = 0;
      const items = ev.hojas.map((n) => window.ingestaSheetLi(n)).join("");
      box.innerHTML = `
        <div class="ig-tree__head">
          <span class="ig-tree__title">Hojas del archivo</span>
          <span class="ig-badge ig-badge--blue" id="ingesta-counter">0 / ${window.__ingestaTotal}</span>
          <span class="ig-mode">${ev.tipo_archivo || "STD"}</span>
          <button class="ig-expand-btn" onclick="window.igExpandAll(this)" aria-pressed="true">
            <i class="bi bi-chevron-bar-contract"></i> Colapsar todo</button>
        </div>
        <ul id="ingesta-sheet-list" class="ig-tree__body">${items}</ul>`;
    }
    return;
  }

  const findLi = (hoja) => {
    let li = null;
    document.querySelectorAll("#ingesta-sheet-list li").forEach((x) => { if (x.dataset.hoja === hoja) li = x; });
    return li;
  };

  const nf = (x) => Number(x).toLocaleString("es-CO");

  // Avance intra-hoja (ej. BDP_datos_mes por chunk): línea temporal "cargando…"
  if (ev.tipo === "avance") {
    const li = findLi(ev.hoja); if (!li) return;
    const kids = li.querySelector(".ingesta-children"); if (!kids) return;
    let prog = kids.querySelector(".ingesta-avance");
    if (!prog) {
      prog = document.createElement("div");
      prog.className = "ingesta-avance text-primary";
      kids.appendChild(prog);
    }
    prog.textContent = `⏳ Preparando para análisis… ${nf(ev.filas)} filas`;
    return;
  }

  if (ev.tipo === "hoja" && ev.estado === "ok") {
    const li = findLi(ev.hoja); if (!li) return;
    const ic = li.querySelector(".ingesta-ic"); if (ic) ic.classList.remove("is-pending");
    const kids = li.querySelector(".ingesta-children"); if (!kids) return;
    const esCore = String(ev.tabla || "").startsWith("fact_");
    const filasTxt = (typeof ev.filas === "number") ? ` · ${nf(ev.filas)} filas` : "";

    if (!esCore) {
      // 🗄️ Respaldo (Bronze) — llega para toda hoja; el contador cuenta SOLO este paso
      if (!li.dataset.contado) {
        li.dataset.contado = "1";
        window.__ingestaDone = (window.__ingestaDone || 0) + 1;
        if (counter && window.__ingestaTotal) counter.textContent = `${window.__ingestaDone} / ${window.__ingestaTotal}`;
      }
      if (!kids.querySelector(".ig-respaldo")) {
        const r = document.createElement("div");
        r.className = "ig-respaldo ingesta-respaldo";
        r.innerHTML = `<i class="bi bi-archive"></i><span>Respaldo</span>` +
          (typeof ev.filas === "number" ? `<span class="ig-badge ig-badge--gray">${nf(ev.filas)} filas</span>` : "");
        kids.appendChild(r);
      }
    } else {
      // Core: quitar "cargando…" temporal
      const p = kids.querySelector(".ingesta-avance"); if (p) p.remove();
      if (Array.isArray(ev.tablas) && ev.tablas.length) {
        // badge "N tablas" en la cabecera de la hoja
        const cnt = li.querySelector(".ig-sheet__count");
        if (cnt) { cnt.textContent = `${ev.tablas.length} tablas`; cnt.style.display = ""; }
        if (!kids.querySelector(".ig-group")) {
          const g = document.createElement("li");
          g.className = "ig-group is-open";
          g.innerHTML = `<div class="ig-group__hd" onclick="window.igToggleGroup(this)">
              <i class="bi bi-chevron-right ig-chev"></i><i class="bi bi-diagram-3"></i>
              <span>Para análisis</span>
              <span class="ig-badge ig-badge--gray">${ev.tablas.length} tablas</span></div>
            <div class="ig-group__kids"></div>`;
          const kk = g.querySelector(".ig-group__kids");
          ev.tablas.forEach((t) => {
            const tag = String(t.tabla_label || "").replace(/^Tabla\s*\d+\s*\(?|\)?$/g, "").trim();
            const b = document.createElement("button");
            b.type = "button";
            b.className = "ig-trow";
            b.dataset.tablaIdx = t.tabla_idx;
            b.innerHTML = `<i class="bi bi-table"></i>
              <span class="ig-trow__name">${t.tabla_label}</span>` +
              (tag ? `<span class="ig-trow__tag">· ${tag}</span>` : "") +
              `<span class="ig-badge ig-badge--gray">${nf(t.filas)} filas</span>`;
            b.addEventListener("click", (e) => {
              e.preventDefault();
              window.igSelectTable(b, li);
              window.verTablaHoja(ev.reporte_id, ev.hoja, t.tabla_idx, t.tabla_label);
            });
            kk.appendChild(b);
          });
          kids.appendChild(g);
        }
      } else if (!kids.querySelector(`.ig-destino[data-tabla="${ev.tabla}"]`)) {
        const a = document.createElement("div");
        a.className = "ig-destino ingesta-analisis";
        a.dataset.tabla = ev.tabla;
        a.innerHTML = `<span class="ig-dot"></span><span>RAW →</span>
          <code class="ig-code">${ev.tabla}</code>` +
          (typeof ev.filas === "number" ? `<span class="ig-badge ig-badge--green">${nf(ev.filas)} filas</span>` : "");
        kids.appendChild(a);
      }
    }
  }
};

window.verTablaHoja = async function verTablaHoja(reporteId, hoja, tablaIdx, label) {
  const area = document.getElementById("charts-display-area");
  const titleEl = document.getElementById("analytics-panel-title");
  const empty = document.getElementById("analytics-empty-state");
  if (titleEl) titleEl.textContent = `${hoja} — ${label}`;
  if (empty) empty.style.display = "none";
  if (!area) return;
  area.style.display = "block";
  area.innerHTML = '<div class="d-flex align-items-center gap-2 p-3"><div class="spinner-border spinner-border-sm"></div> Cargando tabla…</div>';
  try {
    const url = `/api/tablas-hoja/datos?reporte_id=${encodeURIComponent(reporteId)}&hoja=${encodeURIComponent(hoja)}&tabla_idx=${encodeURIComponent(tablaIdx)}`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) { area.innerHTML = `<div class="alert alert-danger m-3">Error: ${data.error || data.detail || r.status}</div>`; return; }
    window.renderTablaAncha(area, data, `${hoja} — ${label}`);
  } catch (e) {
    area.innerHTML = `<div class="alert alert-danger m-3">Fallo de red: ${e}</div>`;
  }
};

window.renderTablaAncha = function renderTablaAncha(area, data, titulo) {
  const esMatriz = data.modo === "matriz";
  const esTexto = data.modo === "texto";          // COMENTARIOS: celdas de texto, sin formato numérico
  const dims = data.dimensiones || [];
  const meses = data.meses || [];
  const _total = (typeof data.total_filas === "number") ? data.total_filas : (data.filas || []).length;
  const _capped = _total > (data.filas || []).length;
  const _nf = (n) => Number(n).toLocaleString("es-CO");
  if (data.vacia || !(data.filas || []).length) {
    area.innerHTML = `<div class="ig-dt"><div class="ig-dt__title"><i class="bi bi-table"></i><h6>${titulo}</h6></div>
      <div class="p-3 text-muted">Sin datos para esta tabla en este archivo.</div></div>`;
    return;
  }
  const _iso = (esMatriz || esTexto) ? [] : meses;
  const _mensual = new Set(_iso.map((m) => m.slice(0, 7))).size === _iso.length;
  const fmtCol = (v) => { if (esMatriz || esTexto) return v; const [y, m, d] = v.split("-"); return _mensual ? `${m}/${y.slice(2)}` : `${d}/${m}`; };
  const fmtNum = (v) => Number(v).toLocaleString("es-CO", { maximumFractionDigits: 1 });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dimCols = dims.length ? dims : ["campo"];       // una columna por dimensión
  const rowKey = (f) => dimCols.map((d) => (f.dims || {})[d]).filter((x) => x != null).join(" · ") || "—";
  const isTotal = (lbl) => /^(total|p50 objetivo|objetivo)/i.test(lbl);

  let head = `<tr>`;
  dimCols.forEach((d, i) => {
    head += `<th class="${i === 0 ? "corner" : "dimcol"}">${esc(String(d).toUpperCase())}</th>`;
  });
  meses.forEach((m) => (head += `<th class="col">${fmtCol(m)}</th>`));
  head += `</tr>`;
  let body = "";
  (data.filas || []).forEach((f) => {
    const key = rowKey(f);
    const tot = isTotal(key);
    body += `<tr class="${tot ? "total" : ""}" data-name="${key.toLowerCase()}">`;
    dimCols.forEach((d, i) => {
      const raw = (f.dims || {})[d];
      const txt = (raw == null || raw === "") ? "" : esc(String(raw));
      body += i === 0
        ? `<th class="rowlabel" scope="row">${tot ? '<i class="bi bi-sigma"></i> ' : ""}${txt || "—"}</th>`
        : `<td class="dimval">${txt || "·"}</td>`;
    });
    (f.valores || []).forEach((v) => {
      if (esTexto) body += (v == null || v === "")
        ? `<td class="empty" aria-label="sin dato">·</td>`
        : `<td class="ig-txt" style="white-space:normal;min-width:240px;max-width:560px;text-align:left">${esc(v)}</td>`;
      else if (v == null) body += `<td class="empty" aria-label="sin dato">·</td>`;
      else if (v === 0) body += `<td class="zero">—</td>`;
      else body += `<td>${fmtNum(v)}</td>`;
    });
    body += `</tr>`;
  });

  area.innerHTML = `
    <div class="ig-dt" id="ig-dt">
      <div class="ig-dt__title"><i class="bi bi-table"></i><h6>${titulo}</h6>
        <span class="ig-dt__count">${_nf(data.filas.length)}${_capped ? ` de ${_nf(_total)}` : ""} filas × ${meses.length} ${(esMatriz || esTexto) ? "columnas" : "meses"}</span></div>
      <div class="ig-dt__toolbar">
        <div class="ig-search"><i class="bi bi-search"></i>
          <input type="text" placeholder="Buscar fila…" oninput="window.igSearch(this.value)"></div>
        <div class="ig-dt__tools">
          <span class="lbl">Densidad</span>
          <div class="ig-seg"><button class="is-active" onclick="window.igDensity(false,this)">Cómoda</button>
            <button onclick="window.igDensity(true,this)">Compacta</button></div>
          <button class="ig-btn" onclick="window.igExportCSV()"><i class="bi bi-download"></i> Exportar</button>
        </div>
      </div>
      <div class="ig-dt__scroll"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>
      <div class="ig-dt__foot"><span id="ig-visible">${data.filas.length}</span>&nbsp;filas visibles${_capped ? ` · <strong>mostrando las primeras ${_nf(data.filas.length)} de ${_nf(_total)}</strong> (límite del visor; la base guarda todo)` : ""}
        <span><span class="ig-foot__hatch"></span> = sin dato</span><span>— = cero</span>
        <span class="ig-foot__right"><i class="bi bi-arrow-left-right"></i> Desplaza para ver los ${meses.length} ${(esMatriz || esTexto) ? "columnas" : "meses"} · 1ª columna fija</span></div>
    </div>`;
  window.__igTable = { dimCols, cols: meses.map(fmtCol), filas: data.filas, titulo };
};

class ChatManager {
  constructor() {
    this.socket = null;
    this.currentConversationId = null;
    this.isConnected = false;
    this.eventListenersSetup = false;
    this.lastPanel1Data = []; // Store Panel 1 data for Panel 2 statistics
    this.pendingFollowupButtons = null; // Store followup buttons to render in chat
    this.pendingCategorizedButtons = null; // Store categorized buttons for pills UI
    this.fixedReportInFlight = false;
    this.fixedReportIdInFlight = null;
    this.dailyReportLocked = false;
    this.robustezMode = false;

    // Don't initialize immediately, wait for DOM
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    console.log("ChatManager initializing...");
    this.initializeSocket();
    this.setupEventListeners();
    this.setupAutoScroll();
    console.log("ChatManager initialized");
  }

  setDailyReportMode(enabled) {
    this.dailyReportLocked = Boolean(enabled);
    if (enabled) this.robustezMode = false;
  }

  setRobustezMode(enabled) {
    this.robustezMode = Boolean(enabled);
    if (enabled) this.dailyReportLocked = false;
  }

  initializeSocket() {
    // Socket.IO connection with robust reconnection
    const socketConfig = {
      transports: ["polling", "websocket"],
      upgrade: true,
      rememberUpgrade: false,
      timeout: 20000,
      forceNew: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
      path: "/socket.io/",
      autoConnect: true,
      withCredentials: true,
    };

    console.log("Initializing Socket.IO with config:", socketConfig);

    try {
      this.socket = io(socketConfig);
    } catch (err) {
      console.error("Socket.IO initialization failed:", err);
      this.isConnected = false;
      this.updateConnectionStatus(false);
      return;
    }

    this.socket.on("connect", () => {
      this.isConnected = true;
      console.log("Connected to chat server (id:", this.socket.id, ")");
      this.updateConnectionStatus(true);
    });

    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;
      console.log("Disconnected from chat server, reason:", reason);
      this.updateConnectionStatus(false);
      // If server disconnected us, force a new connection attempt
      if (reason === "io server disconnect") {
        this.socket.connect();
      }
    });

    this.socket.on("reconnect", (attemptNumber) => {
      console.log("Reconnected to chat server after", attemptNumber, "attempts");
      this.isConnected = true;
      this.updateConnectionStatus(true);
    });

    this.socket.on("reconnect_error", (error) => {
      console.error("Reconnection attempt failed:", error.message || error);
    });

    this.socket.on("reconnect_failed", () => {
      console.error("All reconnection attempts exhausted");
      this.updateConnectionStatus(false);
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error.message || error);
      this.updateConnectionStatus(false);
    });

    this.socket.on("status", (data) => {
      console.log("Status:", data.msg);
    });

    // Reconnect when tab becomes visible again
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !this.isConnected) {
        console.log("Tab visible again, attempting reconnect...");
        this.socket.connect();
      }
    });

    this.socket.on("new_message", (data) => {
      console.log("📩 ========== NEW_MESSAGE EVENT ==========");
      console.log("📩 Full data object:", JSON.stringify(data, null, 2));
      console.log("📩 Data keys:", Object.keys(data));
      console.log("📩 Role:", data.role);
      console.log("📩 Has followup_buttons?", !!data.followup_buttons);
      console.log("📩 Has chart_buttons?", !!data.chart_buttons);
      console.log("📩 Has panel_data?", !!data.panel_data);

      // Check multiple possible locations for followup buttons
      let buttonsFound = null;

      // Location 1: Direct followup_buttons
      if (data.followup_buttons && data.followup_buttons.length > 0) {
        buttonsFound = data.followup_buttons;
        console.log(
          "✅ Found followup_buttons in data.followup_buttons:",
          buttonsFound.length
        );
      }

      // Location 2: chart_buttons (alternative name)
      else if (data.chart_buttons && data.chart_buttons.length > 0) {
        buttonsFound = data.chart_buttons;
        console.log(
          "✅ Found buttons in data.chart_buttons:",
          buttonsFound.length
        );
      }

      // Location 3: Inside panel_data
      else if (
        data.panel_data &&
        data.panel_data.panel_2 &&
        data.panel_data.panel_2.chart_buttons
      ) {
        buttonsFound = data.panel_data.panel_2.chart_buttons;
        console.log(
          "✅ Found buttons in data.panel_data.panel_2.chart_buttons:",
          buttonsFound.length
        );
      }

      if (buttonsFound) {
        this.pendingFollowupButtons = buttonsFound;
        console.log("✅ Stored pending buttons:", this.pendingFollowupButtons);
      } else {
        console.log("⚠️ NO BUTTONS FOUND in any location");
      }

      // Store categorized buttons if present
      this.pendingCategorizedButtons =
        data.categorized_buttons ||
        (data.panel_data && data.panel_data.panel_2 && data.panel_data.panel_2.categorized_buttons) ||
        null;

      this.addMessageToChat(data);

      // Only hide typing indicator when receiving assistant messages (responses)
      if (data.role === "assistant") {
        console.log("📩 Received assistant response, hiding typing indicator");
        this.hideTypingIndicator();
      } else {
        console.log(
          "👤 User message processed, keeping typing indicator visible"
        );
      }
      console.log("📩 ========================================");
    });

    // Capture panel_2_update and ADD buttons to the last assistant message retroactively
    this.socket.on("panel_2_update", (data) => {
      console.log("🔔 ========== PANEL_2_UPDATE EVENT ==========");
      console.log("🔔 Full data object:", JSON.stringify(data, null, 2));
      console.log("🔔 Data keys:", Object.keys(data));
      console.log("🔔 panel_type:", data.panel_type);
      console.log("🔔 Has chart_buttons?", !!data.chart_buttons);

      // Add buttons to the LAST assistant message (since it arrives after the message)
      if (data.chart_buttons && data.chart_buttons.length > 0) {
        console.log(
          "✅ Found",
          data.chart_buttons.length,
          "buttons, adding to last assistant message"
        );
        console.log(
          "✅ Buttons preview:",
          data.chart_buttons.map((b) => b.title)
        );

        // Find the last assistant message in the DOM
        const chatMessages = document.getElementById("chat-messages");
        if (chatMessages) {
          const assistantMessages =
            chatMessages.querySelectorAll(".message-assistant");
          const lastAssistantMessage =
            assistantMessages[assistantMessages.length - 1];

          if (lastAssistantMessage) {
            console.log(
              "✅ Found last assistant message, checking if buttons already exist"
            );

            // Check if buttons already exist
            const existingButtons = lastAssistantMessage.querySelector(
              ".followup-buttons-section"
            );
            if (existingButtons) {
              console.log("⚠️ Buttons already exist, skipping");
            } else {
              // Create and append buttons
              const followupSection = this.createFollowupButtonsSection(
                data.chart_buttons,
                null,
                data.categorized_buttons || null
              );
              const messageText =
                lastAssistantMessage.querySelector(".message-text");

              if (messageText) {
                messageText.appendChild(followupSection);
                console.log("✅✅✅ BUTTONS ADDED TO LAST ASSISTANT MESSAGE!");

                // Scroll to show the new buttons
                this.scrollToBottom();
              } else {
                console.error(
                  "❌ Could not find .message-text in last assistant message"
                );
              }
            }
          } else {
            console.error("❌ No assistant messages found in chat");
          }
        } else {
          console.error("❌ Chat messages container not found");
        }
      } else {
        console.log("⚠️ No chart_buttons found in panel_2_update");
      }
      console.log("🔔 ===========================================");
    });

    this.socket.on("panel_3_update", (data) => {
      console.log("🔔 Panel 3 update received:", data);
      console.log("🔍 Checking data.success:", data.success);
      console.log(
        "🔘 Dynamic buttons count:",
        data.dynamic_buttons ? data.dynamic_buttons.length : 0
      );
      this.updatePanel3Content(data);
    });

    this.socket.on("processing_stage", (data) => {
      console.log("Processing stage:", data);
      // Add minimum delay between processing stages for better visibility
      setTimeout(() => {
        this.updateProcessingStage(data.stage);
        this.updateProcessingProgress(data.progress);
      }, 100); // Small delay to ensure smooth animation
    });

    this.socket.on("error", (data) => {
      console.error("❌ Chat error:", data.msg);
      window.app?.showToast(data.msg, "error");
      this.hideTypingIndicator();
    });
  }

  setupEventListeners() {
    if (this.eventListenersSetup) return;

    console.log("Setting up chat event listeners...");

    // Send button click
    const sendBtn = document.getElementById("send-btn");
    console.log("Send button found:", !!sendBtn);

    if (sendBtn) {
      sendBtn.addEventListener("click", (e) => {
        console.log("Send button clicked via event listener");
        e.preventDefault();
        e.stopPropagation();
        this.sendMessage();
      });
    }

    // Enter key in input
    const messageInput = document.getElementById("message-input");
    console.log("Message input found:", !!messageInput);

    if (messageInput) {
      messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          console.log("Enter key pressed in input");
          e.preventDefault();
          this.sendMessage();
        }
      });

      messageInput.addEventListener("input", (e) => {
        this.autoResizeTextarea(e.target);
      });
    }

    // New conversation in new tab button
    const newConvTabBtn = document.getElementById("new-conversation-tab-btn");
    console.log("New conversation tab button found:", !!newConvTabBtn);

    if (newConvTabBtn) {
      newConvTabBtn.addEventListener("click", async (e) => {
        console.log("New conversation in new tab button clicked");
        e.preventDefault();
        e.stopPropagation();

        try {
          const response = await fetch("/new_conversation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const data = await response.json();

          if (data.success) {
            // Open new tab with the conversation
            window.open(`/?conversation=${data.conversation_id}`, "_blank");
            console.log(
              "✅ Opened new conversation in new tab:",
              data.conversation_id
            );
          } else {
            console.error("❌ Failed to create new conversation");
            window.app?.showToast("Error al crear conversación", "error");
          }
        } catch (error) {
          console.error("Error creating new conversation:", error);
          window.app?.showToast("Error de conexión", "error");
        }
      });
    }

    this.eventListenersSetup = true;
    console.log("Event listeners setup complete");
  }

  setupAutoScroll() {
    const chatMessages = document.getElementById("chat-messages");
    if (chatMessages) {
      // Create observer to auto-scroll when new messages are added
      const observer = new MutationObserver(() => {
        this.scrollToBottom();
      });

      observer.observe(chatMessages, {
        childList: true,
        subtree: true,
      });
    }
  }

  setCurrentConversation(conversationId) {
    this.currentConversationId = conversationId;
    console.log("Current conversation set to:", conversationId);
  }

  async sendMessage() {
    console.log("SendMessage called");

    // Hide chat banner when sending first message
    const chatBanner = document.querySelector(".chat-banner");
    if (chatBanner) {
      chatBanner.style.display = "none";
    }

    const messageInput = document.getElementById("message-input");
    const message = messageInput?.value.trim();

    console.log("Send message details:", {
      message: message,
      currentConversationId: this.currentConversationId,
      isConnected: this.isConnected,
    });

    // Check for blocking conditions
    if (!message) {
      console.log("Send blocked: No message");
      window.app?.showToast("Escribe un mensaje", "warning");
      return;
    }

    if (!this.currentConversationId) {
      console.log("No conversation selected, creating new one...");
      // Create new conversation automatically
      this.createNewConversationForMessage(message);
      return;
    }

    if (!this.isConnected) {
      console.log("Send blocked: Not connected to server");
      window.app?.showToast("Reconectando al servidor...", "warning");
      // Try to reconnect and restore input
      if (this.socket) this.socket.connect();
      if (messageInput) messageInput.value = message;
      return;
    }

    console.log("Sending message:", message);

    // Clear input
    messageInput.value = "";
    this.autoResizeTextarea(messageInput);

    // Show typing indicator
    this.showTypingIndicator();

    // Send message via WebSocket (server will broadcast back to all clients)
    this.socket.emit("send_message", {
      conversation_id: this.currentConversationId,
      message: message,
      report_mode: this.dailyReportLocked ? "daily_performance" : this.robustezMode ? "robustez" : undefined,
    });

    console.log("Message sent via WebSocket");
  }

  async createNewConversationForMessage(message) {
    console.log("Creating new conversation for message:", message);

    try {
      const response = await fetch("/new_conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        // Set the new conversation as current
        this.setCurrentConversation(data.conversation_id);

        // Update UI to show new conversation is active
        if (window.app) {
          window.app.updateConversationUI(data.conversation_id);
        }

        // Add new conversation to sidebar
        this.addConversationToSidebar(data.conversation_id, data.title);

        // Now send the original message
        this.sendMessageToConversation(message);

        console.log("New conversation created and message sent");
      } else {
        throw new Error(data.error || "Failed to create conversation");
      }
    } catch (error) {
      console.error("Error creating new conversation:", error);
      window.app?.showToast("Error al crear conversación", "error");
    }
  }

  sendMessageToConversation(message) {
    console.log("Sending message to current conversation:", message);

    // Clear input first
    const messageInput = document.getElementById("message-input");
    if (messageInput) {
      messageInput.value = "";
      this.autoResizeTextarea(messageInput);
    }

    // Show typing indicator
    this.showTypingIndicator();

    // Send message via WebSocket (server will broadcast back to all clients)
    this.socket.emit("send_message", {
      conversation_id: this.currentConversationId,
      message: message,
      report_mode: this.dailyReportLocked ? "daily_performance" : this.robustezMode ? "robustez" : undefined,
    });

    console.log("Message sent to conversation:", this.currentConversationId);
  }

  addConversationToSidebar(conversationId, title) {
    const conversationsList = document.getElementById("conversations-list");
    if (!conversationsList) return;

    // Remove "No hay conversaciones" message if exists
    const noConversations = conversationsList.querySelector(".text-muted");
    if (noConversations) {
      noConversations.remove();
    }

    // Create new conversation element
    const conversationDiv = document.createElement("div");
    conversationDiv.className = "conversation-item";
    conversationDiv.dataset.id = conversationId;

    const displayTitle =
      title.length > 25 ? title.substring(0, 25) + "..." : title;

    conversationDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <button class="btn btn-sm conversation-btn flex-grow-1 text-start btn-secondary"
                        data-id="${conversationId}">
                    <i class="fas fa-comment me-2"></i>
                    ${displayTitle}
                </button>
                <button class="btn btn-sm btn-outline-danger ms-2 delete-conv-btn" 
                        data-id="${conversationId}" 
                        data-title="${title}"
                        title="Eliminar conversación">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

    // Add event listeners to the new buttons
    const convBtn = conversationDiv.querySelector(".conversation-btn");
    const deleteBtn = conversationDiv.querySelector(".delete-conv-btn");

    convBtn.addEventListener("click", () => {
      if (window.app) {
        window.app.selectConversation(conversationId);
      }
    });

    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.app) {
        window.app.showDeleteConfirmation(conversationId, title);
      }
    });

    // Insert at the top of the list
    conversationsList.insertBefore(
      conversationDiv,
      conversationsList.firstChild
    );
  }

  addMessageToChat(messageData, fixedButton = null) {
    // Hide welcome section when first message is added
    const welcomeSection = document.querySelector(".chat-welcome-section");
    if (welcomeSection) {
      welcomeSection.style.display = "none";
    }

    // Show chat input (hidden on main page)
    const chatInput4 = document.querySelector(".chat-input-container");
    if (chatInput4) chatInput4.style.display = "";

    // Hide chat banner when first message is added
    const chatBanner = document.querySelector(".chat-banner");
    if (chatBanner) {
      chatBanner.style.display = "none";
    }

    const chatMessages = document.getElementById("chat-messages");
    if (!chatMessages) return;

    // Show chat messages container if hidden
    if (chatMessages.style.display === "none") {
      chatMessages.style.display = "block";
      chatMessages.classList.remove("empty-chat");
      chatMessages.classList.add("has-content");
    }

    // Remove welcome message if it exists
    const welcomeMessage = chatMessages.querySelector(".welcome-message");
    if (welcomeMessage) {
      welcomeMessage.remove();
    }

    // Update CSS classes for proper scroll management
    chatMessages.classList.remove("empty-chat");
    chatMessages.classList.add("has-content");

    // Create message element
    const messageElement = this.createMessageElement(messageData);

    // Add to chat
    chatMessages.appendChild(messageElement);

    // Add pending followup buttons if this is an assistant message
    if (messageData.role === "assistant") {
      console.log(
        "🔍 Checking for pending followup buttons:",
        this.pendingFollowupButtons
      );
      console.log("🔍 Fixed button provided:", fixedButton);
      console.log("🔍 Message metadata:", messageData.metadata);

      // Combine fixed button with dynamic buttons
      let dynamicButtons =
        this.pendingFollowupButtons && this.pendingFollowupButtons.length > 0
          ? this.pendingFollowupButtons
          : [];

      // PERSISTENCE: Check if we have saved buttons in metadata (for old conversations)
      if (
        dynamicButtons.length === 0 &&
        messageData.metadata?.panel_data?.panel_2?.chart_buttons
      ) {
        dynamicButtons = messageData.metadata.panel_data.panel_2.chart_buttons;
        console.log(
          "📦 Recovered followup buttons from metadata:",
          dynamicButtons.length
        );
      }

      // Recover categorized buttons from metadata if available
      let categorized = this.pendingCategorizedButtons ||
        messageData.metadata?.panel_data?.panel_2?.categorized_buttons ||
        null;

      if (fixedButton || dynamicButtons.length > 0) {
        console.log(
          "✅ Creating followup section with",
          dynamicButtons.length,
          "dynamic buttons"
        );
        const followupSection = this.createFollowupButtonsSection(
          dynamicButtons,
          fixedButton,
          categorized
        );

        // Append to message element's content area
        const messageText = messageElement.querySelector(".message-text");
        if (messageText) {
          messageText.appendChild(followupSection);
          console.log("✅ Followup buttons added to message-text");
        } else {
          messageElement.appendChild(followupSection);
          console.log("✅ Followup buttons added to message element");
        }

        this.pendingFollowupButtons = null; // Clear after use
        this.pendingCategorizedButtons = null; // Clear after use
      } else {
        console.log("⚠️ No followup buttons or fixed button found");
      }
    }

    // Scroll to bottom
    this.scrollToBottom();
  }

  createMessageElement(messageData) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message message-${messageData.role}`;

    const avatar =
      messageData.role === "user"
        ? '<img src="/static/img/user-chat.png" alt="User" class="avatar-img">'
        : '<img src="/static/img/chatbot-for-conversations.png" alt="Assistant" class="avatar-img">';

    const timeFormatted = messageData.timestamp
      ? AppManager.formatTime(messageData.timestamp)
      : "";

    // Check if we have enhanced HTML components from Panel 1
    let messageContent = this.formatMessageContent(messageData.content);

    if (
      messageData.role === "assistant" &&
      messageData.panel_data &&
      messageData.panel_data.panel_1 &&
      messageData.panel_data.panel_1.html_components &&
      messageData.panel_data.panel_1.html_components.length > 0
    ) {
      console.log("📊 Rendering enhanced HTML components for Panel 1");

      // Render HTML components instead of basic content
      const htmlComponents = messageData.panel_data.panel_1.html_components;

      // Build enhanced message with HTML components
      let enhancedContent = '<div class="panel-1-enhanced">';

      // Add basic message content first (if not empty and not a fallback error)
      const isFallbackContent = messageData.content &&
        (messageData.content.includes("No encontré resultados") ||
         messageData.content.includes("Búsqueda completada"));
      if (messageData.content && messageData.content.trim() && !isFallbackContent) {
        enhancedContent += `<div class="message-summary">${this.formatMessageContent(
          messageData.content
        )}</div>`;
      }

      // Add each HTML component
      htmlComponents.forEach((component, index) => {
        if (component.html) {
          enhancedContent += `
            <div class="html-component ${component.component_type || ""}"
                 data-component-type="${component.component_type || "unknown"}"
                 data-priority="${component.priority || 0}">
              ${component.html}
            </div>
          `;
        }
      });

      enhancedContent += "</div>";
      messageContent = enhancedContent;

      console.log(`✅ Rendered ${htmlComponents.length} HTML components`);
    }

    messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-avatar">
                    ${avatar}
                </div>
                <div class="message-text">
                    ${messageContent}
                </div>
            </div>
            <div class="message-time">
                ${timeFormatted}
            </div>
        `;

    return messageDiv;
  }

  formatMessageContent(content) {
    if (!content) return "<em>Sin respuesta disponible</em>";

    // Check if content is already HTML (contains div tags)
    if (content.includes("<div") || content.includes("<table")) {
      // Content is already formatted HTML, return as-is
      return content;
    }

    // Enhanced markdown formatting with tables
    let formatted = content;

    // Process markdown tables
    formatted = this.processMarkdownTables(formatted);

    // Basic markdown formatting
    formatted = formatted
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/^- (.*$)/gim, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
      .replace(/\n/g, "<br>");

    return formatted;
  }

  processMarkdownTables(content) {
    // Split content into lines
    const lines = content.split("\n");
    let result = [];
    let inTable = false;
    let tableRows = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this is a table header line (contains |)
      if (line.includes("|") && line.startsWith("|") && line.endsWith("|")) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        tableRows.push(line);
      }
      // Check if this is a table separator line (|-----|-----|)
      else if (line.match(/^\|[\s\-\|]+\|$/)) {
        // This is a separator, continue collecting table rows
        continue;
      } else {
        // Not a table line
        if (inTable) {
          // End of table, process it
          result.push(this.buildHtmlTable(tableRows));
          tableRows = [];
          inTable = false;
        }
        result.push(line);
      }
    }

    // Handle case where table is at the end
    if (inTable && tableRows.length > 0) {
      result.push(this.buildHtmlTable(tableRows));
    }

    return result.join("\n");
  }

  buildHtmlTable(tableRows) {
    if (tableRows.length === 0) return "";

    // Extract and store table data for Panel 2 statistics
    this.extractAndStoreTableData(tableRows);

    let html = '<table class="table table-sm table-striped mt-2 mb-2">';

    // First row is header
    if (tableRows.length > 0) {
      html += "<thead><tr>";
      const headerCells = tableRows[0].split("|").slice(1, -1); // Remove empty first/last
      headerCells.forEach((cell) => {
        html += `<th>${cell.trim()}</th>`;
      });
      html += "</tr></thead>";
    }

    // Remaining rows are data
    if (tableRows.length > 1) {
      html += "<tbody>";
      for (let i = 1; i < tableRows.length; i++) {
        html += "<tr>";
        const cells = tableRows[i].split("|").slice(1, -1); // Remove empty first/last
        cells.forEach((cell) => {
          html += `<td>${cell.trim()}</td>`;
        });
        html += "</tr>";
      }
      html += "</tbody>";
    }

    html += "</table>";
    return html;
  }

  createExpandableFixedButton(fixedButton) {
    const buttonId = fixedButton.id || "fixed_report_production";

    let html = `
      <div class="fixed-report-container mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-teal text-white fw-bold py-2">
            <i class="${fixedButton.icon || "fas fa-chart-bar"} me-2"></i>
            ${fixedButton.title}
          </div>
          <div class="card-body p-2">
    `;

    // Add report options as stacked buttons
    fixedButton.options.forEach((option) => {
      const iconClass = option.enabled
        ? "fas fa-check-circle text-success"
        : "fas fa-circle text-muted";
      const buttonClass = option.enabled
        ? "btn-outline-success"
        : "btn-outline-secondary";
      const disabledAttr = option.enabled ? "" : "disabled";

      const optionHtml = `
        <button class="btn ${buttonClass} btn-sm w-100 mb-2 text-start d-flex align-items-center justify-content-between ${
        disabledAttr ? "disabled" : ""
      }"
                ${disabledAttr}
                data-fixed-report="1"
                data-fixed-report-id="${option.id}"
                ${
                  option.enabled
                    ? `onclick="window.ChatManager.loadFixedReport('${
                        option.id
                      }', ${JSON.stringify(option.action_data).replace(
                        /"/g,
                        "&quot;"
                      )})"`
                    : ""
                }>
          <span>
            <i class="${iconClass} me-2"></i>
            ${option.title}
          </span>
          ${option.enabled ? '<i class="fas fa-chevron-right"></i>' : ""}
        </button>
      `;

      html += optionHtml;
    });

    html += `
          </div>
        </div>
      </div>
    `;

    return html;
  }

  toggleFixedReportOptions(optionsId) {
    const optionsDiv = document.getElementById(optionsId);
    const button = optionsDiv?.previousElementSibling;
    const icon = button?.querySelector(".toggle-icon");

    if (optionsDiv && optionsDiv.classList.contains("collapsed")) {
      optionsDiv.classList.remove("collapsed");
      optionsDiv.classList.add("expanded");
      if (icon) {
        icon.classList.remove("fa-chevron-down");
        icon.classList.add("fa-chevron-up");
      }
    } else if (optionsDiv) {
      optionsDiv.classList.remove("expanded");
      optionsDiv.classList.add("collapsed");
      if (icon) {
        icon.classList.remove("fa-chevron-up");
        icon.classList.add("fa-chevron-down");
      }
    }
  }

  async loadFixedReport(reportId, actionData) {
    console.log(`Loading fixed report: ${reportId}`, actionData);

    if (this.fixedReportInFlight) {
      console.warn(
        `Fixed report already loading (${this.fixedReportIdInFlight}). Ignoring new request: ${reportId}`
      );
    }

    this.fixedReportInFlight = true;
    this.fixedReportIdInFlight = reportId;
    if (reportId !== "daily_performance") {
      this.dailyReportLocked = false;
    }

    try {
      const chartsArea = document.getElementById("charts-display-area");
      const emptyState = document.getElementById("analytics-empty-state");

      if (chartsArea) {
        chartsArea.innerHTML = "";
      }

      if (emptyState) emptyState.style.display = "none";
      if (chartsArea) {
        chartsArea.style.display = "block";
        chartsArea.innerHTML = `
          <div class="text-center p-4">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-2">Generando reporte...</p>
          </div>
        `;
      }

      // Disable fixed report buttons while loading
      document
        .querySelectorAll('button[data-fixed-report="1"]')
        .forEach((btn) => {
          btn.disabled = true;
          btn.classList.add("disabled");
        });

      const requestBody = {
        report_id: reportId,
        report_type: actionData?.report_type,
        chart_type: actionData?.chart_type,
      };

      const fetchWithTimeout = async (timeoutMs) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
        try {
          return await fetch("/api/generate_fixed_report", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      };

      let response;
      let attempt = 0;
      const maxAttempts = 2;
      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          response = await fetchWithTimeout(180000);
          break;
        } catch (err) {
          if (attempt >= maxAttempts) throw err;
          console.warn(`Retrying fixed report fetch (attempt ${attempt + 1})`, err);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }

      const result = await response.json();
      console.log("Fixed report result:", result);

      if (!result.success) {
        throw new Error(result.error || "Failed to generate report");
      }

      if (reportId === "daily_performance") {
        this.dailyReportLocked = true;
      }

      if (result.chart_type === "production_monthly_balance") {
        // 🆕 USO DE NUEVOS MÓDULOS - Reporte de balance mensual con tabs
        if (typeof MonthlyBalanceReport !== "undefined") {
          console.log("📊 Usando MonthlyBalanceReport con tabs");
          console.log("📦 Datos del backend para Balance Mensual:", {
            hasChartData: !!result.chart_data,
            hasSummaryTable: !!result.summary_table,
            hasAnalysisTable: !!result.analysis_table,
            hasProductionTypesTable: !!result.production_types_table,
            hasDistributionRelative: !!result.distribution_relative,
            hasConclusion: !!result.conclusion_integrada,
            hasProgrammedAnalysisTable: !!result.programmed_analysis_table,
            hasProgrammedBlancosTable: !!result.programmed_blancos_table,
            resultKeys: Object.keys(result),
          });

          const reporter = new MonthlyBalanceReport();
          reporter.renderWithTabs(chartsArea, {
            chartData: result.chart_data,
            summaryTable: result.summary_table,
            analysisTable: result.analysis_table,
            productionTypesTable: result.production_types_table,
            programmedAnalysisTable:
              result.programmed_analysis_table || result.programmedAnalysisTable || null,
            programmedBlancosTable:
              result.programmed_blancos_table || result.programmedBlancosTable || null,
            popVsRealTable:
              result.pop_vs_real_table || result.popVsRealTable || null,
            popBlancosVsRealTable:
              result.pop_blancos_vs_real_table ||
              result.popBlancosVsRealTable ||
              null,
            maps: result.maps || result.mapData || null,
            distributionRelative:
              result.distribution_relative || result.distributionRelative || null,
            conclusionIntegrated:
              result.conclusion_integrada || result.conclusionIntegrated || null,
          });
        } else if (window.monthlyBalanceRenderer?.renderMonthlyBalanceReport) {
          // LEGACY: Fallback al renderer antiguo
          console.warn("⚠️ Usando monthlyBalanceRenderer legacy");
          window.monthlyBalanceRenderer.renderMonthlyBalanceReport(
            chartsArea,
            result
          );
        } else if (window.renderMonthlyBalanceReport) {
          console.warn("⚠️ Usando renderMonthlyBalanceReport legacy");
          window.renderMonthlyBalanceReport(chartsArea, result);
        } else {
          console.warn(
            "Monthly balance renderer not found; falling back to default renderer."
          );
          if (result.chart_data) {
            this.renderProductionChart(
              result.chart_data,
              chartsArea,
              result.summary_table,
              result.deferred_summary_table,
              result.analysis_table,
              result.production_types_table,
              result.programmed_analysis_table,
              result.programmed_blancos_table,
              result.chart_type,
              result.maps || result.mapData || null
            );
          } else if (chartsArea) {
            chartsArea.innerHTML = "";
          }
        }
      } else if (result.chart_data) {
        this.renderProductionChart(
          result.chart_data,
          chartsArea,
          result.summary_table,
          result.deferred_summary_table,
          result.analysis_table,
          result.production_types_table,
          result.programmed_analysis_table,
          result.programmed_blancos_table,
          result.chart_type,
          result.maps || result.mapData || null
        );
      } else {
        throw new Error("Report payload missing chart data");
      }

      console.log("Fixed report loaded successfully");
      if (result.summary_table) {
        console.log(
          "Summary table included with",
          result.summary_table.rows?.length || 0,
          "rows"
        );
      }
    } catch (error) {
      const isAbort =
        error && (error.name === "AbortError" || error.message?.includes("aborted"));
      console.error("Error loading fixed report:", error);
      if (reportId === "daily_performance") {
        this.dailyReportLocked = false;
      }
      const chartsArea = document.getElementById("charts-display-area");
      if (chartsArea) {
        chartsArea.innerHTML = `
          <div class="alert alert-danger m-3">
            <i class="fas fa-exclamation-triangle"></i>
            Error al cargar el reporte: ${
              isAbort
                ? "Tiempo de espera agotado. El reporte tomó demasiado. Intenta de nuevo."
                : error.message
            }
          </div>
        `;
      }
    } finally {
      this.fixedReportInFlight = false;
      this.fixedReportIdInFlight = null;
      document
        .querySelectorAll('button[data-fixed-report="1"]')
        .forEach((btn) => {
          btn.disabled = false;
          btn.classList.remove("disabled");
        });
    }
  }

  renderProductionChart(
    chartData,
    container,
    summaryTable = null,
    deferredSummaryTable = null,
    analysisTable = null,
    productionTypesTable = null,
    programmedAnalysisTable = null,
    programmedBlancosTable = null,
    chartType = "production_daily_performance",
    maps = null
  ) {
    console.log("Rendering production chart with Plotly:", chartData);
    console.log("Summary table data:", summaryTable);
    console.log("Deferred summary table data:", deferredSummaryTable);
    console.log("Analysis table data:", analysisTable);
    console.log("Production types table data:", productionTypesTable);
    console.log("Programmed analysis table data:", programmedAnalysisTable);
    console.log("Programmed blancos table data:", programmedBlancosTable);

    if (typeof Plotly === "undefined" && typeof window.ensurePlotlyLoaded === "function") {
      window.ensurePlotlyLoaded().then((loaded) => {
        if (loaded && typeof Plotly !== "undefined") {
          this.renderProductionChart(
            chartData,
            container,
            summaryTable,
            deferredSummaryTable,
            analysisTable,
            productionTypesTable,
            programmedAnalysisTable,
            programmedBlancosTable,
            chartType,
            maps
          );
        } else if (container) {
          container.innerHTML = `
            <div class="alert alert-danger m-3">
              <i class="fas fa-exclamation-triangle"></i>
              Plotly no está cargado
            </div>
          `;
        }
      });
    }

    // 🆕 USO DE NUEVOS MÓDULOS - Reporte con tabs
    if (
      chartType === "production_daily_performance" &&
      typeof DailyPerformanceReport !== "undefined"
    ) {
      console.log("📊 Usando DailyPerformanceReport con tabs");

      const reporter = new DailyPerformanceReport();
      reporter.renderWithTabs(container, {
        chartData: chartData,
        deferredTable: deferredSummaryTable,
        summaryTable: summaryTable,
        analysisTable: analysisTable,
        productionTypesTable: productionTypesTable,
        programmedAnalysisTable: programmedAnalysisTable,
        programmedBlancosTable: programmedBlancosTable,
        maps: maps || null,
      });

      return; // Salir temprano, el reporte ya está renderizado con tabs
    }

    // LEGACY: Renderizado antiguo (fallback si los módulos no están disponibles)
    console.warn(
      "⚠️ Usando renderizado legacy (DailyPerformanceReport no disponible)"
    );
    container.innerHTML = "";

    // Create chart card
    const chartCard = document.createElement("div");
    chartCard.className = "card mb-3";
    chartCard.innerHTML = `
      <div class="card-header bg-light">
        <h6 class="mb-0">
          <i class="fas fa-chart-line"></i>
          ${chartData.title || "Panorama de Producción (Diario)"}
        </h6>
      </div>
      <div class="card-body">
        <div id="production-chart-row" style="display: flex; gap: 1px; align-items: stretch; width: 100%;">
          <div id="production-daily-chart" style="flex: 1 1 auto; min-width: 0; height: 500px;"></div>
          <div id="production-daily-bars" style="flex: 0 0 160px; max-width: 180px; height: 500px;"></div>
        </div>
      </div>
    `;
    container.appendChild(chartCard);

    // Side bar chart data (static for now)
    const barLabels = ["P50", "Reto 747k", "Proyeccion Sept"];
    const barValues = [749500, 755700, 750100];

    // Compute shared Y range for both charts
    const combinedValues = [...barValues];
    if (Array.isArray(chartData?.traces)) {
      chartData.traces.forEach((trace) => {
        if (Array.isArray(trace?.y)) {
          trace.y.forEach((val) => {
            if (val === null || val === undefined) {
              return;
            }
            const num = typeof val === "number" ? val : Number(val);
            if (!Number.isNaN(num) && Number.isFinite(num)) {
              combinedValues.push(num);
            }
          });
        }
      });
    }

    let minY = Math.min(...combinedValues);
    let maxY = Math.max(...combinedValues);
    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
      minY = 0;
      maxY = 1;
    }

    const span = maxY - minY;
    const padding =
      span === 0 ? Math.max(Math.abs(maxY) || 1, 1) * 0.05 : span * 0.05;
    minY -= padding;
    maxY += padding;

    // Forzar rango fijo 700k - 775k
    const lowerBound = 700000;
    const upperBound = 775000;
    minY = lowerBound;
    maxY = upperBound;
    const sharedRange = [minY, maxY];

    chartData.layout = {
      ...(chartData.layout || {}),
      autosize: true,
      margin: {
        l: 60,
        r: 30,
        t: 60,
        b: 50,
      },
      yaxis: {
        ...((chartData.layout && chartData.layout.yaxis) || {}),
        autorange: false,
        range: sharedRange,
        tickmode: "array",
        tickvals: [700000, 725000, 750000, 775000],
        ticktext: ["700k", "725k", "750k", "775k"],
      },
    };

    // Render Plotly chart
    const chartElement = document.getElementById("production-daily-chart");

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d"],
    };

    // Verificar si hay frames para animación
    if (chartData.frames && chartData.frames.length > 0) {
      const numFrames = chartData.frames.length;
      const frameDuration = Math.max(40, Math.floor(4000 / numFrames));

      console.log(`🎬 Creando gráfico animado:`);
      console.log(`   - Total frames: ${numFrames}`);
      console.log(`   - Duración por frame: ${frameDuration}ms`);
      console.log(
        `   - Duración total: ~${((frameDuration * numFrames) / 1000).toFixed(
          1
        )}s`
      );

      // Inicializar con el primer frame
      const initialData = chartData.frames[0].data;
      console.log(`   - Primer frame data points:`, initialData[0]?.x?.length);

      Plotly.newPlot(chartElement, initialData, chartData.layout, config)
        .then(() => {
          console.log(
            "✅ Plot creado, iniciando animación con Plotly.react()..."
          );

          // Reproducir animación frame por frame usando Plotly.react()
          return new Promise((resolve) => {
            let currentFrame = 0;

            const animateNextFrame = () => {
              if (currentFrame < numFrames) {
                // Log cada 10 frames
                if (currentFrame % 10 === 0) {
                  console.log(`   📍 Frame ${currentFrame + 1}/${numFrames}`);
                }

                // Usar Plotly.react para actualizar los datos
                const frameData = chartData.frames[currentFrame].data;

                Plotly.react(chartElement, frameData, chartData.layout, config);

                currentFrame++;
                setTimeout(animateNextFrame, frameDuration);
              } else {
                console.log("✅ Animación completada exitosamente");
                resolve();
              }
            };

            // Iniciar animación después de un pequeño delay
            setTimeout(animateNextFrame, 100);
          });
        })
        .then(() => {
          // Notify panel manager to resize charts after rendering
          if (window.panelManager && window.panelManager.resizePlotlyCharts) {
            setTimeout(() => {
              window.panelManager.resizePlotlyCharts();
            }, 100);
          }
        })
        .catch((error) => {
          console.error("❌ Error en animación:", error);
          console.error("Stack:", error.stack);
          // Si falla, mostrar datos completos
          console.warn("⚠️ Fallback: mostrando gráfico completo sin animación");
          Plotly.newPlot(
            chartElement,
            chartData.traces,
            chartData.layout,
            config
          ).then(() => {
            console.log(
              "✅ Production chart rendered successfully (fallback)!"
            );
            if (window.panelManager && window.panelManager.resizePlotlyCharts) {
              setTimeout(() => {
                window.panelManager.resizePlotlyCharts();
              }, 100);
            }
          });
        });
    } else {
      // Sin frames, renderizado normal
      console.log("ℹ️ Sin frames, renderizado normal");
      Plotly.newPlot(chartElement, chartData.traces, chartData.layout, config)
        .then(() => {
          console.log("✅ Production chart rendered successfully!");

          // Notify panel manager to resize charts after rendering
          if (window.panelManager && window.panelManager.resizePlotlyCharts) {
            setTimeout(() => {
              window.panelManager.resizePlotlyCharts();
            }, 100);
          }
        })
        .catch((err) => {
          console.error("❌ Error rendering chart:", err);
          chartElement.innerHTML = `
            <div class="alert alert-danger m-3">
              <i class="fas fa-exclamation-triangle"></i>
              Error al renderizar el gráfico: ${err.message}
            </div>
          `;
        });
    }

    // Renderizar barra lateral después de la animación
    setTimeout(() => {
      // Render side bar chart on the right
      const barsEl = document.getElementById("production-daily-bars");
      if (barsEl) {
        const barTrace = {
          type: "bar",
          x: barLabels,
          y: barValues,
          marker: { color: ["#FF5F00", "#CCD32A", "#00214D"] },
          text: ["749.5k", "755.7k", "750.1k"],
          textposition: "outside",
          hovertemplate: "%{x}: %{y:.1f}k<extra></extra>",
        };
        const barLayout = {
          margin: { l: 10, r: 10, t: 30, b: 50 },
          yaxis: { visible: false, range: sharedRange },
          xaxis: {
            tickfont: { size: 12 },
            showgrid: false,
            zeroline: false,
          },
          plot_bgcolor: "#FAFAFA",
          paper_bgcolor: "white",
        };
        const barConfig = { displayModeBar: false, responsive: true };
        Plotly.newPlot(barsEl, [barTrace], barLayout, barConfig);
      }
    }, 100);

    if (
      deferredSummaryTable &&
      Array.isArray(deferredSummaryTable.rows) &&
      deferredSummaryTable.rows.length > 0
    ) {
      const deferredCard = this.createDeferredSummaryCard(deferredSummaryTable);
      container.appendChild(deferredCard);
    }

    // Render summary table if provided
    if (summaryTable && summaryTable.rows && summaryTable.rows.length > 0) {
      console.log(
        "📋 Rendering summary table with",
        summaryTable.rows.length,
        "rows"
      );
      const tableCard = this.createSummaryTableCard(summaryTable);
      container.appendChild(tableCard);
    }

    // Create a container for both analysis cards
    if (chartType === "production_daily_performance") {
      const analysisContainer = document.createElement("div");
      analysisContainer.style.display = "flex";
      analysisContainer.style.gap = "1rem";
      analysisContainer.style.marginTop = "1rem";
      analysisContainer.style.flexWrap = "wrap";

      const analysisCard = this.createAnalysisGerenciaCard(analysisTable);
      analysisCard.style.flex = "1 1 45%";
      analysisCard.style.minWidth = "300px";

      const productionTypesCard =
        this.createProductionTypesCard(productionTypesTable);
      productionTypesCard.style.flex = "1 1 45%";
      productionTypesCard.style.minWidth = "300px";

      analysisContainer.appendChild(analysisCard);
      analysisContainer.appendChild(productionTypesCard);
      container.appendChild(analysisContainer);
    }
  }

  // ✂️ REMOVED: createDeferredSummaryCard - Moved to ReportCardFactory in reportCards.js
  createDeferredSummaryCard(tableData) {
    // Delegate to ReportCardFactory
    return ReportCardFactory.createDeferredSummaryCard(tableData);
  }

  // ✂️ REMOVED: createSummaryTableCard - Moved to ReportCardFactory in reportCards.js
  createSummaryTableCard(summaryTable) {
    // Delegate to ReportCardFactory
    return ReportCardFactory.createSummaryTableCard(summaryTable);
  }

  // DEPRECATED - Old implementation kept for reference (will be removed later)
  _createSummaryTableCard_LEGACY(summaryTable) {
    // Create card container
    const card = document.createElement("div");
    card.className = "card mb-3";

    // Create card header
    const cardHeader = document.createElement("div");
    cardHeader.className = "card-header bg-light";
    cardHeader.innerHTML = `
      <h6 class="mb-0">
        <i class="fas fa-table"></i>
        ${summaryTable.title || "Resumen Mes"}
      </h6>
    `;
    card.appendChild(cardHeader);

    // Create card body
    const cardBody = document.createElement("div");
    cardBody.className = "card-body p-0";
    // Allow horizontal scroll if table is wider
    cardBody.style.overflowX = "auto";
    // Stack table and analysis vertically
    cardBody.style.display = "flex";
    cardBody.style.flexDirection = "column";
    cardBody.style.justifyContent = "flex-start";
    cardBody.style.alignItems = "center";
    // Ensure some height so vertical spacing remains
    cardBody.style.minHeight = "260px";

    // Create table
    const table = document.createElement("table");
    table.className = "table table-striped table-bordered table-sm mb-0";
    table.style.fontSize = "0.85rem";

    // Create thead
    const thead = document.createElement("thead");
    //thead.className = 'table-primary';
    thead.style.backgroundColor = "#004236";
    thead.style.color = "#F7DB17";
    const headerRow = document.createElement("tr");

    summaryTable.headers.forEach((header) => {
      const th = document.createElement("th");
      th.className = "text-center align-middle fw-bold";
      th.style.padding = "0.5rem";
      th.style.color = "#F7DB17";
      th.style.backgroundColor = "transparent";
      th.innerHTML = header.label;
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create tbody
    const tbody = document.createElement("tbody");

    summaryTable.rows.forEach((row) => {
      const tr = document.createElement("tr");

      // Apply row styling and alignment rules by Segmento
      let centerAllCells = false;
      if (row.Segmento === "ECP SA" || row.Segmento === "Filiales") {
        // Remove background color, force white and center cells
        tr.className = "";
        tr.style.backgroundColor = "#FFFFFF";
        centerAllCells = true;
      } else if (row.Segmento === "GE Vs Meta") {
        // Keep highlight but center cells
        tr.className = "table-success fw-bold";
        centerAllCells = true;
      }

      summaryTable.headers.forEach((header) => {
        const td = document.createElement("td");
        const value = row[header.key];

        // Format value
        let displayValue;
        if (value === null || value === undefined) {
          displayValue = "-";
        } else if (typeof value === "number") {
          displayValue = value.toLocaleString("es-ES", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          });
        } else {
          displayValue = String(value);
        }

        td.textContent = displayValue;
        td.style.padding = "0.5rem";

        const isVariationColumn = (() => {
          const key = (header.key || "").toLowerCase();
          const label = (header.label || "").toLowerCase();
          return (
            key.startsWith("var") ||
            key.includes("var_") ||
            label.includes("var")
          );
        })();

        if (
          isVariationColumn &&
          value !== null &&
          value !== undefined &&
          value !== "-"
        ) {
          let numericValue = null;
          if (typeof value === "number") {
            numericValue = value;
          } else if (typeof value === "string" && value.trim() !== "") {
            const normalized = value
              .replace(/\s+/g, "")
              .replace(/\./g, "")
              .replace(",", ".");
            const parsed = Number(normalized);
            numericValue = Number.isFinite(parsed) ? parsed : null;
          }

          if (numericValue !== null) {
            if (numericValue < 0) {
              td.style.color = "#CC2E10";
            } else if (numericValue > 0) {
              td.style.color = "#004236";
            }
          }
        }

        // Apply alignment
        if (centerAllCells) {
          td.className = "text-center";
        } else if (header.key === "Segmento") {
          td.className = "text-start fw-semibold";
        } else {
          td.className = "text-end";
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    // Wrap table to control width, keep it centered, and round corners
    const tableWrapper = document.createElement("div");
    tableWrapper.style.display = "block";
    tableWrapper.style.width = "90%";
    tableWrapper.style.maxWidth = "90%";
    // Rounded corners and clip inner borders to the radius
    tableWrapper.style.borderRadius = "8px";
    tableWrapper.style.overflow = "hidden";
    // Make table fill the wrapper horizontally
    table.style.width = "100%";
    // Help border-radius work nicely with table borders
    table.style.borderCollapse = "separate";
    table.style.borderSpacing = "0";
    tableWrapper.appendChild(table);
    cardBody.appendChild(tableWrapper);

    if (summaryTable.analysis_markdown) {
      const analysisSection = document.createElement("div");
      analysisSection.className = "summary-analysis-markdown";
      analysisSection.style.width = "90%";
      analysisSection.style.maxWidth = "90%";
      analysisSection.style.margin = "1.5rem 0";
      analysisSection.style.textAlign = "left";
      analysisSection.innerHTML = this.formatMessageContent(
        summaryTable.analysis_markdown
      );
      cardBody.appendChild(analysisSection);
    }

    card.appendChild(cardBody);

    const chartsData = summaryTable.charts || {};
    const plotlyAvailable = typeof Plotly !== "undefined";

    if (chartsData.bar) {
      const barContainer = document.createElement("div");
      barContainer.className = "summary-bar-chart";
      barContainer.style.width = "90%";
      barContainer.style.maxWidth = "90%";
      barContainer.style.minHeight = "320px";
      barContainer.style.margin = summaryTable.analysis_markdown
        ? "0 0 1.5rem"
        : "1.5rem 0";
      cardBody.appendChild(barContainer);

      if (plotlyAvailable) {
        const barX = Array.isArray(chartsData.bar.x) ? chartsData.bar.x : [];
        const barSeries = Array.isArray(chartsData.bar.series)
          ? chartsData.bar.series
          : [];

        const barTraces = barSeries
          .filter(
            (serie) =>
              serie &&
              Array.isArray(serie.values) &&
              serie.values.some(
                (value) => value !== null && value !== undefined
              )
          )
          .map((serie) => {
            const yValues = serie.values.map((value) => {
              if (value === null || value === undefined) {
                return null;
              }
              const numericValue =
                typeof value === "number" ? value : Number(value);
              return Number.isFinite(numericValue) ? numericValue : null;
            });
            return {
              type: "bar",
              x: barX,
              y: yValues,
              name: serie.name || "Serie",
              hovertemplate:
                "<b>%{x}</b><br>" +
                `${serie.name || "Valor"}: %{y:.1f}<extra></extra>`,
            };
          });

        if (barTraces.length > 0) {
          const barLayout = {
            barmode: "group",
            margin: { l: 50, r: 20, t: 40, b: 60 },
            legend: { orientation: "h", x: 0, y: -0.25 },
            plot_bgcolor: "rgba(0,0,0,0)",
            paper_bgcolor: "rgba(0,0,0,0)",
            xaxis: { tickfont: { size: 12 } },
            yaxis: {
              tickformat: ",.1f",
              zeroline: true,
              zerolinecolor: "#CCCCCC",
            },
          };
          const barConfig = { responsive: true, displayModeBar: false };
          requestAnimationFrame(() => {
            Plotly.newPlot(barContainer, barTraces, barLayout, barConfig);
            Plotly.Plots.resize(barContainer).catch(() => {});
          });
        } else {
          barContainer.textContent =
            "No hay datos disponibles para el gráfico de barras.";
          barContainer.classList.add("text-muted", "text-center", "py-3");
        }
      } else {
        console.warn(
          "Plotly no está disponible para renderizar el gráfico de barras de Resumen Mes."
        );
        barContainer.textContent =
          "Gráfico de barras no disponible (Plotly no cargado).";
        barContainer.classList.add("text-muted", "text-center", "py-3");
      }
    }

    if (chartsData.radar) {
      const radarContainer = document.createElement("div");
      radarContainer.className = "summary-radar-chart";
      radarContainer.style.width = "90%";
      radarContainer.style.maxWidth = "90%";
      radarContainer.style.minHeight = "360px";
      radarContainer.style.margin = "0 0 1.5rem";
      cardBody.appendChild(radarContainer);

      if (plotlyAvailable) {
        const categories = Array.isArray(chartsData.radar.categories)
          ? chartsData.radar.categories
          : [];
        const radarSeries = Array.isArray(chartsData.radar.series)
          ? chartsData.radar.series
          : [];

        const radarTraces = radarSeries
          .filter(
            (serie) =>
              serie &&
              Array.isArray(serie.values) &&
              serie.values.some(
                (value) => value !== null && value !== undefined
              )
          )
          .map((serie) => {
            const baseValues = serie.values.map((value) => {
              if (value === null || value === undefined) {
                return 0;
              }
              const numericValue =
                typeof value === "number" ? value : Number(value);
              return Number.isFinite(numericValue) ? numericValue : 0;
            });
            const closedValues = [
              ...baseValues,
              baseValues.length > 0 ? baseValues[0] : 0,
            ];
            const closedCategories =
              categories.length > 0 ? [...categories, categories[0]] : [];

            return {
              type: "scatterpolar",
              r: closedValues,
              theta: closedCategories,
              fill: "toself",
              name: serie.name || "Serie",
              hovertemplate:
                "<b>%{theta}</b><br>" +
                `${serie.name || "Valor"}: %{r:.1f}<extra></extra>`,
            };
          });

        if (radarTraces.length > 0) {
          const radarLayout = {
            margin: { l: 40, r: 40, t: 40, b: 40 },
            legend: { orientation: "h", x: 0, y: -0.2 },
            plot_bgcolor: "rgba(0,0,0,0)",
            paper_bgcolor: "rgba(0,0,0,0)",
            polar: {
              radialaxis: {
                visible: true,
                tickformat: ",.1f",
                gridcolor: "#E0E0E0",
              },
              angularaxis: {
                tickfont: { size: 11 },
                gridcolor: "#E0E0E0",
              },
            },
          };
          const radarConfig = { responsive: true, displayModeBar: false };
          requestAnimationFrame(() => {
            Plotly.newPlot(
              radarContainer,
              radarTraces,
              radarLayout,
              radarConfig
            );
            Plotly.Plots.resize(radarContainer).catch(() => {});
          });
        } else {
          radarContainer.textContent =
            "No hay datos disponibles para el gráfico radar.";
          radarContainer.classList.add("text-muted", "text-center", "py-3");
        }
      } else {
        console.warn(
          "Plotly no está disponible para renderizar el gráfico radar de Resumen Mes."
        );
        radarContainer.textContent =
          "Gráfico radar no disponible (Plotly no cargado).";
        radarContainer.classList.add("text-muted", "text-center", "py-3");
      }
    }

    return card;
  }

  // ✂️ DELEGATED: createProductionTypesCard - Delegates to ReportCardFactory
  createProductionTypesCard(productionTypesTable) {
    return ReportCardFactory.createProductionTypesCard(productionTypesTable);
  }

  // ✂️ DELEGATED: createAnalysisGerenciaCard - Delegates to ReportCardFactory
  createAnalysisGerenciaCard(analysisTable) {
    return ReportCardFactory.createAnalysisGerenciaCard(analysisTable);
  }

  createFollowupButtonsSection(buttons, fixedButton = null, categorizedButtons = null) {
    const section = document.createElement("div");
    section.className = "followup-buttons-section mt-3";

    let html = `
      <div class="followup-header mb-2">
        <small>
          <i class="fas fa-chart-bar me-1"></i>
          Te gustaría profundizar un poco más!. Da click a las siguientes opciones.
        </small>
      </div>
    `;

    // Fixed production report button first if provided
    if (fixedButton && fixedButton.expandable) {
      html += this.createExpandableFixedButton(fixedButton);
    }

    if (categorizedButtons && categorizedButtons.categories) {
      // === Categorized pills + sub-buttons ===
      html += this._renderCategorizedButtons(categorizedButtons);
    } else {
      // === Legacy: flat button grid ===
      html += this._renderFlatButtons(buttons);
    }

    section.innerHTML = html;

    // Add click handlers for category pills
    if (categorizedButtons) {
      this._setupCategoryPillHandlers(section);
    }

    // Add click handlers for chart buttons (both flat and categorized)
    this._setupChartButtonHandlers(section);

    return section;
  }

  _renderCategorizedButtons(categorized) {
    const { categories } = categorized;

    // Find first enabled category (auto-select it)
    const firstEnabled = categories.find(c => c.enabled);
    const activeId = firstEnabled ? firstEnabled.id : null;

    // Pills row
    let html = `<div class="category-pills-row">`;
    categories.forEach(cat => {
      const isActive = cat.id === activeId;
      const disabledClass = !cat.enabled ? "disabled" : "";
      const activeClass = isActive ? "active" : "";
      html += `
        <button class="category-pill ${activeClass} ${disabledClass}"
                data-category-id="${cat.id}"
                ${!cat.enabled ? "disabled" : ""}>
          <i class="fas fa-${cat.icon} me-1"></i>${cat.label}
        </button>
      `;
    });
    html += `</div>`;

    // Sub-buttons panels (one per enabled category, only active is visible)
    categories.forEach(cat => {
      if (!cat.enabled) return;
      const isActive = cat.id === activeId;
      html += `
        <div class="category-panel ${isActive ? "active" : ""}"
             data-category-panel="${cat.id}">
          <div class="followup-buttons-grid">
      `;
      cat.buttons.forEach((button, index) => {
        const iconClass = this.getChartIcon(button.chart_type);
        const escapedConfig = JSON.stringify(button)
          .replace(/'/g, "&apos;")
          .replace(/"/g, "&quot;");
        html += `
          <button class="btn btn-sm btn-outline-primary followup-chart-btn"
                  data-button-config="${escapedConfig}"
                  data-button-index="${index}">
            <i class="fas fa-${iconClass} me-2"></i>
            ${button.title}
          </button>
        `;
      });
      html += `</div></div>`;
    });

    return html;
  }

  _renderFlatButtons(buttons) {
    let html = `<div class="followup-buttons-grid">`;
    buttons.forEach((button, index) => {
      const iconClass = this.getChartIcon(button.chart_type);
      const escapedConfig = JSON.stringify(button)
        .replace(/'/g, "&apos;")
        .replace(/"/g, "&quot;");
      html += `
        <button class="btn btn-sm btn-outline-primary followup-chart-btn mb-2"
                data-button-config="${escapedConfig}"
                data-button-index="${index}">
          <i class="fas fa-${iconClass} me-2"></i>
          ${button.title}
        </button>
      `;
    });
    html += `</div>`;
    return html;
  }

  _setupCategoryPillHandlers(section) {
    section.querySelectorAll(".category-pill:not([disabled])").forEach(pill => {
      pill.addEventListener("click", () => {
        const catId = pill.dataset.categoryId;
        // Deactivate all pills and panels
        section.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
        section.querySelectorAll(".category-panel").forEach(p => p.classList.remove("active"));
        // Activate clicked
        pill.classList.add("active");
        const panel = section.querySelector(`[data-category-panel="${catId}"]`);
        if (panel) panel.classList.add("active");
      });
    });
  }

  _setupChartButtonHandlers(section) {
    section.querySelectorAll(".followup-chart-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (btn.disabled) return;

        const unescapedConfig = btn.dataset.buttonConfig
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        const buttonConfig = JSON.parse(unescapedConfig);

        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>Generando...`;

        try {
          await this.generateChartFromButton(buttonConfig);
          btn.classList.remove("btn-outline-primary");
          btn.classList.add("btn-success");
          btn.innerHTML = `<i class="fas fa-check me-2"></i>${buttonConfig.title}`;
        } catch (error) {
          console.error("Error generating chart:", error);
          btn.disabled = false;
          btn.classList.add("btn-outline-danger");
          btn.innerHTML = `<i class="fas fa-times me-2"></i>Error`;
        }
      });
    });
  }

  extractAndStoreTableData(tableRows) {
    if (tableRows.length < 2) {
      this.lastPanel1Data = [];
    }

    try {
      // Get headers
      const headers = tableRows[0]
        .split("|")
        .slice(1, -1)
        .map((h) => h.trim());

      // Convert rows to objects
      const dataObjects = [];
      for (let i = 1; i < tableRows.length; i++) {
        const cells = tableRows[i]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        const rowObject = {};

        headers.forEach((header, index) => {
          if (index < cells.length) {
            // Try to parse as number, otherwise keep as string
            const cellValue = cells[index];
            const numValue = parseFloat(cellValue.replace(/,/g, ""));
            rowObject[header] = !isNaN(numValue) ? numValue : cellValue;
          }
        });

        dataObjects.push(rowObject);
      }

      this.lastPanel1Data = dataObjects;
      console.log(
        "Panel 1 data stored for statistics:",
        this.lastPanel1Data.length,
        "rows"
      );
    } catch (error) {
      console.error("Error extracting table data:", error);
      this.lastPanel1Data = [];
    }
  }

  showTypingIndicator() {
    console.log("🔄 Showing typing indicator...");

    // Hide welcome section if it's visible
    const welcomeSection = document.querySelector(".chat-welcome-section");
    if (welcomeSection && welcomeSection.style.display !== "none") {
      console.log("🙋 Hiding welcome section");
      welcomeSection.style.display = "none";
    }

    // Show chat input (hidden on main page)
    const chatInput5 = document.querySelector(".chat-input-container");
    if (chatInput5) chatInput5.style.display = "";

    // Hide banner if it's visible
    const chatBanner = document.querySelector(".chat-banner");
    if (chatBanner && chatBanner.style.display !== "none") {
      console.log("🏷️ Hiding chat banner");
      chatBanner.style.display = "none";
    }

    // Show simple loading message
    this.addLoadingMessage();

    // Fallback timeout to hide loading if no response (extended for longer processing)
    this.loadingTimeout = setTimeout(() => {
      console.warn(
        "⏰ Loading timeout reached - hiding indicators after 60 seconds"
      );
      this.hideTypingIndicator();
    }, 60000); // 60 second timeout for complex queries
  }

  addLoadingMessage() {
    console.log("🔄 Adding loading message...");

    const chatMessages = document.getElementById("chat-messages");
    if (!chatMessages) {
      console.error("❌ chat-messages element not found!");
    }

    console.log("✅ Found chat-messages element");
    console.log("📊 Current chatMessages display:", chatMessages.style.display);
    console.log("📊 Current chatMessages classes:", chatMessages.className);

    // Make sure chat messages area is visible
    chatMessages.style.display = "block";
    chatMessages.classList.remove("empty-chat");
    chatMessages.classList.add("has-content");

    console.log("✅ Updated chatMessages display:", chatMessages.style.display);
    console.log("✅ Updated chatMessages classes:", chatMessages.className);

    // Remove any existing loading message
    const existingLoader = chatMessages.querySelector(".loading-message");
    if (existingLoader) {
      console.log("🗑️ Removing existing loading message");
      existingLoader.remove();
    }

    const loadingDiv = document.createElement("div");
    loadingDiv.className = "message message-assistant loading-message";
    loadingDiv.innerHTML = `
      <div class="message-content">
        <div class="message-avatar">
          <img src="/static/img/chatbot-for-conversations.png" alt="Assistant" class="avatar-img">
        </div>
        <div class="message-text">
          <div class="simple-loading">
            <span class="loading-text">Pensando...</span>
            <div class="typing-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </div>
          </div>
        </div>
      </div>
    `;

    console.log("➕ Appending loading message to chat");
    console.log(
      "📋 Loading div HTML:",
      loadingDiv.outerHTML.substring(0, 200) + "..."
    );

    chatMessages.appendChild(loadingDiv);

    // Force visibility and trigger animation
    setTimeout(() => {
      loadingDiv.style.opacity = "1";
      loadingDiv.style.visibility = "visible";
      console.log("🎯 Forced visibility on loading message");
    }, 10);

    console.log("✅ Loading message added to DOM");
    console.log("📊 Total messages in chat:", chatMessages.children.length);
    console.log(
      "📊 Loading message visible?:",
      window.getComputedStyle(loadingDiv).display !== "none"
    );
    console.log(
      "📊 Loading message opacity:",
      window.getComputedStyle(loadingDiv).opacity
    );

    this.scrollToBottom();
  }

  updateProcessingStage(message, stage = 0) {
    // Update both old and new processing indicators
    const processingText = document.querySelector(".processing-text");
    if (processingText) {
      processingText.textContent = message;
    }

    const processingStatus = document.querySelector(".processing-status");
    if (processingStatus) {
      processingStatus.textContent = `🤖 ${message}`;
    }

    // Update stage indicators
    this.updateStageIndicators(stage);
  }

  updateStageIndicators(currentStage) {
    const indicators = document.querySelectorAll(".stage-indicator");
    indicators.forEach((indicator, index) => {
      const stageNum = index + 1;

      // Reset classes
      indicator.classList.remove("active", "completed");

      if (stageNum < currentStage) {
        indicator.classList.add("completed");
      } else if (stageNum === currentStage) {
        indicator.classList.add("active");
      }
    });
  }

  updateProcessingProgress(progress) {
    // Update progress bar in loading message
    const progressBar = document.getElementById("processing-progress");
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
      progressBar.setAttribute("aria-valuenow", progress);
    }

    // Update stage based on progress
    const stage = Math.ceil(progress / 20); // 5 stages, each 20%
    this.updateStageIndicators(stage);
  }

  hideTypingIndicator() {
    console.log("🛑 Hiding typing indicator...");

    // Clear any pending loading timeout
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
      console.log("⏰ Cleared loading timeout");
    }

    const indicator = document.getElementById("typing-indicator");
    if (indicator) {
      indicator.style.display = "none";
    }

    // Remove loading message
    const loadingMessage = document.querySelector(".loading-message");
    if (loadingMessage) {
      loadingMessage.remove();
      console.log("✅ Loading message removed");
    }

    // Hide panel loading states with error handling
    try {
      this.hidePanelLoading("database");
      this.hidePanelLoading("analytics");
    } catch (error) {
      console.warn("Error hiding panel loading states:", error);
    }
  }

  showPanelLoading(panelName) {
    const panel = document.getElementById(`${panelName}-panel`);
    if (panel) {
      panel.classList.add("panel-loading");
    }
  }

  hidePanelLoading(panelName) {
    const panel = document.getElementById(`${panelName}-panel`);
    if (panel) {
      panel.classList.remove("panel-loading");
    }
  }

  scrollToBottom() {
    const chatMessages = document.getElementById("chat-messages");
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  autoResizeTextarea(input) {
    if (!input) return;

    // For input elements, we don't need auto-resize
    // This method is kept for compatibility but does nothing for input type="text"
    if (input.tagName.toLowerCase() === "textarea") {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 120) + "px";
    }
  }

  updateConnectionStatus(connected) {
    const sendButton = document.getElementById("send-btn");
    const messageInput = document.getElementById("message-input");
    const connectionIcon = document.getElementById("connection-status-icon");
    const connectionText = document.getElementById("connection-status-text");

    if (sendButton) {
      sendButton.disabled = !connected;
      sendButton.innerHTML = connected
        ? '<i class="fas fa-paper-plane"></i>'
        : '<i class="fas fa-exclamation-triangle"></i>';
    }

    if (messageInput && !connected) {
      messageInput.placeholder = "Reconectando...";
    } else if (messageInput) {
      messageInput.placeholder = "Escribe tu mensaje...";
    }

    // Update sidebar connection status
    if (connectionIcon && connectionText) {
      if (connected) {
        connectionIcon.className = "fas fa-wifi text-success";
        connectionText.textContent = "Operativo";
      } else {
        connectionIcon.className = "fas fa-wifi text-danger";
        connectionText.textContent = "Reconectando...";
      }
    }
  }

  // DEPRECATED: Panel 2 removed - followups now render in chat
  updatePanel2Content(data) {
    console.warn(
      "🚫 updatePanel2Content DEPRECATED - Panel 2 has been removed"
    );
    console.log("ℹ️ Followup buttons now render directly in chat messages");
    return; // Early return - function no longer needed

    /* LEGACY CODE - KEPT FOR REFERENCE
    console.log("🔄 Updating Panel 2 with data:", data);
    console.log("🔍 Panel type detected:", data.panel_type);

    const panel2Content = document.querySelector(
      "#database-panel .panel-content"
    );
    if (!panel2Content) {
      console.error("Panel 2 content container not found");
    }

    // Check if this is the new chart buttons panel type
    if (data.panel_type === "chart_buttons") {
      console.log("✅ Using NEW FLOW - Chart buttons in Panel 2");
      this.showChartButtonsInPanel2(data);
    }

    console.log("⚠️ Using OLD FLOW - Traditional Panel 2 content");

    // Check if this is auto-executed analysis
    if (data.auto_executed && data.executive_analyses) {
      this.showExecutiveAnalysisInPanel2(data);
    }

    // Clear existing content
    panel2Content.innerHTML = "";

    // Create followup suggestions section
    const suggestionsSection = document.createElement("div");
    suggestionsSection.className = "followup-suggestions";

    // Add suggestions if available
    const suggestions = data.suggestions || [];
    if (suggestions.length > 0) {
      suggestionsSection.innerHTML = `
        <div class="mb-3">
          <h6><i class="fas fa-lightbulb"></i> Consultas Sugeridas</h6>
          <div class="suggestions-grid">
            ${suggestions
              .map(
                (suggestion) => `
              <button class="btn btn-outline-primary btn-sm suggestion-btn mb-2" 
                      data-suggestion="${suggestion.question}"
                      title="${suggestion.description}">
                <i class="${suggestion.icon || "fas fa-search"}"></i>
                ${suggestion.question}
              </button>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // Add interactive statistics buttons
    const statsButtons = this.createStatisticsButtons(data);
    if (statsButtons) {
      suggestionsSection.appendChild(statsButtons);
    }

    // Add results area for Panel 2 calculations
    const resultsArea = document.createElement("div");
    resultsArea.className = "panel-2-results mt-3";
    resultsArea.id = "panel-2-results";
    resultsArea.style.display = "none";
    suggestionsSection.appendChild(resultsArea);

    // Add insights if available
    const insights = data.insights || [];
    if (insights.length > 0) {
      const insightsSection = document.createElement("div");
      insightsSection.className = "contextual-insights mb-3";
      insightsSection.innerHTML = `
        <h6><i class="fas fa-eye"></i> Insights Contextuales</h6>
        <ul class="list-unstyled">
          ${insights
            .map(
              (insight) =>
                `<li class="small mb-1"><i class="fas fa-dot-circle me-1"></i> ${insight}</li>`
            )
            .join("")}
        </ul>
      `;
      suggestionsSection.appendChild(insightsSection);
    }

    panel2Content.appendChild(suggestionsSection);

    // Add click handlers for suggestion buttons
    panel2Content.querySelectorAll(".suggestion-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const suggestion = btn.dataset.suggestion;
        const messageInput = document.getElementById("message-input");
        if (messageInput) {
          messageInput.value = suggestion;
          messageInput.focus();
        }
      });
    });

    // Ensure panel is visible
    if (window.panelManager) {
      window.panelManager.panels.database.visible = true;
      window.panelManager.updatePanelVisibility("database");
      window.panelManager.updateLayout();
    }
    END OF LEGACY CODE */
  }

  triggerFollowupPanel(messageData) {
    console.log("Triggering followup panel analysis...");

    // Show loading state in Panel 2
    this.showPanel2Loading();

    // Send request to backend for followup analysis
    this.socket.emit("generate_followup", {
      conversation_id: this.currentConversationId,
      message_data: messageData,
      auto_execute: true,
    });
  }

  showPanel2Loading() {
    const panel2Content = document.querySelector(
      "#database-panel .panel-content"
    );
    if (!panel2Content) return;

    panel2Content.innerHTML = `
      <div class="text-center p-4">
        <div class="spinner-border text-success processing-spinner mb-3" role="status"></div>
        <h6 class="loading-text">⚡ Ejecutando análisis automático</h6>
        <p class="text-muted small">Generando estadísticas y insights...</p>
        <div class="processing-stages">
          <div class="stage-indicator active"></div>
          <div class="stage-indicator"></div>
          <div class="stage-indicator"></div>
          <div class="stage-indicator"></div>
        </div>
      </div>
    `;
  }

  showExecutiveAnalysisInPanel2(data) {
    const panel2Content = document.querySelector(
      "#database-panel .panel-content"
    );
    if (!panel2Content) return;

    // Show loading state initially
    panel2Content.innerHTML = `
      <div class="executive-analysis-loading">
        <div class="text-center p-4">
          <div class="spinner-border text-success processing-spinner mb-3" role="status"></div>
          <h6 class="loading-text">🎯 Ejecutando Análisis Automático</h6>
          <p class="text-muted small">Generando insights ejecutivos...</p>
          <div class="processing-stages">
            <div class="stage-indicator active"></div>
            <div class="stage-indicator"></div>
            <div class="stage-indicator"></div>
            <div class="stage-indicator"></div>
          </div>
        </div>
      </div>
    `;

    // Simulate progressive loading of analyses
    setTimeout(() => {
      this.displayExecutiveAnalyses(data, panel2Content);
    }, 800); // Small delay for visual effect
  }

  displayExecutiveAnalyses(data, panel2Content) {
    const analyses = data.executive_analyses || [];
    const insights = data.contextual_insights || [];

    let content = `
      <div class="executive-dashboard">
        <div class="mb-3">
          <h6 class="d-flex align-items-center">
            <i class="fas fa-chart-line text-success me-2"></i>
            Análisis Ejecutivo Automático
            <span class="badge bg-success ms-2">${analyses.length} análisis</span>
          </h6>
          <p class="text-muted small mb-0">Insights generados automáticamente para la toma de decisiones</p>
        </div>
    `;

    // Display each analysis with progressive reveal
    analyses.forEach((analysis, index) => {
      const delay = index * 200; // Stagger the animations

      content += `
        <div class="analysis-card mb-3" style="animation-delay: ${delay}ms">
          <div class="card border-left-success">
            <div class="card-body p-3">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="card-title mb-1">
                  <i class="fas fa-${this.getAnalysisIcon(
                    analysis.type
                  )} text-success me-2"></i>
                  ${analysis.title}
                </h6>
                <span class="badge bg-light text-dark">${
                  analysis.data_count
                } registros</span>
              </div>
              
              <p class="card-text mb-2">${analysis.executive_summary}</p>
              
              ${
                analysis.key_findings && analysis.key_findings.length > 0
                  ? `
                <div class="key-findings">
                  <small class="text-muted d-block mb-1"><strong>Hallazgos Clave:</strong></small>
                  <ul class="list-unstyled small">
                    ${analysis.key_findings
                      .map(
                        (finding) =>
                          `<li class="mb-1"><i class="fas fa-check-circle text-success me-1"></i> ${finding}</li>`
                      )
                      .join("")}
                  </ul>
                </div>
              `
                  : ""
              }
              
              <div class="text-end mt-2">
                <small class="text-muted">
                  <i class="fas fa-clock me-1"></i>
                  ${
                    analysis.execution_time
                      ? `${analysis.execution_time.toFixed(2)}s`
                      : "Completado"
                  }
                </small>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    // Add contextual insights if available
    if (insights.length > 0) {
      content += `
        <div class="contextual-insights mt-3">
          <h6 class="mb-2">
            <i class="fas fa-lightbulb text-warning me-2"></i>
            Insights Contextuales
          </h6>
          <ul class="list-unstyled">
            ${insights
              .map(
                (insight) => `
              <li class="small mb-2 p-2 bg-light rounded">
                <i class="fas fa-arrow-right text-primary me-1"></i>
                ${insight}
              </li>
            `
              )
              .join("")}
          </ul>
        </div>
      `;
    }

    content += "</div>";

    // Animate content replacement
    panel2Content.style.opacity = "0";

    setTimeout(() => {
      panel2Content.innerHTML = content;
      panel2Content.style.opacity = "1";

      // Add reveal animation to analysis cards
      const cards = panel2Content.querySelectorAll(".analysis-card");
      cards.forEach((card, index) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(20px)";

        setTimeout(() => {
          card.style.transition = "all 0.4s ease-out";
          card.style.opacity = "1";
          card.style.transform = "translateY(0)";
        }, index * 150);
      });
    }, 200);
  }

  getAnalysisIcon(analysisType) {
    const iconMap = {
      performance_ranking: "trophy",
      trend_analysis: "chart-line",
      operational_analysis: "cogs",
      efficiency_analysis: "tachometer-alt",
      water_management: "tint",
      data_summary: "chart-bar",
    };

    return iconMap[analysisType] || "chart-bar";
  }

  showChartButtonsInPanel2(data) {
    console.log("🔘 Showing chart buttons in Panel 2:", data);

    const panel2Content = document.querySelector(
      "#database-panel .panel-content"
    );
    if (!panel2Content) {
      console.error("Panel 2 content container not found");
    }

    // Clear existing content
    panel2Content.innerHTML = "";

    if (!data.is_graphable) {
      // Show fallback message for non-graphable data
      panel2Content.innerHTML = `
        <div class="text-center p-4">
          <i class="fas fa-chart-bar fa-3x text-muted mb-3"></i>
          <h6 class="text-muted">Datos No Graficables</h6>
          <p class="text-muted small">${
            data.fallback_message ||
            "Los datos actuales no son apropiados para generar visualizaciones."
          }</p>
        </div>
      `;
    }

    const chartButtons = data.chart_buttons || [];
    if (chartButtons.length === 0) {
      panel2Content.innerHTML = `
        <div class="text-center p-4">
          <i class="fas fa-chart-line fa-2x text-warning mb-3"></i>
          <h6 class="text-warning">Sin Opciones de Gráficos</h6>
          <p class="text-muted small">No se pudieron generar opciones de visualización para estos datos.</p>
        </div>
      `;
    }

    // Create chart buttons section
    let content = `
      <div class="chart-buttons-panel">
        <div class="mb-3">
          <h6 class="d-flex align-items-center">
            <i class="fas fa-chart-bar text-primary me-2"></i>
            Opciones de Visualización
            <span class="badge bg-primary ms-2">${chartButtons.length} gráficos</span>
          </h6>
          <p class="text-muted small mb-0">Selecciona un tipo de gráfico para visualizar los datos</p>
        </div>

        <div class="chart-buttons-grid">
    `;

    // Add each chart button
    chartButtons.forEach((button, index) => {
      const iconClass = this.getChartIcon(button.chart_type);
      // Escape JSON for HTML attribute - replace quotes and encode special chars
      const escapedConfig = JSON.stringify(button)
        .replace(/'/g, "&apos;")
        .replace(/"/g, "&quot;");

      content += `
        <button class="btn btn-outline-primary chart-button mb-2 w-100"
                data-button-config="${escapedConfig}"
                data-button-index="${index}"
                title="${button.description}">
          <div class="d-flex align-items-center">
            <i class="fas fa-${iconClass} me-2"></i>
            <div class="text-start flex-grow-1">
              <div class="fw-bold">${button.title}</div>
              <small class="text-muted">${button.description}</small>
            </div>
            <i class="fas fa-chevron-right ms-2 text-muted"></i>
          </div>
        </button>
      `;
    });

    content += `
        </div>
        
        <div class="mt-3">
          <div class="d-flex justify-content-between align-items-center">
            <small class="text-muted">
              <i class="fas fa-info-circle me-1"></i>
              ${
                data.button_summary ||
                "Haz clic en un botón para generar el gráfico"
              }
            </small>
            <small class="text-muted">
              Calidad: 
              <span class="badge ${
                data.data_quality === "good" ? "bg-success" : "bg-warning"
              }">
                ${data.data_quality === "good" ? "Óptima" : "Limitada"}
              </span>
            </small>
          </div>
        </div>
      </div>
    `;

    panel2Content.innerHTML = content;

    // Add click handlers for chart buttons
    panel2Content.querySelectorAll(".chart-button").forEach((btn) => {
      btn.addEventListener("click", async () => {
        // Prevent multiple clicks
        if (
          btn.disabled ||
          btn.classList.contains("processing") ||
          btn.classList.contains("btn-success")
        ) {
          console.log("🚫 Button already processed or processing");
          return;
        }

        // Unescape HTML entities before parsing JSON
        const unescapedConfig = btn.dataset.buttonConfig
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        const buttonConfig = JSON.parse(unescapedConfig);
        console.log("🎯 Chart button clicked:", buttonConfig.title);

        // Mark button as processing and disable
        btn.disabled = true;
        btn.classList.add("processing");
        btn.innerHTML = `
          <div class="d-flex align-items-center">
            <i class="fas fa-spinner fa-spin me-2"></i>
            <span>Generando ${buttonConfig.title}...</span>
          </div>
        `;

        try {
          // Call the chart generation endpoint
          await this.generateChartFromButton(buttonConfig);

          // Mark button as successful and keep it disabled
          btn.classList.remove("btn-outline-primary", "processing");
          btn.classList.add("btn-success");
          btn.innerHTML = `
            <div class="d-flex align-items-center">
              <i class="fas fa-check me-2"></i>
              <span>${buttonConfig.title} - Creado</span>
            </div>
          `;
          // Keep button disabled to prevent re-clicking
          btn.disabled = true;
        } catch (error) {
          console.error("Error generating chart:", error);

          // Reset button on error (allow retry)
          btn.classList.remove("btn-outline-primary", "processing");
          btn.classList.add("btn-outline-danger");
          btn.innerHTML = `
            <div class="d-flex align-items-center">
              <i class="fas fa-exclamation-triangle me-2"></i>
              <span>Error - Reintentar</span>
            </div>
          `;

          if (window.app?.showToast) {
            window.app.showToast(
              "Error generando gráfico: " + error.message,
              "error"
            );
          }

          // Re-enable button for retry after error
          btn.disabled = false;
        }
      });
    });

    // Ensure panel is visible
    if (window.panelManager) {
      window.panelManager.panels.database.visible = true;
      window.panelManager.updatePanelVisibility("database");
      window.panelManager.updateLayout();
    }
  }

  getChartIcon(chartType) {
    const iconMap = {
      bar: "chart-bar",
      line: "chart-line",
      area: "chart-area",
      scatter: "braille",
      histogram: "chart-column",
      box_plot: "square",
      heatmap: "th",
      pie: "chart-pie",
      dashboard: "tachometer-alt",
      multi_line: "chart-line",
      grouped_bar: "chart-bar",
    };

    return iconMap[chartType] || "chart-bar";
  }

  async generateChartFromButton(buttonConfig) {
    try {
      const response = await fetch("/api/ai/generate_chart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          button_config: buttonConfig,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to generate chart");
      }

      console.log("📊 Chart generated successfully:", result);

      // Update Panel 3 with the chart and followup content
      this.updatePanel3WithChart(result);

      if (window.app?.showToast) {
        window.app.showToast(
          `Gráfico "${buttonConfig.title}" creado exitosamente`,
          "success"
        );
      }
    } catch (error) {
      console.error("Error in generateChartFromButton:", error);
      throw error;
    }
  }

  showProductionReportInChat() {
    console.log("📊 Showing production report options in chat");

    // Create a fixed button structure (hardcoded for now, can be fetched from backend later)
    const fixedButton = {
      id: "fixed_report_production",
      title: "📊 Panorama de Producción",
      type: "expandable",
      expandable: true,
      icon: "fas fa-chart-bar",
      options: [
        {
          id: "daily_performance",
          title: "Panorama de Producción (diario)",
          enabled: true,
          icon: "fas fa-check-circle",
          action_data: {
            report_type: "daily_performance",
            chart_type: "production_daily_performance",
          },
        },
        {
          id: "monthly_balance",
          title: "Balance (mes)",
          enabled: true,
          icon: "fas fa-check-circle",
          action_data: {
            report_type: "monthly_balance",
            chart_type: "production_monthly_balance",
          },
        }
      ],
    };

    // Add an assistant message with the fixed button
    const message = {
      role: "assistant",
      content: "Selecciona una opción del reporte de desempeño de producción:",
      timestamp: new Date().toLocaleTimeString(),
    };

    // Add message to chat with the fixed button
    this.addMessageToChat(message, fixedButton);
  }

  updatePanel3WithChart(chartData) {
    console.log("📊 Updating Panel 3 with chart and content:", chartData);

    // Use the AnalyticsManager to display the chart
    if (window.AnalyticsManager) {
      // First show the analytics section
      window.AnalyticsManager.showAnalytics();

      // Display the chart
      if (chartData.chart_config) {
        const chartId = chartData.chart_config.id;
        window.AnalyticsManager.displayChart(chartData.chart_config);

        // Add followup content after chart renders (small delay)
        setTimeout(() => {
          console.log(
            "📋 Followup content to add:",
            chartData.followup_content
          );
          console.log(
            "📋 Source data for cards:",
            chartData.source_data ? chartData.source_data.length : "null"
          );
          this.addFollowupContentToPanel3(
            chartData.followup_content,
            chartData.source_data,
            chartId
          );

          // Scroll to the newly created chart
          const chartElement = document.getElementById(chartId);
          if (chartElement) {
            chartElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }, 300);
      }
    }

    // Ensure Panel 3 is visible
    if (window.panelManager) {
      window.panelManager.panels.analytics.visible = true;
      window.panelManager.updatePanelVisibility("analytics");
      window.panelManager.updateLayout();
    }
  }

  addFollowupContentToPanel3(
    followupContent,
    sourceData = null,
    chartId = null
  ) {
    console.log("📋 addFollowupContentToPanel3 called with:", followupContent);
    console.log("📋 sourceData:", sourceData ? sourceData.length : "null");
    console.log("📋 chartId:", chartId);
    console.log("📋 storedFollowupContent:", this.storedFollowupContent);

    // Use provided content or stored content
    const contentToUse = followupContent || this.storedFollowupContent;
    console.log("📋 contentToUse:", contentToUse);

    if (!contentToUse || !contentToUse.success) {
      console.log("❌ No valid content to add to Panel 3");
    }

    // Find the specific chart container to add the content to
    let targetContainer;
    if (chartId) {
      // Find the specific chart container by its unique container ID
      targetContainer = document.getElementById(`container-${chartId}`);
      console.log("🎯 Looking for container-${chartId}:", targetContainer);
    }

    // If no specific chart container, use the general charts area
    if (!targetContainer) {
      targetContainer = document.getElementById("charts-display-area");
      if (!targetContainer) {
        console.error("❌ charts-display-area not found");
        return;
      }
    }

    console.log("✅ Found target container");

    // Extract LLM insight HTML from followup content
    const llmInsightHtml = contentToUse ? contentToUse.llm_insight_html : null;

    // Add statistical analysis cards with LLM insight
    this.addStatisticalCardsToPanel3(targetContainer, sourceData, chartId, llmInsightHtml);
  }

  addStatisticalCardsToPanel3(
    targetContainer,
    sourceData = null,
    chartId = null,
    llmInsightHtml = null
  ) {
    console.log("📊 Adding statistical cards to Panel 3");
    console.log(
      "📊 lastPanel1Data:",
      this.lastPanel1Data ? this.lastPanel1Data.length : "null"
    );
    console.log(
      "📊 sourceData param:",
      sourceData ? sourceData.length : "null"
    );
    console.log("🎯 Target container for stats:", targetContainer);
    console.log("🎯 Chart ID for stats:", chartId);

    // Use provided sourceData or fallback to lastPanel1Data
    const dataToUse = sourceData || this.lastPanel1Data;

    if (!dataToUse || !Array.isArray(dataToUse) || dataToUse.length === 0) {
      console.log("⚠️ No data available for statistical analysis");
      console.log("⚠️ Available sources checked: sourceData, lastPanel1Data");
    }

    console.log("✅ Using data for stats:", dataToUse.length, "rows");

    // Create statistical cards container with unique ID
    const statsContainer = document.createElement("div");
    statsContainer.className = "statistical-cards-section mt-4";
    // Add unique ID based on chart ID to prevent conflicts
    const uniqueId = chartId
      ? `statistical-cards-grid-${chartId}`
      : "statistical-cards-grid";
    statsContainer.innerHTML = `
      <div class="mb-3">
        <h6 class="d-flex align-items-center">
          <i class="fas fa-chart-bar text-info me-2"></i>
          Resumen Estadístico e Información del Dataset
        </h6>
      </div>
      <div class="row" id="${uniqueId}">
      </div>
    `;

    // Append to the specific chart container or general area
    if (chartId && targetContainer.classList.contains("chart-container")) {
      // Add after the followup section within the chart container
      const followupSection = targetContainer.querySelector(
        ".followup-content-section"
      );
      if (followupSection) {
        followupSection.after(statsContainer);
      } else {
        const card = targetContainer.querySelector(".card");
        if (card) {
          card.after(statsContainer);
        } else {
          targetContainer.appendChild(statsContainer);
        }
      }
    } else {
      targetContainer.appendChild(statsContainer);
    }

    // Get the specific cards grid that was just created
    const cardsGrid = statsContainer.querySelector(`#${uniqueId}`);

    // Generate statistical cards
    if (cardsGrid) {
      this.generateStatisticalCards(cardsGrid, dataToUse, llmInsightHtml);
    }
  }

  generateStatisticalCards(container, data, llmInsightHtml = null) {
    console.log(
      "📊 generateStatisticalCards called with data:",
      data.length,
      "rows"
    );

    // Card 1: Insight (LLM-generated or fallback stats)
    const summaryCard = this.createSummaryStatsCard(data, llmInsightHtml);
    if (summaryCard) container.appendChild(summaryCard);

    // Skip Card 2: Distribution Analysis (removed as it doesn't add value)
    // const distributionCard = this.createDistributionCard(data);
    // if (distributionCard) container.appendChild(distributionCard);

    // Card 2 (was 3): Data Overview
    const overviewCard = this.createDataOverviewCard(data);
    if (overviewCard) container.appendChild(overviewCard);
  }

  createSummaryStatsCard(data, llmInsightHtml = null) {
    const cardDiv = document.createElement("div");
    cardDiv.className = "col-md-8 mb-3";

    let statsContent = "";
    let cardTitle = "";
    let cardIcon = "";

    if (llmInsightHtml) {
      // LLM-generated insight: render as narrative HTML
      cardTitle = "Insight del Análisis";
      cardIcon = "fas fa-lightbulb text-warning";
      statsContent = `
        <div class="llm-insight-content" style="line-height: 1.7; font-size: 0.9rem;">
          ${llmInsightHtml}
        </div>
      `;
    } else {
      // Fallback: original Total/Avg/Max badges
      const numericColumns = this.getNumericColumns(data);
      if (!numericColumns.length) return null;

      cardTitle = "Resumen Estadístico";
      cardIcon = "fas fa-calculator text-primary";

      const keyColumns = numericColumns.slice(0, 3);
      keyColumns.forEach((col) => {
        const values = data
          .map((row) => parseFloat(row[col]) || 0)
          .filter((v) => !isNaN(v) && v > 0);
        if (values.length > 0) {
          const total = values.reduce((a, b) => a + b, 0);
          const avg = total / values.length;
          const max = Math.max(...values);

          statsContent += `
            <div class="mb-2">
              <small class="text-muted d-block">${col}</small>
              <div class="d-flex justify-content-between">
                <span class="badge bg-primary">${total.toLocaleString()}</span>
                <span class="badge bg-info">${avg.toFixed(1)}</span>
                <span class="badge bg-success">${max.toLocaleString()}</span>
              </div>
              <small class="text-muted">Total | Prom. | Máx.</small>
            </div>
          `;
        }
      });

      if (!statsContent) return null;
    }

    cardDiv.innerHTML = `
      <div class="card h-100 border-primary">
        <div class="card-body">
          <h6 class="card-title">
            <i class="${cardIcon} me-2"></i>
            ${cardTitle}
          </h6>
          ${statsContent}
        </div>
      </div>
    `;

    return cardDiv;
  }

  createDistributionCard(data) {
    const fieldColumn = this.getFieldColumn(data);

    if (!fieldColumn) return null;

    const cardDiv = document.createElement("div");
    cardDiv.className = "col-md-6 col-lg-4 mb-3";

    const distribution = {};
    data.forEach((row) => {
      const field = row[fieldColumn];
      if (field) {
        distribution[field] = (distribution[field] || 0) + 1;
      }
    });

    let distributionContent = "";
    const topFields = Object.entries(distribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5); // Top 5 fields

    topFields.forEach(([field, count]) => {
      const percentage = ((count / data.length) * 100).toFixed(1);
      distributionContent += `
        <div class="mb-2">
          <div class="d-flex justify-content-between align-items-center">
            <small class="text-truncate me-2">${field}</small>
            <span class="badge bg-secondary">${count}</span>
          </div>
          <div class="progress" style="height: 4px;">
            <div class="progress-bar bg-info" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    });

    cardDiv.innerHTML = `
      <div class="card h-100 border-info">
        <div class="card-body">
          <h6 class="card-title">
            <i class="fas fa-chart-pie text-info me-2"></i>
            Distribución por ${fieldColumn}
          </h6>
          ${distributionContent}
        </div>
      </div>
    `;

    return cardDiv;
  }

  createDataOverviewCard(data) {
    const cardDiv = document.createElement("div");
    cardDiv.className = "col-md-4 mb-3";

    const totalRows = data.length;
    const totalColumns = Object.keys(data[0] || {}).length;
    const numericCols = this.getNumericColumns(data).length;
    const textCols = totalColumns - numericCols;

    cardDiv.innerHTML = `
      <div class="card h-100 border-success">
        <div class="card-body">
          <h6 class="card-title">
            <i class="fas fa-database text-success me-2"></i>
            Información del Dataset
          </h6>
          <div class="mb-2">
            <div class="d-flex justify-content-between">
              <small class="text-muted">Total Registros</small>
              <span class="badge bg-success">${totalRows.toLocaleString()}</span>
            </div>
          </div>
          <div class="mb-2">
            <div class="d-flex justify-content-between">
              <small class="text-muted">Total Columnas</small>
              <span class="badge bg-primary">${totalColumns}</span>
            </div>
          </div>
          <div class="mb-2">
            <div class="d-flex justify-content-between">
              <small class="text-muted">Numéricas</small>
              <span class="badge bg-info">${numericCols}</span>
            </div>
          </div>
          <div class="mb-2">
            <div class="d-flex justify-content-between">
              <small class="text-muted">Categóricas</small>
              <span class="badge bg-warning">${textCols}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    return cardDiv;
  }

  createStatisticsButtons(data) {
    // Check if we have data from Panel 1 to calculate statistics
    if (!this.lastPanel1Data || !this.lastPanel1Data.length) {
      return null;
    }

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "statistics-buttons mb-3";
    buttonContainer.innerHTML = `
      <div class="mb-2">
        <h6><i class="fas fa-calculator"></i> Estadísticas Interactivas</h6>
        <div class="btn-group-vertical w-100" role="group">
          <button class="btn btn-outline-success btn-sm stats-btn" 
                  data-action="summary" 
                  title="Resumen estadístico de los datos actuales">
            <i class="fas fa-chart-line"></i> Resumen Estadístico
          </button>
          <button class="btn btn-outline-info btn-sm stats-btn mt-1" 
                  data-action="distribution" 
                  title="Distribución de valores por campo">
            <i class="fas fa-chart-bar"></i> Distribución por Campo
          </button>
          <button class="btn btn-outline-warning btn-sm stats-btn mt-1" 
                  data-action="ranking" 
                  title="Ranking de campos por producción">
            <i class="fas fa-trophy"></i> Top 5 Campos
          </button>
        </div>
      </div>
    `;

    // Add event listeners for statistics buttons
    buttonContainer.querySelectorAll(".stats-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        this.showStatisticsInPanel2(action);
      });
    });

    return buttonContainer;
  }

  showStatisticsInPanel2(action) {
    const resultsArea = document.getElementById("panel-2-results");
    if (!resultsArea || !this.lastPanel1Data) {
    }

    let content = "";

    try {
      switch (action) {
        case "summary":
          content = this.generateSummaryStats();
          break;
        case "distribution":
          content = this.generateDistributionStats();
          break;
        case "ranking":
          content = this.generateRankingStats();
          break;
      }

      resultsArea.innerHTML = content;
      resultsArea.style.display = "block";

      // Scroll to results
      resultsArea.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      console.error("Error generating statistics:", error);
      resultsArea.innerHTML = `<div class="alert alert-danger">Error generando estadísticas: ${error.message}</div>`;
      resultsArea.style.display = "block";
    }
  }

  generateSummaryStats() {
    const data = this.lastPanel1Data;
    const numericColumns = this.getNumericColumns(data);

    if (!numericColumns.length) {
      return '<div class="alert alert-info">No hay columnas numéricas para calcular estadísticas</div>';
    }

    let stats =
      '<div class="statistics-summary"><h6>📊 Resumen Estadístico</h6><div class="table-responsive"><table class="table table-sm table-striped">';
    stats +=
      "<thead><tr><th>Métrica</th><th>Total</th><th>Promedio</th><th>Máximo</th><th>Mínimo</th></tr></thead><tbody>";

    numericColumns.forEach((col) => {
      const values = data
        .map((row) => parseFloat(row[col]) || 0)
        .filter((v) => !isNaN(v));
      if (values.length > 0) {
        const total = values.reduce((a, b) => a + b, 0);
        const avg = total / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);

        stats += `<tr>
          <td><strong>${col}</strong></td>
          <td>${total.toLocaleString()}</td>
          <td>${avg.toFixed(2)}</td>
          <td>${max.toLocaleString()}</td>
          <td>${min.toLocaleString()}</td>
        </tr>`;
      }
    });

    stats += "</tbody></table></div></div>";
    return stats;
  }

  generateDistributionStats() {
    const data = this.lastPanel1Data;
    const fieldColumn = this.getFieldColumn(data);

    if (!fieldColumn) {
      return '<div class="alert alert-info">No se encontró columna de campo para distribución</div>';
    }

    const distribution = {};
    data.forEach((row) => {
      const field = row[fieldColumn];
      if (field) {
        distribution[field] = (distribution[field] || 0) + 1;
      }
    });

    let content =
      '<div class="distribution-stats"><h6>📊 Distribución por Campo</h6>';
    content += '<div class="row">';

    Object.entries(distribution)
      .sort(([, a], [, b]) => b - a)
      .forEach(([field, count]) => {
        const percentage = ((count / data.length) * 100).toFixed(1);
        content += `
          <div class="col-md-6 mb-2">
            <div class="card card-body p-2">
              <small><strong>${field}</strong></small>
              <div class="progress" style="height: 20px;">
                <div class="progress-bar" role="progressbar" style="width: ${percentage}%" 
                     aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
                  ${count} (${percentage}%)
                </div>
              </div>
            </div>
          </div>
        `;
      });

    content += "</div></div>";
    return content;
  }

  generateRankingStats() {
    const data = this.lastPanel1Data;
    const numericColumns = this.getNumericColumns(data);
    const fieldColumn = this.getFieldColumn(data);

    if (!numericColumns.length || !fieldColumn) {
      return '<div class="alert alert-info">Datos insuficientes para ranking</div>';
    }

    // Use first numeric column for ranking
    const valueColumn = numericColumns[0];
    const ranking = data
      .map((row) => ({
        field: row[fieldColumn],
        value: parseFloat(row[valueColumn]) || 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    let content = `<div class="ranking-stats"><h6>🏆 Top 5 Campos por ${valueColumn}</h6>`;
    content += '<div class="list-group">';

    ranking.forEach((item, index) => {
      const medal =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `${index + 1}.`;
      content += `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <span><strong>${medal} ${item.field}</strong></span>
          <span class="badge bg-primary rounded-pill">${item.value.toLocaleString()}</span>
        </div>
      `;
    });

    content += "</div></div>";
    return content;
  }

  getNumericColumns(data) {
    if (!data || !data.length) return [];

    return Object.keys(data[0]).filter((col) => {
      const sample = data[0][col];
      return !isNaN(parseFloat(sample)) && isFinite(sample);
    });
  }

  getFieldColumn(data) {
    if (!data || !data.length) return null;

    const columns = Object.keys(data[0]);
    return (
      columns.find(
        (col) =>
          col.toLowerCase().includes("field") ||
          col.toLowerCase().includes("campo") ||
          col.toLowerCase().includes("name")
      ) || columns[0]
    );
  }

  updatePanel3Content(data) {
    console.log("🔄 ChatManager.updatePanel3Content called with:", data);
    console.log("🔍 Panel 3 type detected:", data.panel_type);
    console.log(
      "🔍 Checking AnalyticsManager availability:",
      !!window.AnalyticsManager
    );

    // Check if this is the new charts-ready panel type
    if (data.panel_type && data.panel_type.startsWith("charts_")) {
      console.log("✅ Using NEW FLOW - Panel 3 ready for charts");
      this.setupPanel3ForCharts(data);
    }

    console.log("⚠️ Using OLD FLOW - Traditional Panel 3 analytics");

    // Get the source data directly from Panel 3 event (preferred) or fallback to lastMessageData
    let sourceData = null;

    if (
      data.source_data &&
      Array.isArray(data.source_data) &&
      data.source_data.length > 0
    ) {
      sourceData = data.source_data;
      console.log(
        "📊 Source data found in panel_3_update:",
        sourceData.length,
        "rows"
      );
      console.log("📊 Source data sample:", sourceData.slice(0, 2));
    } else if (this.lastMessageData && this.lastMessageData.data) {
      sourceData = this.lastMessageData.data;
      console.log(
        "📊 Source data found in lastMessageData:",
        sourceData.length,
        "rows"
      );
      console.log("📊 Source data sample:", sourceData.slice(0, 2));
    } else {
      console.log("⚠️ No source data available");
      console.log("⚠️ panel_3_update.source_data:", !!data.source_data);
      console.log("⚠️ lastMessageData exists:", !!this.lastMessageData);
    }

    // Use the new AnalyticsManager to process Panel 3 data (legacy charts with buttons)
    if (window.AnalyticsManager) {
      console.log("✅ Calling AnalyticsManager.processPanel3Data...");
      window.AnalyticsManager.processPanel3Data(data, sourceData);
    } else {
      console.error(
        "❌ AnalyticsManager not available - charts.js may not be loaded"
      );
    }
  }

  setupPanel3ForCharts(data) {
    console.log("📊 Setting up Panel 3 for charts:", data);

    // Show analytics section and clear any existing content
    if (window.AnalyticsManager) {
      window.AnalyticsManager.showAnalytics();

      // Clear existing charts
      const chartsArea = document.getElementById("charts-display-area");
      if (chartsArea) {
        chartsArea.innerHTML = `
          <div class="charts-ready-message text-center p-4">
            <i class="fas fa-chart-bar fa-3x text-primary mb-3"></i>
            <h5>Área de Visualización Lista</h5>
            <p class="text-muted">Selecciona un gráfico en el Panel 2 para visualizar los datos aquí.</p>
            <small class="text-muted">
              <i class="fas fa-arrow-left me-1"></i>
              Los botones de gráficos están disponibles en el panel izquierdo
            </small>
          </div>
        `;
      }

      // Store followup content for later use
      this.storedFollowupContent = data.followup_content;
      console.log(
        "📦 Stored followup content for later display:",
        !!this.storedFollowupContent
      );
    }

    // Ensure Panel 3 is visible
    if (window.panelManager) {
      window.panelManager.panels.analytics.visible = true;
      window.panelManager.updatePanelVisibility("analytics");
      window.panelManager.updateLayout();
    }
  }

  // Method to clear current chat
  clearCurrentChat() {
    if (!this.currentConversationId) return;

    const chatMessages = document.getElementById("chat-messages");
    if (chatMessages) {
      // Clear messages
      chatMessages.innerHTML = "";
      // Hide messages area
      chatMessages.style.display = "none";
      // Reset CSS classes for proper scroll management
      chatMessages.classList.remove("has-content");
      chatMessages.classList.add("empty-chat");
    }

    // Show chat banner again
    const chatBanner = document.querySelector(".chat-banner");
    if (chatBanner) {
      chatBanner.style.display = "block";
    }

    // Show welcome section again
    const welcomeSection = document.querySelector(".chat-welcome-section");
    if (welcomeSection) {
      welcomeSection.style.display = "block";
    }

    // Hide chat input on main page
    const chatInputMain = document.querySelector(".chat-input-container");
    if (chatInputMain) chatInputMain.style.display = "none";

    // Clear Panel 3 content (Panel 2 removed)
    const panel3Content = document.querySelector(
      "#analytics-panel .panel-content"
    );

    // Clear Panel 3 using AnalyticsManager
    if (window.AnalyticsManager) {
      window.AnalyticsManager.clearAllCharts();
    }
  }
}

// Enhanced Table Interactive Functions
// Export table to CSV
window.exportTableToCSV = function exportTableToCSV(button) {
  const tableContainer = button.closest(".table-container");
  const table = tableContainer.querySelector(
    ".petroleum-data-table, .enhanced-table"
  );

  if (!table) {
    console.error("No table found to export");
    return;
  }

  let csv = [];
  const rows = table.querySelectorAll("tr");

  rows.forEach((row) => {
    const cols = row.querySelectorAll("td, th");
    const rowData = Array.from(cols).map((col) => {
      // Clean the text content
      let text = col.textContent.trim();
      // Remove icons (they show as empty in CSV anyway)
      text = text.replace(/[🥇🥈🥉]/g, "");
      // Escape quotes
      text = text.replace(/"/g, '""');
      return `"${text}"`;
    });
    csv.push(rowData.join(","));
  });

  // Create and download CSV
  const csvContent = csv.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `ecp_insights_data_${new Date().getTime()}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log("✅ Table exported to CSV");
};

// Toggle compact view
window.toggleTableView = function toggleTableView(button) {
  const tableContainer = button.closest(".table-container");
  const table = tableContainer.querySelector(
    ".petroleum-data-table, .enhanced-table"
  );

  if (!table) return;

  table.classList.toggle("compact-view");

  // Update button icon
  const icon = button.querySelector("i");
  if (table.classList.contains("compact-view")) {
    icon.className = "fas fa-expand";
    button.setAttribute("title", "Vista normal");
  } else {
    icon.className = "fas fa-compress";
    button.setAttribute("title", "Vista compacta");
  }

  console.log("🔄 Toggled table view");
};

// Toggle fullscreen mode
window.toggleFullscreen = function toggleFullscreen(button) {
  const tableContainer = button.closest(".table-container");

  if (!tableContainer) return;

  const isFullscreen = tableContainer.classList.contains("fullscreen");

  if (!isFullscreen) {
    // Enter fullscreen
    tableContainer.classList.add("fullscreen");

    // Store original parent ELEMENT (not just ID) for reliable restoration
    const parentElement = tableContainer.parentElement;
    if (parentElement) {
      // Store direct reference to parent element
      tableContainer._originalParentElement = parentElement;

      // Also store ID as backup (if it has one)
      tableContainer.dataset.originalParent = parentElement.id || "";
      tableContainer.dataset.originalNextSibling =
        tableContainer.nextElementSibling?.id || "";

      console.log(
        `📦 Stored parent reference: element=${parentElement.tagName}, id="${
          parentElement.id || "(no id)"
        }"`
      );
    } else {
      console.warn("⚠️ No parent element found when entering fullscreen");
    }

    // Update button icon
    const icon = button.querySelector("i");
    icon.className = "fas fa-compress";
    button.setAttribute("title", "Salir de pantalla completa");

    // Move table container to body to completely detach from layout
    document.body.appendChild(tableContainer);

    // Hide EVERYTHING - sidebar, footer, and ALL panels
    const sidebar = document.getElementById("sidebar");
    const footer = document.querySelector(".app-footer");
    const panelLayout = document.querySelector(".three-panel-layout");

    if (sidebar) {
      sidebar.style.display = "none";
    }
    if (footer) {
      footer.style.display = "none";
    }
    if (panelLayout) {
      panelLayout.style.display = "none";
    }

    // Create close button if it doesn't exist
    if (!document.querySelector(".fullscreen-close")) {
      const closeBtn = document.createElement("button");
      closeBtn.className = "btn-icon fullscreen-close";
      closeBtn.innerHTML =
        '<i class="fas fa-times"></i> Cerrar Pantalla Completa';
      closeBtn.onclick = () => toggleFullscreen(button);
      document.body.appendChild(closeBtn);
    }

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    // Add fullscreen class to body for additional styling control
    document.body.classList.add("table-fullscreen-active");

    // Add ESC key listener
    document.addEventListener("keydown", window.handleFullscreenEscape);

    console.log("✅ Table moved to body for fullscreen");
  } else {
    // Exit fullscreen
    console.log("🔄 Exiting fullscreen mode...");
    tableContainer.classList.remove("fullscreen");

    // Update button icon
    const icon = button.querySelector("i");
    icon.className = "fas fa-expand";
    button.setAttribute("title", "Pantalla completa");

    // Restore table to its original position
    let restored = false;

    // MÉTODO 1: Usar referencia directa al elemento (más confiable)
    if (tableContainer._originalParentElement) {
      const originalParent = tableContainer._originalParentElement;

      // Verificar que el parent todavía existe en el DOM
      if (document.body.contains(originalParent)) {
        originalParent.appendChild(tableContainer);
        restored = true;
        console.log("✅ Table restored using direct parent reference");

        // Limpiar la referencia
        delete tableContainer._originalParentElement;
      } else {
        console.warn("⚠️ Original parent element no longer exists in DOM");
        delete tableContainer._originalParentElement;
      }
    }

    // MÉTODO 2: Fallback a buscar por ID (si método 1 falla)
    if (!restored) {
      const originalParentId = tableContainer.dataset.originalParent;
      const originalNextSiblingId = tableContainer.dataset.originalNextSibling;

      console.log(
        `📍 Trying ID-based restoration: parentId="${originalParentId}"`
      );

      if (originalParentId) {
        const originalParent = document.getElementById(originalParentId);
        if (originalParent) {
          if (originalNextSiblingId) {
            const nextSibling = document.getElementById(originalNextSiblingId);
            if (nextSibling) {
              originalParent.insertBefore(tableContainer, nextSibling);
            } else {
              originalParent.appendChild(tableContainer);
            }
          } else {
            originalParent.appendChild(tableContainer);
          }
          restored = true;
          console.log(
            "✅ Table restored to original parent by ID:",
            originalParentId
          );
        } else {
          console.warn("⚠️ Original parent not found by ID:", originalParentId);
        }
      } else {
        console.warn("⚠️ No originalParentId stored (parent had no ID)");
      }
    }

    // FALLBACK: Si no se pudo restaurar, buscar el mensaje del chat más reciente
    if (!restored) {
      console.warn("⚠️ Using fallback: searching for latest chat message");

      // Intentar múltiples selectores para encontrar mensajes del asistente
      const selectors = [
        ".message.assistant .message-content",
        ".assistant-message .message-content",
        ".message.bot .message-content",
        ".chat-message.assistant",
        '[data-role="assistant"]',
      ];

      for (const selector of selectors) {
        const messages = document.querySelectorAll(selector);
        if (messages.length > 0) {
          const latestMessage = messages[messages.length - 1];
          latestMessage.appendChild(tableContainer);
          console.log(
            `✅ Table appended to latest message using selector: ${selector}`
          );
          restored = true;
          break;
        }
      }

      // Si aún no se restauró, buscar cualquier .message-content
      if (!restored) {
        const anyMessages = document.querySelectorAll(".message-content");
        if (anyMessages.length > 0) {
          const latestMessage = anyMessages[anyMessages.length - 1];
          latestMessage.appendChild(tableContainer);
          console.log(
            "✅ Table appended to latest .message-content (any type)"
          );
          restored = true;
        }
      }
    }

    // ÚLTIMO RECURSO: Si todavía no se restauró, crear un contenedor temporal
    if (!restored) {
      console.error(
        "❌ Could not restore table to chat. Creating fallback container."
      );

      // Crear mensaje de advertencia visible para el usuario
      const fallbackContainer = document.createElement("div");
      fallbackContainer.className = "message assistant";
      fallbackContainer.innerHTML = `
        <div class="message-avatar">
          <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
          <p><strong>⚠️ Tabla restaurada</strong></p>
          <p>La tabla se movió aquí porque el mensaje original ya no está disponible.</p>
        </div>
      `;
      fallbackContainer
        .querySelector(".message-content")
        .appendChild(tableContainer);

      // Intentar agregar al contenedor de mensajes del chat
      const chatMessages = document.getElementById("chat-messages");
      if (chatMessages) {
        chatMessages.appendChild(fallbackContainer);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        restored = true;
        console.log("✅ Table added to fallback container in chat-messages");
      } else {
        // Si tampoco existe chat-messages, buscar cualquier contenedor de panel
        const panelContent = document.querySelector(".panel-content");
        if (panelContent) {
          panelContent.appendChild(fallbackContainer);
          panelContent.scrollTop = panelContent.scrollHeight;
          restored = true;
          console.log("✅ Table added to fallback container in panel-content");
        } else {
          // Último último recurso: dejarlo en el body pero visible
          document.body.appendChild(fallbackContainer);
          restored = true;
          console.warn("⚠️ Table added directly to body as last resort");
        }
      }
    }

    // Restore all hidden elements
    const sidebar = document.getElementById("sidebar");
    const footer = document.querySelector(".app-footer");
    const panelLayout = document.querySelector(".three-panel-layout");

    if (sidebar) {
      sidebar.style.display = "";
    }
    if (footer) {
      footer.style.display = "";
    }
    if (panelLayout) {
      panelLayout.style.display = "";
    }

    // Remove close button immediately (no fade needed)
    const closeBtn = document.querySelector(".fullscreen-close");
    if (closeBtn) {
      closeBtn.remove();
    }

    // Restore body scroll
    document.body.style.overflow = "";

    // Remove fullscreen class from body
    document.body.classList.remove("table-fullscreen-active");

    // Remove ESC key listener
    document.removeEventListener("keydown", window.handleFullscreenEscape);

    if (restored) {
      console.log("✅ Table successfully restored to chat");
    } else {
      console.error("❌ Failed to restore table - this should not happen");
    }
  }

  console.log(`🖥️ Fullscreen mode: ${!isFullscreen ? "ON" : "OFF"}`);
};

// Handle ESC key to exit fullscreen
window.handleFullscreenEscape = function (e) {
  if (e.key === "Escape" || e.keyCode === 27) {
    const fullscreenContainer = document.querySelector(
      ".table-container.fullscreen"
    );
    if (fullscreenContainer) {
      // Find the toggle button within the fullscreen container
      const toggleButton =
        fullscreenContainer.querySelector(".fullscreen-toggle");
      if (toggleButton) {
        toggleFullscreen(toggleButton);
      }
    }
  }
};

// Pagination functions
window.previousPage = function previousPage(button) {
  const paginationContainer = button.closest(".table-pagination");
  const currentPageSpan = paginationContainer.querySelector("#current-page");
  const currentPage = parseInt(currentPageSpan.textContent);

  if (currentPage > 1) {
    const newPage = currentPage - 1;
    updateTablePage(paginationContainer, newPage);
  }
};

window.nextPage = function nextPage(button) {
  const paginationContainer = button.closest(".table-pagination");
  const pageIndicator = paginationContainer.querySelector(".page-indicator");
  const totalPages = parseInt(pageIndicator.textContent.match(/de (\d+)/)[1]);
  const currentPageSpan = paginationContainer.querySelector("#current-page");
  const currentPage = parseInt(currentPageSpan.textContent);

  if (currentPage < totalPages) {
    const newPage = currentPage + 1;
    updateTablePage(paginationContainer, newPage);
  }
};

function updateTablePage(paginationContainer, newPage) {
  const tableContainer = paginationContainer.closest(".table-container");
  const table = tableContainer.querySelector(
    ".petroleum-data-table, .enhanced-table"
  );
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));

  const rowsPerPage = 20;
  const startIndex = (newPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

  // Hide all rows
  rows.forEach((row) => (row.style.display = "none"));

  // Show rows for current page
  rows.slice(startIndex, endIndex).forEach((row) => (row.style.display = ""));

  // Update pagination info
  const currentPageSpan = paginationContainer.querySelector("#current-page");
  const currentRangeSpan = paginationContainer.querySelector("#current-range");
  const totalRows = rows.length;

  currentPageSpan.textContent = newPage;
  currentRangeSpan.textContent = `${startIndex + 1}-${Math.min(
    endIndex,
    totalRows
  )}`;

  // Update button states
  const prevButton = paginationContainer.querySelector("button:first-of-type");
  const nextButton = paginationContainer.querySelector("button:last-of-type");
  const totalPages = Math.ceil(totalRows / rowsPerPage);

  prevButton.disabled = newPage === 1;
  nextButton.disabled = newPage === totalPages;

  console.log(`📄 Showing page ${newPage} of ${totalPages}`);
}

// Sort table by column
window.sortTableByColumn = function sortTableByColumn(header, columnIndex) {
  const table = header.closest("table");
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));

  // Determine sort direction
  const currentDirection = header.getAttribute("data-sort-direction") || "asc";
  const newDirection = currentDirection === "asc" ? "desc" : "asc";

  // Sort rows
  rows.sort((a, b) => {
    const aCell = a.querySelectorAll("td")[columnIndex];
    const bCell = b.querySelectorAll("td")[columnIndex];

    if (!aCell || !bCell) return 0;

    const aText = aCell.textContent.trim();
    const bText = bCell.textContent.trim();

    // Try to parse as number
    const aNum = parseFloat(aText.replace(/,/g, ""));
    const bNum = parseFloat(bText.replace(/,/g, ""));

    if (!isNaN(aNum) && !isNaN(bNum)) {
      return newDirection === "asc" ? aNum - bNum : bNum - aNum;
    }

    // String comparison
    return newDirection === "asc"
      ? aText.localeCompare(bText)
      : bText.localeCompare(aText);
  });

  // Re-append sorted rows
  rows.forEach((row) => tbody.appendChild(row));

  // Update sort indicators
  table.querySelectorAll("th").forEach((th) => {
    th.removeAttribute("data-sort-direction");
    th.classList.remove("sorted-asc", "sorted-desc");
  });

  header.setAttribute("data-sort-direction", newDirection);
  header.classList.add(`sorted-${newDirection}`);

  console.log(`🔄 Sorted column ${columnIndex} in ${newDirection} order`);
};

// Add click listeners to sortable headers after table is rendered
document.addEventListener("DOMContentLoaded", () => {
  // Use event delegation for dynamically added tables
  document.body.addEventListener("click", (e) => {
    if (e.target.closest(".sortable-header")) {
      const header = e.target.closest(".sortable-header");
      const headers = Array.from(header.parentElement.querySelectorAll("th"));
      const columnIndex = headers.indexOf(header);
      sortTableByColumn(header, columnIndex);
    }
  });
});

// Initialize chat manager - create instance only when DOM is ready
let ChatManagerInstance;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    ChatManagerInstance = new ChatManager();
    window.ChatManager = ChatManagerInstance;
  });
} else {
  ChatManagerInstance = new ChatManager();
  window.ChatManager = ChatManagerInstance;
}

window.igToggleSheet = function (hd) { hd.closest(".ig-sheet").classList.toggle("is-open"); };
window.igToggleGroup = function (hd) { hd.closest(".ig-group").classList.toggle("is-open"); };
window.igExpandAll = function (btn) {
  const sheets = [...document.querySelectorAll("#ingesta-sheet-list .ig-sheet")];
  const open = !sheets.every((s) => s.classList.contains("is-open"));   // si no todas abiertas → abrir todas
  sheets.forEach((s) => s.classList.toggle("is-open", open));
  btn.setAttribute("aria-pressed", String(open));
  btn.innerHTML = open ? '<i class="bi bi-chevron-bar-contract"></i> Colapsar todo'
                       : '<i class="bi bi-chevron-bar-expand"></i> Expandir todo';
};
window.igSelectTable = function (row, sheetLi) {
  document.querySelectorAll("#ingesta-sheet-list .ig-trow.is-active").forEach((x) => x.classList.remove("is-active"));
  row.classList.add("is-active");
  // regla del doc: solo la hoja activa expandida
  document.querySelectorAll("#ingesta-sheet-list .ig-sheet").forEach((s) => s.classList.toggle("is-open", s === sheetLi));
};
window.igSearch = function (q) {
  q = (q || "").toLowerCase().trim();
  let vis = 0;
  document.querySelectorAll("#ig-dt tbody tr").forEach((tr) => {
    const ok = !q || (tr.dataset.name || "").includes(q);
    tr.style.display = ok ? "" : "none"; if (ok) vis++;
  });
  const c = document.getElementById("ig-visible"); if (c) c.textContent = vis;
};
window.igDensity = function (compact, btn) {
  const dt = document.getElementById("ig-dt"); if (dt) dt.classList.toggle("is-compact", compact);
  btn.parentElement.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
  btn.classList.add("is-active");
};
window.igExportCSV = function () {
  const t = window.__igTable; if (!t) return;
  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const dcols = t.dimCols || [];
  const head = [...dcols.map((d) => String(d).toUpperCase()), ...t.cols].map(esc).join(",");
  const rows = t.filas.map((f) => [
    ...dcols.map((d) => { const x = (f.dims || {})[d]; return x == null ? "" : x; }),
    ...(f.valores || []).map((v) => v == null ? "" : v),
  ].map(esc).join(","));
  const csv = "﻿" + [head, ...rows].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = (t.titulo || "tabla").replace(/[^\w.-]+/g, "_") + ".csv";
  a.click(); URL.revokeObjectURL(a.href);
};

// ---- Selector de archivo V3 ----
window.igParseFecha = function (name) {                 // YYYYMMDD real -> dd/mm/aaaa (o null)
  const m = String(name).match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(+y, +mo - 1, +d);
  if (dt.getFullYear() !== +y || dt.getMonth() !== +mo - 1 || dt.getDate() !== +d) return null;
  return `${d}/${mo}/${y}`;
};
window.igTruncName = function (name) {                  // 14 + … + 9
  name = String(name);
  return name.length > 26 ? name.slice(0, 14) + "…" + name.slice(-9) : name;
};
window.igPickFile = function () {                       // I-B: reset value para que re-elegir el mismo archivo dispare onchange
  const i = document.getElementById("ingesta-file"); if (i) { i.value = ""; i.click(); }
};
window.igRenderDropzone = function () {
  const zone = document.getElementById("ingesta-filezone"); if (!zone) return;
  window.__ingestaFile = null;
  const btn = document.getElementById("ingesta-upload-btn"); if (btn) btn.disabled = true;
  const badge = document.getElementById("ingesta-mode-badge"); if (badge) badge.textContent = "";
  zone.innerHTML = `
    <div class="rb-upload__drop" role="button" tabindex="0" aria-label="Seleccionar archivo XLSX"
         onclick="window.igPickFile()"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.igPickFile();}"
         ondragover="event.preventDefault();this.classList.add('is-over');"
         ondragleave="this.classList.remove('is-over');"
         ondrop="event.preventDefault();this.classList.remove('is-over');window.igSetFile(event.dataTransfer.files&&event.dataTransfer.files[0]);">
      <i class="bi bi-filetype-xlsx"></i>
      <div class="t1">Selecciona o arrastra el XLSX</div>
      <div class="t2">.xlsx · .xlsm</div>
    </div>`;
};
window.igOnFileInput = function (e) { window.igSetFile(e.target.files && e.target.files[0]); };
window.igSetFile = function (file) {
  const zone = document.getElementById("ingesta-filezone");
  const btn = document.getElementById("ingesta-upload-btn");
  if (!file || !zone) return;
  window.__ingestaFile = file;
  const ext = (String(file.name).match(/\.[^.]+$/) || [""])[0].toLowerCase();
  const extOk = ext === ".xlsx" || ext === ".xlsm";
  const fecha = extOk ? window.igParseFecha(file.name) : null;
  const valid = extOk && fecha !== null;
  const err = !extOk ? "Formato no permitido (.xlsx / .xlsm)" : "El nombre debe incluir la fecha YYYYMMDD";
  zone.innerHTML = `
    <div class="rb-chip">
      <div class="rb-chip__thumb"><i class="bi bi-filetype-xlsx"></i></div>
      <div class="rb-chip__main">
        <div class="rb-chip__name" title="${String(file.name).replace(/"/g, "&quot;")}">${window.igTruncName(file.name)}</div>
        <div class="rb-chip__val ${valid ? "" : "is-error"}" aria-live="polite">
          <i class="bi ${valid ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}"></i>
          <span>${valid ? `Fecha ${fecha} · destino CPF` : err}</span>
        </div>
      </div>
      <button class="rb-chip__change" onclick="window.igPickFile()">Cambiar</button>
    </div>`;
  if (btn) btn.disabled = !valid;
  if (extOk) window.igReadSheetsPreview(file);          // preview del árbol (setea badge NEW/STD)
};
