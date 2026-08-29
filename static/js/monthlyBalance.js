/**
 * Monthly Balance rendering helpers.
 *
 * These helpers expect the payload produced by
 * `create_monthly_balance_payload` (backend module
 * `chatbot/agents/analytics/chart_creators/monthly_balance.py`).
 */

/* global Plotly */

/**
 * Render the monthly balance chart into the provided container element.
 *
 * @param {HTMLElement} container - Parent element where the chart card will be appended.
 * @param {Object} chartData - Plotly-compatible chart data from the backend.
 * @returns {HTMLElement} The card element that contains the chart.
 */
function renderMonthlyBalanceChart(container, chartData) {
  if (!container) {
    console.warn("renderMonthlyBalanceChart: container not provided");
    return null;
  }

  const card = document.createElement("div");
  card.className = "card mb-3";

  const header = document.createElement("div");
  header.className = "card-header bg-light";
  header.innerHTML = `
    <h6 class="mb-0 d-flex align-items-center gap-2">
      <i class="fas fa-chart-bar"></i>
      ${chartData?.layout?.title || "Balance Mensual de Producción"}
    </h6>
  `;
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "card-body";
  body.style.minHeight = "420px";

  const chartEl = document.createElement("div");
  chartEl.style.height = "360px";
  chartEl.id = `monthly-balance-chart-${Date.now()}`;

  body.appendChild(chartEl);
  card.appendChild(body);
  container.appendChild(card);

  const traces = Array.isArray(chartData?.traces) ? chartData.traces : [];
  const layout = {
    ...(chartData?.layout || {}),
    autosize: true,
  };
  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
  };

  Plotly.newPlot(chartEl, traces, layout, config).catch((err) => {
    console.error("Error rendering monthly balance chart:", err);
    chartEl.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Error al renderizar el gráfico: ${err.message}
      </div>
    `;
  });

  return card;
}

/**
 * Render the summary table associated with the monthly balance report.
 *
 * @param {HTMLElement} container - Parent element where the table will be appended.
 * @param {Object} summaryTable - Table payload from the backend.
 * @returns {HTMLElement|null} The card element that contains the table, or null if no data.
 */
function renderMonthlyBalanceSummary(container, summaryTable) {
  if (
    !container ||
    !summaryTable ||
    !Array.isArray(summaryTable.headers) ||
    !summaryTable.headers.length ||
    !Array.isArray(summaryTable.rows) ||
    !summaryTable.rows.length
  ) {
    return null;
  }

  const card = document.createElement("div");
  card.className = "card mb-3";

  const header = document.createElement("div");
  header.className = "card-header bg-light";
  header.innerHTML = `
    <h6 class="mb-0 d-flex align-items-center gap-2">
      <i class="fas fa-table"></i>
      ${summaryTable.title || "Resumen Mes"}
    </h6>
  `;
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "card-body p-0";
  body.style.overflowX = "auto";

  const table = document.createElement("table");
  table.className = "table table-striped table-bordered table-sm mb-0";
  table.style.fontSize = "0.85rem";

  const thead = document.createElement("thead");
  thead.style.backgroundColor = "#004236";
  thead.style.color = "#F7DB17";

  const headerRow = document.createElement("tr");
  summaryTable.headers.forEach((headerItem) => {
    const th = document.createElement("th");
    th.className = "text-center align-middle fw-bold";
    th.style.padding = "0.5rem";
    th.style.backgroundColor = "transparent";
    th.style.color = "#F7DB17";
    th.innerHTML = headerItem.label || headerItem.key;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  summaryTable.rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    const rowBackground = index % 2 === 0 ? "#EDEDED" : "#FFFFFF";
    tr.style.backgroundColor = rowBackground;

    summaryTable.headers.forEach((headerItem) => {
      const td = document.createElement("td");
      const value = row[headerItem.key];

      let displayValue;
      if (value === null || value === undefined || value === "") {
        displayValue = "-";
      } else if (typeof value === "number") {
        displayValue = value.toLocaleString("es-ES", {
          maximumFractionDigits: 2,
        });
      } else {
        displayValue = String(value);
      }

      td.textContent = displayValue;
      td.style.padding = "0.45rem";
      td.className =
        headerItem.key === "Segmento" ? "text-start fw-semibold" : "text-end";
      td.style.backgroundColor = rowBackground;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  body.appendChild(table);
  card.appendChild(body);
  container.appendChild(card);

  return card;
}

/**
 * Convenience helper to render the complete monthly balance report.
 *
 * @param {HTMLElement} container - Parent element where the report should be rendered.
 * @param {Object} payload - Backend payload (same structure as create_monthly_balance_payload).
 */
function renderMonthlyBalanceReport(container, payload) {
  if (!container) return;

  if (!payload || !payload.success) {
    console.warn("renderMonthlyBalanceReport: payload is empty or unsuccessful");
    return;
  }

  container.innerHTML = "";
  const message = payload?.message || "Pagina en construccion";

  const card = document.createElement("div");
  card.className = "card mb-3";

  const header = document.createElement("div");
  header.className = "card-header bg-light";
  header.innerHTML = `
    <h6 class="mb-0">
      <i class="fas fa-clipboard-list"></i>
      Balance (mes)
    </h6>
  `;
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "card-body text-muted";
  body.innerHTML = `
    <p class="mb-2">${message}</p>
    <p class="mb-0">Pronto se agregaran componentes para este reporte.</p>
  `;
  card.appendChild(body);

  container.appendChild(card);
}

// Expose helpers on the global scope for legacy scripts.
if (typeof window !== "undefined") {
  window.monthlyBalanceRenderer = window.monthlyBalanceRenderer || {};
  window.monthlyBalanceRenderer.renderMonthlyBalanceChart =
    renderMonthlyBalanceChart;
  window.monthlyBalanceRenderer.renderMonthlyBalanceSummary =
    renderMonthlyBalanceSummary;
  window.monthlyBalanceRenderer.renderMonthlyBalanceReport =
    renderMonthlyBalanceReport;
}
