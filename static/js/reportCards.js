/**
 * Report Cards Factory
 * Rebuilt implementation.
 */

class ReportCardFactory {
  static createEmptyStateCard(title, message, options = {}) {
    const {
      iconClass = "fa-info-circle",
      className = "card summary-empty-card mb-3",
      bodyClass = "card-body text-center text-muted py-4",
    } = options || {};

    const card = document.createElement("div");
    card.className = className;

    if (title) {
      const header = document.createElement("div");
      header.className = "card-header bg-light fw-semibold";
      header.innerHTML = `
        <i class="fas ${iconClass} text-custom-icon me-2"></i>${title}
      `;
      card.appendChild(header);
    }

    const body = document.createElement("div");
    body.className = bodyClass;
    body.innerHTML = `
      <i class="fas ${iconClass} fa-2x mb-2 text-muted"></i>
      <p class="mb-0">${message}</p>
    `;
    card.appendChild(body);

    return card;
  }

  static formatMessageContent(content = "") {
    if (typeof content !== "string") {
      return "";
    }
    if (content.includes("<table") || content.includes("<div")) {
      return content;
    }
    let formatted = content;
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
    formatted = formatted.replace(/`(.*?)`/g, "<code>$1</code>");
    formatted = formatted.replace(/^- (.*)$/gim, "<li>$1</li>");
    if (/<li>/.test(formatted)) {
      formatted = formatted.replace(/(<li>.*<\/li>)/gms, "<ul>$1</ul>");
    }
    formatted = formatted.replace(/\n/g, "<br>");
    return formatted;
  }

  static formatDeferredDate(value) {
    if (!value) return "Sin fecha";

    const strValue = String(value).trim();
    if (!strValue) return "Sin fecha";

    let date;
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(strValue);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      date = new Date(Number(year), Number(month) - 1, Number(day));
    } else {
      date = new Date(strValue);
      if (Number.isNaN(date.getTime())) return strValue;
    }

    const options = {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    };

    const canIntlFormat =
      typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function";

    const formatted = canIntlFormat
      ? new Intl.DateTimeFormat("es-ES", options).format(date)
      : date.toLocaleDateString("es-ES", options);

    return formatted.charAt(0).toLocaleUpperCase("es-ES") + formatted.slice(1);
  }
  static createDeferredSummaryCard(tableData) {
    const card = document.createElement("div");
    card.className = "card mb-3";

    const header = document.createElement("div");
    header.className = "card-header bg-light";
    header.innerHTML = `
      <h6 class="mb-0">
        <i class="fas fa-clipboard-list me-2"></i>
        ${tableData?.title || "Resumen Diferidas"}
      </h6>
    `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body";
    body.style.maxHeight = "320px";
    body.style.overflowY = "auto";

    const rows = Array.isArray(tableData?.rows) ? tableData.rows : [];
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "text-muted text-center";
      empty.textContent = "No hay registros disponibles.";
      body.appendChild(empty);
    } else {
      rows.forEach((row, index) => {
        const entry = document.createElement("div");
        entry.className = "mb-3";

        const dateKey = Object.keys(row).find((k) => /date/i.test(k)) || "fecha";
        const commentKey = Object.keys(row).find((k) => /comment/i.test(k)) || "comentario";

        const dateEl = document.createElement("div");
        dateEl.className = "deferred-summary-date fw-semibold";
        dateEl.textContent = ReportCardFactory.formatDeferredDate(row[dateKey]);
        entry.appendChild(dateEl);

        const commentEl = document.createElement("p");
        commentEl.className = "mb-0 text-muted";
        commentEl.style.whiteSpace = "pre-wrap";
        commentEl.textContent = row[commentKey] || "Sin comentario";
        entry.appendChild(commentEl);

        body.appendChild(entry);

        if (index < rows.length - 1) {
          const hr = document.createElement("hr");
          hr.className = "my-2";
          hr.style.opacity = "0.15";
          body.appendChild(hr);
        }
      });
    }

    card.appendChild(body);
    return card;
  }

  static buildMainSummaryTable(summaryTable) {
    if (
      !summaryTable ||
      !Array.isArray(summaryTable.headers) ||
      !summaryTable.headers.length ||
      !Array.isArray(summaryTable.rows) ||
      !summaryTable.rows.length
    ) {
      return null;
    }

    const card = document.createElement("div");
    card.className = "card summary-main-table-card mb-4";

    const header = document.createElement("div");
    header.className = "card-header bg-light fw-semibold";
    header.innerHTML = `
      <i class="fas fa-database text-custom-icon me-2"></i>Tabla Resumen
    `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body p-0";

    const table = document.createElement("table");
    table.className = "table table-bordered table-sm mb-0 summary-main-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    summaryTable.headers.forEach((column) => {
      const th = document.createElement("th");
      th.innerHTML = column.label || column.key;
      th.className = "text-center align-middle";
      th.style.padding = "0.65rem";
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    summaryTable.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      summaryTable.headers.forEach((column, colIndex) => {
        const td = document.createElement("td");
        const rawValue = row[column.key];
        let display = "-";
        if (rawValue !== null && rawValue !== undefined && rawValue !== "") {
          display =
            typeof rawValue === "number"
              ? rawValue.toLocaleString("es-ES", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })
              : String(rawValue);
        }
        const isVar =
          (column.key || "").toLowerCase().startsWith("var") ||
          (column.label || "").toLowerCase().includes("var");
        td.textContent = display;
        td.className = colIndex === 0 ? "text-start align-middle" : "text-center align-middle";
        td.style.padding = "0.6rem";
        if (isVar && display !== "-") {
          const numeric =
            typeof rawValue === "number"
              ? rawValue
              : Number(
                  String(rawValue)
                    .replace(/\s+/g, "")
                    .replace(/\./g, "")
                    .replace(",", ".")
                );
          if (Number.isFinite(numeric)) {
            if (numeric < 0) td.classList.add("text-danger");
            else if (numeric > 0) td.classList.add("text-success");
          }
        }
        tr.appendChild(td);
      });
      tr.className = rowIndex % 2 === 0 ? "summary-main-row-even" : "";
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.appendChild(table);
    card.appendChild(body);
    return card;
  }

  static createVpLossTable(analysisTable) {
    if (
      !analysisTable ||
      !Array.isArray(analysisTable.headers) ||
      !analysisTable.headers.length ||
      !Array.isArray(analysisTable.rows) ||
      !analysisTable.rows.length
    ) {
      return ReportCardFactory.createEmptyStateCard(
        "P\u00e9rdidas por vicepresidencia y campos principales",
        "No hay datos anal\u00edticos disponibles para esta secci\u00f3n.",
        {
          iconClass: "fa-chart-bar",
          className: "card summary-loss-card-wrapper mb-3",
        }
      );
    }

    const card = document.createElement("div");
    card.className = "card summary-loss-card-wrapper mb-3";

    const header = document.createElement("div");
    header.className = "card-header bg-white fw-semibold";
    header.innerHTML = `
      <i class="fas fa-chart-bar text-custom-icon me-2"></i>Perdidas por vicepresidencia y campos principales
    `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body p-0";
    body.style.overflowX = "auto";

    const table = document.createElement("table");
    table.className = "table table-sm summary-loss-table mb-0";
    table.style.minWidth = "640px";

    const caption = table.createCaption();
    caption.className = "summary-loss-caption";
    //caption.innerHTML = "?? P�rdidas por Vicepresidencia y Campos principales";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    analysisTable.headers.forEach((headerItem) => {
      const th = document.createElement("th");
      th.innerHTML = headerItem.label || headerItem.key;
      th.className = "text-center align-middle";
      th.style.padding = "0.65rem";
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    analysisTable.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      analysisTable.headers.forEach((headerItem, colIndex) => {
        const td = document.createElement("td");
        const rawValue = row[headerItem.key];
        const formatted =
          typeof rawValue === "number"
            ? rawValue.toLocaleString("es-ES", { minimumFractionDigits: 0 })
            : String(rawValue ?? "-");
        const isLast = colIndex === analysisTable.headers.length - 1;
        td.textContent = formatted;
        td.className = isLast
          ? "summary-loss-value text-center align-middle"
          : "align-middle";
        td.style.padding = "0.6rem";
        tr.appendChild(td);
      });
      tr.className = rowIndex % 2 === 0 ? "summary-loss-row-even" : "";
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.appendChild(table);
    card.appendChild(body);
    return card;
  }

  static createConclusionCard(conclusionItems) {
    if (!Array.isArray(conclusionItems) || !conclusionItems.length) {
      const placeholder = ReportCardFactory.createEmptyStateCard(
        "Conclusi\u00f3n integrada",
        "A\u00fan no hay conclusiones consolidadas para mostrar.",
        {
          iconClass: "fa-lightbulb",
          className: "card summary-conclusion-card",
          bodyClass: "card-body text-center text-muted py-4",
        }
      );
      placeholder.style.backgroundColor = "#EDEDED";
      const placeholderBody = placeholder.querySelector(".card-body");
      if (placeholderBody) {
        placeholderBody.style.backgroundColor = "#EDEDED";
      }
      return placeholder;
    }

    const card = document.createElement("div");
    card.className = "card summary-conclusion-card";
    card.style.backgroundColor = "#EDEDED";

    const header = document.createElement("div");
    header.className = "card-header bg-white fw-semibold";
    header.innerHTML = `
      <i class="fas fa-lightbulb text-custom-icon me-2"></i>Conclusión Integrada
    `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body";
    body.style.backgroundColor = "#EDEDED";

    conclusionItems.forEach((item) => {
      if (!item) return;
      const p = document.createElement("p");
      p.className = "mb-3 text-secondary";
      p.innerHTML = ReportCardFactory.formatMessageContent(item);
      body.appendChild(p);
    });

    card.appendChild(body);
    return card;
  }

  static createPanoramaInsightsCard(panoramaData) {
    const title =
      panoramaData && typeof panoramaData === "object" && panoramaData.titulo
        ? panoramaData.titulo
        : "Panorama General";

    const description =
      panoramaData &&
      typeof panoramaData === "object" &&
      typeof panoramaData.descripcion === "string"
        ? panoramaData.descripcion.trim()
        : "";

    const insights = Array.isArray(panoramaData?.insights)
      ? panoramaData.insights.filter(Boolean)
      : [];

    if (!description && !insights.length) {
      return ReportCardFactory.createEmptyStateCard(
        title,
        "Esta sección se actualizará cuando haya un panorama disponible.",
        {
          iconClass: "fa-chart-pie",
          className: "card shadow-sm mb-4 panorama-summary-card summary-panorama-card",
        }
      );
    }

    const card = document.createElement("div");
    card.className = "card shadow-sm mb-4 panorama-summary-card summary-panorama-card";

    const header = document.createElement("div");
    header.className = "card-header bg-light d-flex align-items-center gap-2 flex-wrap";
    header.innerHTML = `
        <i class="fas fa-chart-pie text-custom-icon"></i>
        <h6 class="mb-0">${title}</h6>
      `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body";
    body.style.padding = "1.25rem";

    if (description) {
      const p = document.createElement("p");
      p.className = "mb-3 text-muted";
      p.textContent = description;
      body.appendChild(p);
    }

    if (insights.length) {
      const list = document.createElement("div");
      list.className = "d-flex flex-column gap-2";

      const keywordsIncrease = ["incremento", "crecimiento", "alza", "mejor"];
      const keywordsDecrease = ["caída", "caida", "disminución", "reducción", "descenso", "peor"];

      const normalizedInsights = insights
        .map((insight, index) => {
          if (!insight) return null;

          let numericValue = null;
          if (typeof insight.valor === "number") {
            numericValue = Number.isNaN(insight.valor) ? null : insight.valor;
          } else if (typeof insight.valor === "string") {
            const sanitized = insight.valor.replace(/[^0-9+.,-]/g, "");
            const parsed = parseFloat(sanitized.replace(",", "."));
            numericValue = Number.isNaN(parsed) ? null : parsed;
          }

          const messageText =
            (typeof insight.mensaje === "string" ? insight.mensaje : "") +
            " " +
            (typeof insight.etiqueta === "string" ? insight.etiqueta : "");
          const normalizedMessage = messageText.toLowerCase();

          const hasIncreaseKeyword = keywordsIncrease.some((kw) =>
            normalizedMessage.includes(kw)
          );
          const hasDecreaseKeyword = keywordsDecrease.some((kw) =>
            normalizedMessage.includes(kw)
          );

          const isIncrease =
            (numericValue !== null && numericValue > 0) ||
            (numericValue === null && hasIncreaseKeyword);
          const isDecrease =
            (numericValue !== null && numericValue < 0) ||
            (numericValue === null && hasDecreaseKeyword);

          return {
            insight,
            numericValue,
            isIncrease,
            isDecrease,
            index,
          };
        })
        .filter(Boolean);

      const sortByNumericDesc = (a, b) => {
        const aVal = Number.isFinite(a.numericValue)
          ? a.numericValue
          : Number.NEGATIVE_INFINITY;
        const bVal = Number.isFinite(b.numericValue)
          ? b.numericValue
          : Number.NEGATIVE_INFINITY;
        if (bVal !== aVal) {
          return bVal - aVal;
        }
        return a.index - b.index;
      };

      const positives = normalizedInsights
        .filter((entry) => entry.isIncrease && !entry.isDecrease)
        .sort(sortByNumericDesc);
      const negatives = normalizedInsights
        .filter((entry) => entry.isDecrease && !entry.isIncrease)
        .sort(sortByNumericDesc);
      const orderedInsights = [...positives, ...negatives];

      orderedInsights.forEach(({ insight, numericValue, isIncrease, isDecrease }) => {
        const item = document.createElement("div");
        item.className =
          "d-flex justify-content-between align-items-start gap-3 border rounded px-3 py-2";

        const left = document.createElement("div");
        left.className = "d-flex flex-wrap align-items-center gap-2";

        if (insight.etiqueta) {
          const badge = document.createElement("span");
          badge.textContent = insight.etiqueta;
          if (isIncrease) {
            badge.className = "badge fw-semibold";
            badge.style.backgroundColor = "#CCD32A";
            badge.style.color = "#004236";
          } else if (isDecrease) {
            badge.className = "badge fw-semibold";
            badge.style.backgroundColor = "#F7DB17";
            badge.style.color = "#4B3B00";
          } else {
            badge.className = "fw-semibold text-body";
          }
          left.appendChild(badge);
        }

        if (insight.mensaje) {
          const span = document.createElement("span");
          span.className = "text-body";
          span.textContent = insight.mensaje;
          left.appendChild(span);
        }

        item.appendChild(left);

        if (insight.valor) {
          const value = document.createElement("span");
          value.textContent = insight.valor;
          if (isIncrease) {
            value.className = "badge rounded-pill fw-semibold";
            value.style.backgroundColor = "#CCD32A";
            value.style.color = "#004236";
          } else if (isDecrease) {
            value.className = "badge rounded-pill fw-semibold";
            value.style.backgroundColor = "#F7DB17";
            value.style.color = "#4B3B00";
          } else {
            value.className = "fw-semibold text-muted";
          }
          item.appendChild(value);
        }

        list.appendChild(item);
      });
      body.appendChild(list);
    }

    if (
      panoramaData &&
      typeof panoramaData === "object" &&
      panoramaData.cta_text
    ) {
      const link = document.createElement("a");
      link.className =
        "text-decoration-none text-primary fw-semibold d-inline-flex align-items-center gap-2 mt-3";
      link.href = panoramaData.cta_href || "#";
      link.innerHTML = `${panoramaData.cta_text} <i class="fas fa-arrow-down"></i>`;
      body.appendChild(link);
    }

    card.appendChild(body);
    return card;
  }

  static createSummaryTableCard(summaryTable) {
    const card = document.createElement("div");
    card.className = "card mb-3";

    const header = document.createElement("div");
    header.className = "card-header bg-light";
    header.innerHTML = `
      <h6 class="mb-0">
        <i class="fas fa-table"></i>
        ${summaryTable.title || "Resumen Mes"}
      </h6>
    `;
    card.appendChild(header);

    const cardBody = document.createElement("div");
    cardBody.className = "card-body";
    cardBody.style.padding = "1.5rem";
    cardBody.style.overflow = "hidden";

    const mainTable = ReportCardFactory.buildMainSummaryTable(summaryTable);
    if (mainTable) {
      cardBody.appendChild(mainTable);
    }

    const layout = document.createElement("div");
    layout.className = "summary-grid";
    cardBody.appendChild(layout);

    const lossCard = ReportCardFactory.createVpLossTable(
      summaryTable.analysis_table || {}
    );
    if (lossCard) {
      layout.appendChild(lossCard);
    }

    const panoramaCard = ReportCardFactory.createPanoramaInsightsCard(
      summaryTable.panorama_general || null
    );
    if (panoramaCard) {
      layout.appendChild(panoramaCard);
    }

    const conclusionCard = ReportCardFactory.createConclusionCard(
      summaryTable.conclusion_items || []
    );
    if (conclusionCard) {
      layout.appendChild(conclusionCard);
    }

    const chartsData = summaryTable.charts || {};
    const plotlyAvailable = typeof Plotly !== "undefined";
    const chartsRow = document.createElement("div");
    chartsRow.className =
      "row gx-3 gy-4 w-100 justify-content-center summary-charts-row";
    let chartsAdded = false;

    if (chartsData.bar) {
      const barCol = document.createElement("div");
      barCol.className = "col-12 col-lg-6";
      const barCard = document.createElement("div");
      barCard.className = "card shadow-sm h-100 summary-chart-card";
      const barHeader = document.createElement("div");
      barHeader.className = "card-header bg-light";
      barHeader.innerHTML = `
        <h6 class="mb-0 d-flex align-items-center gap-2">
          <i class="fas fa-chart-bar text-custom-icon"></i>
          Desempeño por segmento
        </h6>
      `;
      barCard.appendChild(barHeader);
      const barBody = document.createElement("div");
      barBody.className = "card-body d-flex flex-column";
      const barContainer = document.createElement("div");
      barContainer.className = "summary-bar-chart flex-grow-1 w-100";
      barContainer.style.minHeight = "320px";
      barBody.appendChild(barContainer);
      barCard.appendChild(barBody);
      barCol.appendChild(barCard);
      chartsRow.appendChild(barCol);
      chartsAdded = true;

      if (plotlyAvailable) {
        const barX = Array.isArray(chartsData.bar.x) ? chartsData.bar.x : [];
        const allowedSeriesConfig = {
          real_sept: { label: "Prod. Reportada", color: "#004236" },
          proy_sept: { label: "Prod. Programada", color: "#CCD32A" },
          meta_sept: { label: "Meta del Mes", color: "#F7DB17" },
          meta_747: { label: "Meta (747)", color: "#FF5F00" },
          meta_s747: { label: "Meta (747)", color: "#FF5F00" },
          reto_755: { label: "Reto (755)", color: "#00214D" },
          reto_761: { label: "Reto (761)", color: "#c3c5c6" },
        };
        const normalizeKey = (name) =>
          (name || "").replace(/[^\w]/g, "").toLowerCase();
        const allowedKeys = Object.keys(allowedSeriesConfig);
        const discardedSeries = [];
        const barSeries = Array.isArray(chartsData.bar.series)
          ? chartsData.bar.series
              .map((serie) => {
                if (!serie || !Array.isArray(serie.values)) {
                  return null;
                }
                const normalizedName = normalizeKey(serie.name);
                if (!allowedKeys.includes(normalizedName)) {
                  discardedSeries.push(serie?.name ?? "(sin nombre)");
                  return null;
                }
                const config = allowedSeriesConfig[normalizedName];
                if (
                  !serie.values.some(
                    (value) => value !== null && value !== undefined
                  )
                ) {
                  return null;
                }
                return {
                  ...serie,
                  name: config.label,
                  marker: { ...(serie.marker || {}), color: config.color },
                };
              })
              .filter(Boolean)
          : [];
        if (discardedSeries.length) {
          console.debug(
            "[SummaryChart] Series omitidas en gráfico de barras:",
            discardedSeries
          );
        }
        const barTraces = barSeries.map((serie) => {
          const yValues = serie.values.map((value) => {
            if (value === null || value === undefined) return null;
            const numeric = typeof value === "number" ? value : Number(value);
            return Number.isFinite(numeric) ? numeric : null;
          });
          return {
            type: "bar",
            x: barX,
            y: yValues,
            name: serie.name || "Serie",
            marker: serie.marker || undefined,
            hovertemplate:
              "<b>%{x}</b><br>" +
              `${serie.name || "Valor"}: %{y:.1f}<extra></extra>`,
          };
        });
        if (barTraces.length) {
          const barLayout = {
            barmode: "group",
            bargap: 0.05,
            bargroupgap: 0.03,
            margin: { l: 50, r: 20, t: 40, b: 60 },
            legend: { orientation: "h", x: 0, y: -0.25 },
            plot_bgcolor: "rgba(0,0,0,0)",
            paper_bgcolor: "rgba(0,0,0,0)",
            xaxis: { tickfont: { size: 12 } },
            yaxis: { tickformat: ",.1f", zeroline: true, zerolinecolor: "#CCCCCC" },
          };
          const barConfig = { responsive: true, displayModeBar: false };
          requestAnimationFrame(() => {
            Plotly.newPlot(barContainer, barTraces, barLayout, barConfig);
            Plotly.Plots.resize(barContainer).catch(() => {});
          });
        } else {
          barContainer.textContent =
            "No hay datos disponibles para el gr�fico de barras.";
          barContainer.classList.add("text-muted", "text-center", "py-3");
        }
      } else {
        barContainer.textContent =
          "Gr�fico de barras no disponible (Plotly no cargado).";
        barContainer.classList.add("text-muted", "text-center", "py-3");
      }
    }

    if (chartsData.radar) {
      const radarCol = document.createElement("div");
      radarCol.className = "col-12 col-lg-6";
      const radarCard = document.createElement("div");
      radarCard.className = "card shadow-sm h-100 summary-chart-card";
      const radarHeader = document.createElement("div");
      radarHeader.className = "card-header bg-light";
      radarHeader.innerHTML = `
        <h6 class="mb-0 d-flex align-items-center gap-2">
          <i class="fas fa-radar text-custom-icon"></i>
          Distribución relativa
        </h6>
      `;
      radarCard.appendChild(radarHeader);
      const radarBody = document.createElement("div");
      radarBody.className = "card-body d-flex flex-column";
      const radarContainer = document.createElement("div");
      radarContainer.className = "summary-radar-chart flex-grow-1 w-100";
      radarContainer.style.minHeight = "360px";
      radarBody.appendChild(radarContainer);
      radarCard.appendChild(radarBody);
      radarCol.appendChild(radarCard);
      chartsRow.appendChild(radarCol);
      chartsAdded = true;

      if (plotlyAvailable) {
        const categories = Array.isArray(chartsData.radar.categories)
          ? chartsData.radar.categories
          : [];
        const radarSeries = Array.isArray(chartsData.radar.series)
          ? chartsData.radar.series
          : [];
        const defaultStyle = {
          line: "#1f77b4",
          fill: "rgba(31, 119, 180, 0.2)",
        };
        const radarTraces = radarSeries
          .filter(
            (serie) =>
              serie &&
              Array.isArray(serie.values) &&
              serie.values.some((value) => value !== null && value !== undefined)
          )
          .map((serie) => {
            const baseValues = serie.values.map((value) => {
              if (value === null || value === undefined) return 0;
              const numeric =
                typeof value === "number" ? value : Number(value);
              return Number.isFinite(numeric) ? numeric : 0;
            });
            const closedValues = [
              ...baseValues,
              baseValues.length > 0 ? baseValues[0] : 0,
            ];
            const closedCategories =
              categories.length > 0 ? [...categories, categories[0]] : [];
            const style = {
              line: serie?.style?.line_color || defaultStyle.line,
              fill: serie?.style?.fill_color || defaultStyle.fill,
            };
            return {
              type: "scatterpolar",
              r: closedValues,
              theta: closedCategories,
              fill: "toself",
              fillcolor: style.fill,
              line: { color: style.line, width: 2 },
              marker: { color: style.line },
              name: serie.name || "Serie",
              hovertemplate:
                "<b>%{theta}</b><br>" +
                `${serie.name || "Valor"}: %{r:.1f}<extra></extra>`,
            };
          });
        if (radarTraces.length) {
          const radarLayout = {
            margin: { l: 40, r: 40, t: 40, b: 40 },
            legend: { orientation: "h", x: 0, y: -0.2 },
            plot_bgcolor: "rgba(0,0,0,0)",
            paper_bgcolor: "rgba(0,0,0,0)",
            polar: {
              radialaxis: { visible: true, tickformat: ",.1f", gridcolor: "#E0E0E0" },
              angularaxis: { tickfont: { size: 11 }, gridcolor: "#E0E0E0" },
            },
          };
          const radarConfig = { responsive: true, displayModeBar: false };
          requestAnimationFrame(() => {
            Plotly.newPlot(radarContainer, radarTraces, radarLayout, radarConfig);
            Plotly.Plots.resize(radarContainer).catch(() => {});
          });
        } else {
          radarContainer.textContent =
            "No hay datos disponibles para el gr�fico radar.";
          radarContainer.classList.add("text-muted", "text-center", "py-3");
        }
      } else {
        radarContainer.textContent =
          "Gr�fico radar no disponible (Plotly no cargado).";
        radarContainer.classList.add("text-muted", "text-center", "py-3");
      }
    }

    if (chartsAdded) {
      cardBody.appendChild(chartsRow);
    }

    card.appendChild(cardBody);
    return card;
  }

  static buildTableCard(dataset, { iconClass, defaultTitle }) {
    if (
      !dataset ||
      !Array.isArray(dataset.headers) ||
      !dataset.headers.length
    ) {
      return null;
    }

    const card = document.createElement("div");
    card.className = "card mb-3";

    const header = document.createElement("div");
    header.className = "card-header bg-light";
    header.innerHTML = `
      <h6 class="mb-0">
        <i class="fas ${iconClass} me-2"></i>
        ${dataset.title || defaultTitle}
      </h6>
    `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body p-0";
    body.style.overflowX = "auto";

    const table = document.createElement("table");
    table.className = "table table-striped table-sm mb-0";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    dataset.headers.forEach((column) => {
      const th = document.createElement("th");
      th.textContent = column.label || column.key;
      th.className = "text-center align-middle";
      th.style.padding = "0.55rem";
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const isVariationColumn = (column) => {
      const key = String(column.key || "").toLowerCase();
      const label = String(column.label || "").toLowerCase();
      return (
        key === "var_pct" ||
        key.includes("var_pct") ||
        label.includes("variación") ||
        label.includes("variacion")
      );
    };

    (dataset.rows || []).forEach((row) => {
      const tr = document.createElement("tr");
      dataset.headers.forEach((column) => {
        const td = document.createElement("td");
        const rawValue = row[column.key];
        let displayValue = rawValue;
        if (typeof rawValue === "number") {
          displayValue = rawValue.toLocaleString("es-ES", {
            minimumFractionDigits: 1,
          });
        }
        td.textContent = String(displayValue ?? "-");

        if (isVariationColumn(column)) {
          let numericValue;
            if (typeof rawValue === "number") {
              numericValue = rawValue;
            } else if (typeof rawValue === "string") {
              const normalized = rawValue
                .replace(/\s+/g, "")
                .replace(/\./g, "")
              .replace(",", ".");
            numericValue = Number(normalized);
          } else {
            numericValue = Number(rawValue);
          }

          if (Number.isFinite(numericValue) && numericValue !== 0) {
            td.style.color = numericValue < 0 ? "#D32F2F" : "#004236";
          }
        }

        td.className = "text-center align-middle";
        td.style.padding = "0.55rem";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.appendChild(table);
    card.appendChild(body);

    return { card, body };
  }

  static buildVariationChartCard(chartPayload, options) {
    if (
      !chartPayload ||
      !Array.isArray(chartPayload.x) ||
      !Array.isArray(chartPayload.y)
    ) {
      return null;
    }

    const {
      title,
      containerClass,
      canvasClass,
      defaultColor,
      lineColor,
      colorResolver,
      textFormatter,
      textPosition = "auto",
      textFont,
    } = options;

    const chartCard = document.createElement("div");
    chartCard.className = "card summary-chart-card mt-3";
    if (title) {
      const chartHeader = document.createElement("div");
      chartHeader.className = "card-header bg-light";
      chartHeader.innerHTML = `
        <h6 class="mb-0 d-flex align-items-center gap-2">
          <i class="fas fa-chart-bar text-custom-icon"></i>
          ${title}
        </h6>
      `;
      chartCard.appendChild(chartHeader);
    }

    const chartBody = document.createElement("div");
    chartBody.className = "card-body";
    chartBody.style.minHeight = "320px";

    const chartWrapper = document.createElement("div");
    chartWrapper.className = `p-3 pt-4 ${containerClass}`;
    chartWrapper.style.width = "100%";
    chartWrapper.style.maxWidth = "100%";
    chartWrapper.style.overflow = "hidden";
    chartBody.appendChild(chartWrapper);

    const chartContainer = document.createElement("div");
    chartContainer.style.minHeight = "320px";
    chartContainer.style.width = "100%";
    chartContainer.style.maxWidth = "100%";
    chartContainer.style.overflow = "hidden";
    chartContainer.className = canvasClass;
    chartWrapper.appendChild(chartContainer);

    chartCard.appendChild(chartBody);

    if (typeof Plotly !== "undefined") {
      const orientation = chartPayload.orientation === "v" ? "v" : "h";
      const xValues = Array.isArray(chartPayload.x) ? chartPayload.x : [];
      const yValues = Array.isArray(chartPayload.y) ? chartPayload.y : [];

      const trace = {
        type: "bar",
        orientation,
        marker: {
          line: { color: lineColor, width: 0.5 },
        },
        hovertemplate:
          chartPayload.hovertemplate ||
          `<b>%{y}</b><br>Variación: %{x:.2f}${chartPayload.x_suffix || ""}<extra></extra>`,
      };

      if (orientation === "h") {
        trace.x = xValues;
        trace.y = yValues;
      } else {
        trace.x = yValues;
        trace.y = xValues;
      }

      const resolvedColor = colorResolver
        ? colorResolver(
            orientation === "h" ? xValues : yValues,
            chartPayload
          )
        : null;

      trace.marker.color =
        resolvedColor ||
        (Array.isArray(chartPayload.colors)
          ? chartPayload.colors
          : chartPayload.color || defaultColor);

      if (typeof textFormatter === "function") {
        const valuesForText = orientation === "h" ? trace.x : trace.y;
        trace.text = valuesForText.map((value, index) => {
          const formatted = textFormatter(value, index);
          return typeof formatted === "string" ? formatted : "";
        });
        trace.textposition = textPosition;
        if (textFont) {
          trace.textfont = textFont;
        }
      }

      const layout = {
        margin: { l: 80, r: 30, t: 10, b: 60 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        xaxis: {
          title:
            chartPayload.x_axis_label ||
            `Variación ${chartPayload.x_suffix || "%"}`,
          zeroline: true,
          zerolinecolor: "#CCCCCC",
          tickformat: chartPayload.x_format || ",.2f",
        },
        yaxis: {
          title: chartPayload.y_axis_label || "Gerencia",
          automargin: true,
        },
        showlegend: false,
      };

      if (orientation === "h" && Array.isArray(trace.x) && trace.x.length) {
        const numericValues = trace.x
          .map((value) => {
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
          })
          .filter((value) => value !== null);

        if (numericValues.length === trace.x.length) {
          const minValue = Math.min(...numericValues);
          const maxValue = Math.max(...numericValues);

          const dataRange = Math.max(maxValue - minValue, 1);
          let padding = dataRange * 0.1;

          if (minValue < 0 && maxValue > 0) {
            const maxAbs = Math.max(Math.abs(minValue), Math.abs(maxValue));
            const asymmetry = Math.abs(Math.abs(maxValue) - Math.abs(minValue));
            if (asymmetry / (maxAbs || 1) > 0.2) {
              padding = dataRange * 0.2;
            }
            layout.xaxis.range = [minValue - padding, maxValue + padding];
          } else {
            padding = Math.max(padding, Math.abs(maxValue) * 0.1);
            layout.xaxis.range = [minValue - padding, maxValue + padding];
          }

          layout.xaxis.zeroline = true;
          layout.xaxis.autorange = false;
        }
      }

      if (chartPayload.layout) {
        const sanitizedLayout = { ...chartPayload.layout };
        if (sanitizedLayout.title) {
          delete sanitizedLayout.title;
        }
        Object.assign(layout, sanitizedLayout);
      }
      const config = { responsive: true, displayModeBar: false };

      requestAnimationFrame(() => {
        Plotly.newPlot(chartContainer, [trace], layout, config);
        Plotly.Plots.resize(chartContainer).catch(() => {});
      });
    } else {
      chartContainer.textContent =
        "Plotly no está disponible para renderizar el gráfico.";
      chartContainer.classList.add("text-muted", "text-center", "py-4");
    }

    return chartCard;
  }

  static createProductionTypesCardComponents(productionTypesTable) {
    const tableResult = ReportCardFactory.buildTableCard(productionTypesTable, {
      iconClass: "fa-industry",
      defaultTitle: "Producción por Tipo",
    });

    if (!tableResult) {
      return null;
    }

    const chartPayload = productionTypesTable.chart;
    const chartCard = ReportCardFactory.buildVariationChartCard(
      chartPayload,
      {
        title:
          chartPayload?.title ||
          productionTypesTable.title ||
          "Variación por Gerencia",
        containerClass: "production-types-variation-chart",
        canvasClass: "production-types-variation-chart-canvas",
        defaultColor: "#E67E22",
        lineColor: "#333333",
        colorResolver: (values, payload) => {
          if (Array.isArray(payload?.colors)) {
            return payload.colors;
          }
          return payload?.color || "#E67E22";
        },
        textFormatter: (value) => {
          const numericValue = Number(value);
          if (!Number.isFinite(numericValue)) {
            return "";
          }
          return `${numericValue.toFixed(1)}%`;
        },
        textPosition: "outside",
        textFont: { size: 12, color: "#4b4b4b" },
      }
    );

    return {
      tableCard: tableResult.card,
      chartCard: chartCard || null,
    };
  }

  static createProductionTypesCard(productionTypesTable) {
    const components =
      ReportCardFactory.createProductionTypesCardComponents(
        productionTypesTable
      );
    if (!components) {
      return null;
    }

    const { tableCard, chartCard } = components;
    if (chartCard) {
      const body = tableCard.querySelector(".card-body");
      if (body) {
        const wrapper = document.createElement("div");
        wrapper.className = "mt-3";
        wrapper.appendChild(chartCard);
        body.appendChild(wrapper);
      }
    }
    return tableCard;
  }

  static renderProductionAnalysisTab(container, options = {}) {
    if (!container) {
      return;
    }

    container.innerHTML = "";

    const {
      sections = [],
      emptyMessage = `
        <i class="fas fa-info-circle me-2"></i>
        No hay datos programados disponibles para mostrar.
      `,
      rowClass = "row g-3 align-items-stretch",
      columnClass = "col-12 col-lg-4",
    } = options || {};

    const createColumn = (content) => {
      const col = document.createElement("div");
      col.className = `${columnClass} d-flex flex-column`;

      if (content) {
        if (content.classList?.contains("mt-3")) {
          content.classList.remove("mt-3");
        }
        content.classList?.add("h-100");
        col.appendChild(content);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "h-100";
        col.appendChild(placeholder);
      }

      return col;
    };

    let renderedRows = 0;

    sections.forEach((section) => {
      const dataset = section?.dataset;
      if (
        !dataset ||
        !Array.isArray(dataset.headers) ||
        !dataset.headers.length ||
        !Array.isArray(dataset.rows) ||
        !dataset.rows.length
      ) {
        return;
      }

      const componentBuilder =
        typeof section?.componentBuilder === "function"
          ? section.componentBuilder
          : ReportCardFactory.createAnalysisGerenciaCardComponents;
      const components = componentBuilder(dataset);
      if (!components) {
        return;
      }

      const { tableCard = null, chartCard = null } = components;
      if (!tableCard && !chartCard) {
        return;
      }

      const row = document.createElement("div");
      row.className = rowClass;

      row.appendChild(tableCard ? createColumn(tableCard) : createColumn());
      row.appendChild(chartCard ? createColumn(chartCard) : createColumn());

      const panoramaResolver =
        typeof section?.panoramaResolver === "function"
          ? section.panoramaResolver
          : null;

      const rawPanorama =
        (panoramaResolver ? panoramaResolver(dataset) : null) ??
        section?.panoramaData ??
        dataset?.panorama_general ??
        null;

      const panoramaPayload =
        rawPanorama && typeof rawPanorama === "object"
          ? { ...rawPanorama }
          : {};

      const panoramaTitle =
        section?.panoramaTitle ||
        panoramaPayload.titulo ||
        "Panorama General";

      if (!panoramaPayload.titulo) {
        panoramaPayload.titulo = panoramaTitle;
      }

      const panoramaCard =
        ReportCardFactory.createPanoramaInsightsCard(panoramaPayload);

      row.appendChild(createColumn(panoramaCard));

      container.appendChild(row);
      renderedRows += 1;
    });

    if (renderedRows === 0) {
      const placeholder = document.createElement("div");
      placeholder.className = "alert alert-info";
      placeholder.innerHTML = emptyMessage;
      container.appendChild(placeholder);
    }
  }

  static createAnalysisGerenciaCardComponents(analysisTable) {
    const tableResult = ReportCardFactory.buildTableCard(analysisTable, {
      iconClass: "fa-chart-line",
      defaultTitle: "Análisis / Gerencia",
    });

    if (!tableResult) {
      return null;
    }

    const chartPayload = analysisTable.chart;
    const chartCard = ReportCardFactory.buildVariationChartCard(
      chartPayload,
      {
        title:
          chartPayload?.title ||
          analysisTable.title ||
          "Variación por Gerencia",
        containerClass: "analysis-variation-chart",
        canvasClass: "analysis-variation-chart-canvas",
        defaultColor: "#F39C12",
        lineColor: "#8E5400",
        colorResolver: (values, payload) => {
          const chartTitle = (payload?.title || analysisTable.title || "")
            .toString()
            .toLowerCase();
          const isCrudo = chartTitle.includes("crudo");
          if (!isCrudo) {
            return null;
          }

          return values.map((value) => {
            const numericValue = Number(value);
            if (Number.isFinite(numericValue) && numericValue < 0) {
              return "#FF5F00";
            }
            return "#CCD32A";
          });
        },
        textFormatter: (value) => {
          const numericValue = Number(value);
          if (!Number.isFinite(numericValue)) {
            return "";
          }
          return `${numericValue.toFixed(1)}%`;
        },
        textPosition: "outside",
        textFont: { size: 12, color: "#4b4b4b" },
      }
    );

    return {
      tableCard: tableResult.card,
      chartCard: chartCard || null,
    };
  }

  static createAnalysisGerenciaCard(analysisTable) {
    const components =
      ReportCardFactory.createAnalysisGerenciaCardComponents(analysisTable);
    if (!components) {
      return null;
    }

    const { tableCard, chartCard } = components;
    if (chartCard) {
      const body = tableCard.querySelector(".card-body");
      if (body) {
        const wrapper = document.createElement("div");
        wrapper.className = "mt-3";
        wrapper.appendChild(chartCard);
        body.appendChild(wrapper);
      }
    }
    return tableCard;
  }
}

if (typeof window !== "undefined") {
  window.ReportCardFactory = ReportCardFactory;
}
