/**
 * 📊 Monthly Balance Report
 *
 * Reporte especializado para "Balance (mes)" con tabs.
 * Tab 1: Cards de comportamiento de producto (Análisis Gerencia + Producción por Tipo)
 * Tab 2: Producción: Meta vs Real
 * Tab 3: Producción: POP vs Real (placeholder)
 *
 * @author Claude Code
 * @version 1.0.0
 */

class MonthlyBalanceReport {
  constructor() {
    this.reportId = `monthly-balance-${Date.now()}`;
    this.tabManager = null;
  }

  /**
   * Renderiza el reporte completo con tabs
   *
   * @param {HTMLElement} container - Contenedor donde se renderiza el reporte
   * @param {Object} data - Datos del reporte
   * @param {Object} data.chartData - Datos del gráfico de balance mensual (opcional)
   * @param {Object} data.summaryTable - Tabla de resumen mensual (opcional)
   * @param {Object} data.analysisTable - Tabla de análisis gerencial
   * @param {Object} data.productionTypesTable - Tabla de producción por tipo
   */
  renderWithTabs(container, data) {
    console.log("📊 MonthlyBalanceReport.renderWithTabs llamado con:", data);

    if (!container) {
      console.error("❌ Container no proporcionado");
      return;
    }

    // Limpiar contenedor
    container.innerHTML = "";

    // Crear configuración de tabs
    const tabsConfig = {
      containerId: `${this.reportId}-tabs`,
      tabs: [
        {
          id: "comportamiento-producto",
          title: "Producción: Mes vs Mes",
          icon: "fa-chart-pie",
          active: true,
          contentRenderer: (tabPane) => this.createTab1Content(tabPane, data),
        },
        {
          id: "analisis-produccion",
          title: "Producción: Meta vs Real",
          icon: "fa-chart-pie",
          active: false,
          contentRenderer: (tabPane) => this.createProductionAnalysisTab(tabPane, data),
        },
        {
          id: "proyecciones",
          title: "Producción: POP vs Real",
          icon: "fa-chart-line",
          active: false,
          contentRenderer: (tabPane) => this.createTab2Content(tabPane, data),
        },
      ],
    };

    // Crear tabs usando ReportTabManager
    this.tabManager = new ReportTabManager(this.reportId);
    const tabsContainer = this.tabManager.createTabContainer(tabsConfig);

    if (tabsContainer) {
      container.appendChild(tabsContainer);
      console.log("✅ Tabs de balance mensual creados exitosamente");
    } else {
      console.error("❌ Error creando tabs");
    }
  }

  /**
   * Crea el contenido del Tab 1: Cards de comportamiento
   * @private
   */
  createTab1Content(container, data) {
    console.log("Creando contenido Tab 1 - Producción: Mes vs Mes");
    console.log("Datos recibidos:", {
      hasAnalysisTable: !!data.analysisTable,
      analysisTableKeys: data.analysisTable ? Object.keys(data.analysisTable) : [],
      analysisTableRows: data.analysisTable?.rows?.length || 0,
      hasProductionTypesTable: !!data.productionTypesTable,
      productionTypesTableKeys: data.productionTypesTable ? Object.keys(data.productionTypesTable) : [],
      productionTypesTableRows: data.productionTypesTable?.rows?.length || 0
    });

    const conclusionText =
      data?.conclusionIntegrated || data?.conclusion_integrada || "";

    const gridContainer = document.createElement("div");
    gridContainer.style.display = "grid";
    gridContainer.style.gridTemplateColumns = "repeat(auto-fit, minmax(320px, 1fr))";
    gridContainer.style.gap = "1.5rem";
    gridContainer.style.alignItems = "start";

    const chartCards = [];

    const appendColumn = (components, label) => {
      if (!components || !components.tableCard) {
        console.warn("No se pudieron construir componentes para", label);
        return false;
      }
      const column = document.createElement("div");
      column.style.display = "flex";
      column.style.flexDirection = "column";
      column.style.gap = "1rem";
      column.appendChild(components.tableCard);
      gridContainer.appendChild(column);
      if (components.chartCard) {
        chartCards.push(components.chartCard);
      }
      return true;
    };

    let renderedColumns = 0;

    if (data.analysisTable && data.analysisTable.rows && data.analysisTable.rows.length > 0) {
      const analysisComponents = ReportCardFactory.createAnalysisGerenciaCardComponents(
        data.analysisTable
      );
      if (appendColumn(analysisComponents, "analisis gerencial")) {
        renderedColumns += 1;
      }
    } else {
      console.warn("No hay datos de analisis gerencial:", data.analysisTable);
    }

    if (data.productionTypesTable && data.productionTypesTable.rows && data.productionTypesTable.rows.length > 0) {
      const productionComponents = ReportCardFactory.createProductionTypesCardComponents(
        data.productionTypesTable
      );
      if (appendColumn(productionComponents, "produccion por tipo")) {
        renderedColumns += 1;
      }
    } else {
      console.warn("No hay datos de produccion por tipo:", data.productionTypesTable);
    }

    if (renderedColumns > 0) {
      container.appendChild(gridContainer);
    } else {
      const emptyState = document.createElement("div");
      emptyState.className = "alert alert-info mt-3";
      emptyState.innerHTML = `
        <i class="fas fa-info-circle me-2"></i>
        No hay datos de comportamiento de producto disponibles
      `;
      container.appendChild(emptyState);
    }

    const shouldRenderVariabilityCard = chartCards.length > 0 || (conclusionText && conclusionText.trim().length);
    if (shouldRenderVariabilityCard) {
      const variabilityCard = document.createElement("div");
      variabilityCard.className = "card mb-3 w-100";

      const variabilityHeader = document.createElement("div");
      variabilityHeader.className = "card-header bg-light";
      variabilityHeader.innerHTML = `
        <h6 class="mb-0">
          <i class="fas fa-wave-square me-2"></i>
          Analisis Variabilidad
        </h6>
      `;
      variabilityCard.appendChild(variabilityHeader);

      const variabilityBody = document.createElement("div");
      variabilityBody.className = "card-body";

      if (chartCards.length > 0) {
        const chartsRow = document.createElement("div");
        chartsRow.style.display = "grid";
        chartsRow.style.gridTemplateColumns =
          chartCards.length > 1 ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr";
        chartsRow.style.gap = "1rem";
        chartCards.forEach((chartCard) => {
          chartCard.classList.remove("mt-3");
          chartsRow.appendChild(chartCard);
        });
        variabilityBody.appendChild(chartsRow);
      }

      const conclusionCard = document.createElement("div");
      conclusionCard.className = "card mt-3";
      conclusionCard.style.backgroundColor = "#EDEDED";
      const conclusionHeader = document.createElement("div");
      conclusionHeader.className = "card-header bg-light";
      conclusionHeader.innerHTML = `
        <h6 class="mb-0">
          <i class="fas fa-lightbulb me-2"></i>
          Conclusión Integrada
        </h6>
      `;
      conclusionCard.appendChild(conclusionHeader);
      const conclusionBody = document.createElement("div");
      conclusionBody.className = "card-body";
      conclusionBody.style.backgroundColor = "#EDEDED";
      conclusionBody.style.minHeight = "120px";
      if (conclusionText && typeof conclusionText === "string" && conclusionText.trim()) {
        conclusionText
          .split(/\n+/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .forEach((paragraph) => {
            const p = document.createElement("p");
            p.className = "mb-3";
            p.textContent = paragraph;
            conclusionBody.appendChild(p);
          });
      } else {
        const placeholder = document.createElement("p");
        placeholder.className = "text-muted mb-0";
        placeholder.textContent =
          "Sin conclusión integrada disponible. Verifica la conexión con el modelo.";
        conclusionBody.appendChild(placeholder);
      }
      conclusionCard.appendChild(conclusionBody);

      variabilityBody.appendChild(conclusionCard);
      variabilityCard.appendChild(variabilityBody);
      container.appendChild(variabilityCard);
    }

    const distributionCard = document.createElement("div");
    distributionCard.className = "card mb-3 w-100";

    const distributionHeader = document.createElement("div");
    distributionHeader.className = "card-header bg-light";
    distributionHeader.innerHTML = `
      <h6 class="mb-0">
        <i class="fas fa-chart-pie me-2"></i>
        Analisis Distribución Relativa
      </h6>
    `;
    distributionCard.appendChild(distributionHeader);

    const distributionBody = document.createElement("div");
    distributionBody.className = "card-body";

    const distributionRow = document.createElement("div");
    distributionRow.style.display = "grid";
    distributionRow.style.gridTemplateColumns = "repeat(auto-fit, minmax(320px, 1fr))";
    distributionRow.style.gap = "1rem";

    const distributionRelative =
      data?.distributionRelative || data?.distribution_relative || {};
    const radarConclusionText =
      distributionRelative?.radar_conclusion ||
      distributionRelative?.radarConclusion ||
      "";

    const buildEmptyCard = (title, iconClass) => {
      const wrapper = document.createElement("div");
      wrapper.className = "card h-100";

      const header = document.createElement("div");
      header.className = "card-header bg-light";
      header.innerHTML = `
        <h6 class="mb-0">
          <i class="fas ${iconClass} me-2"></i>
          ${title}
        </h6>
      `;
      wrapper.appendChild(header);

      const body = document.createElement("div");
      body.className = "card-body";
      body.style.minHeight = "160px";
      wrapper.appendChild(body);

      return wrapper;
    };

    const buildRadarCard = (radarData, fallbackTitle, iconClass) => {
      const payloadValid =
        radarData &&
        Array.isArray(radarData.categories) &&
        radarData.categories.length &&
        Array.isArray(radarData.series) &&
        radarData.series.length;

      if (!payloadValid) {
        return buildEmptyCard(fallbackTitle, iconClass);
      }

      const resolvedSeries = radarData.series.find(
        (serie) =>
          serie &&
          Array.isArray(serie.values) &&
          serie.values.some(
            (value) => value !== null && value !== undefined && value !== ""
          )
      );

      if (!resolvedSeries) {
        return buildEmptyCard(fallbackTitle, iconClass);
      }

      const title = radarData.title || fallbackTitle;
      const categories = radarData.categories;
      const rawValues = resolvedSeries.values.map((value) => {
        const numeric = typeof value === "number" ? value : Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
      });

      const hasData = rawValues.some((value) => Number.isFinite(value) && value !== 0);
      if (!hasData) {
        return buildEmptyCard(fallbackTitle, iconClass);
      }

      const color = resolvedSeries.color || "#004236";
      const fillColor = resolvedSeries.fill || "rgba(0, 66, 54, 0.2)";
      const suffix = radarData.value_suffix || "";
      const valueFormat = radarData.value_format || ",.2f";

      const card = document.createElement("div");
      card.className = "card h-100";

      const header = document.createElement("div");
      header.className = "card-header bg-light";
      header.innerHTML = `
        <h6 class="mb-0">
          <i class="fas ${iconClass} me-2"></i>
          ${title}
        </h6>
      `;
      card.appendChild(header);

      const body = document.createElement("div");
      body.className = "card-body d-flex flex-column";

      const baseCategories = categories.slice();
      const baseValues = rawValues.slice();

      const controls = document.createElement("div");
      controls.className = "radar-filter-controls mb-3";
      controls.style.display = "flex";
      controls.style.flexWrap = "wrap";
      controls.style.alignItems = "center";
      controls.style.gap = "0.5rem";

      const controlsLabel = document.createElement("span");
      controlsLabel.className = "text-muted";
      controlsLabel.style.fontSize = "0.8rem";
      controlsLabel.textContent = "Gerencias:";
      controls.appendChild(controlsLabel);

      const controlsActions = document.createElement("div");
      controlsActions.style.display = "inline-flex";
      controlsActions.style.gap = "0.5rem";
      controls.appendChild(controlsActions);

      const checkboxContainer = document.createElement("div");
      checkboxContainer.style.display = "flex";
      checkboxContainer.style.flexWrap = "wrap";
      checkboxContainer.style.gap = "0.5rem";
      controls.appendChild(checkboxContainer);

      const chartContainer = document.createElement("div");
      chartContainer.className = "w-100 flex-grow-1";
      chartContainer.style.minHeight = "320px";
      chartContainer.dataset.chartType = "radar-bopd";

      body.appendChild(controls);
      body.appendChild(chartContainer);
      card.appendChild(body);

      if (typeof Plotly === "undefined") {
        chartContainer.textContent = "Gráfico radar no disponible (Plotly no cargado).";
        chartContainer.classList.add("text-muted", "text-center", "py-3");
        return card;
      }

      const selectedSet = new Set(baseCategories);
      const checkboxMap = new Map();

      const formatTickValue = (value) => {
        const number = Number(value);
        if (!Number.isFinite(number)) {
          return value;
        }
        if (Math.abs(number) >= 1e6) {
          return `${(number / 1e6).toFixed(1)}m`;
        }
        if (Math.abs(number) >= 1e3) {
          return `${(number / 1e3).toFixed(1)}k`;
        }
        if (Math.abs(number) >= 1) {
          return number.toFixed(0);
        }
        return number.toFixed(2);
      };

      const renderRadar = (filteredCategories, filteredValues) => {
        if (!filteredCategories.length || !filteredValues.length) {
          chartContainer.textContent = "Seleccione al menos una gerencia para visualizar.";
          chartContainer.classList.add("text-muted", "text-center", "py-3");
          if (typeof Plotly !== "undefined") {
            try {
              Plotly.purge(chartContainer);
            } catch (error) {
              console.warn("No se pudo limpiar el radar:", error);
            }
          }
          return;
        }

        chartContainer.classList.remove("text-muted", "text-center", "py-3");
        chartContainer.textContent = "";

        const paddedValues = [...filteredValues, filteredValues[0]];
        const paddedCategories = [...filteredCategories, filteredCategories[0]];
        const maxValue = Math.max(...filteredValues);
        const radialMax = maxValue === 0 ? 1 : maxValue * 1.1;
        const tickSteps = 5;
        const tickIncrement = radialMax / tickSteps;
        const tickValues = Array.from({ length: tickSteps + 1 }, (_, index) =>
          Number((tickIncrement * index).toFixed(2))
        );
        const tickTexts = tickValues.map((value) => formatTickValue(value));

        const trace = {
          type: "scatterpolar",
          mode: "lines",
          name: resolvedSeries.name || "Producción Septiembre",
          r: paddedValues,
          theta: paddedCategories,
          fill: "toself",
          fillcolor: fillColor,
          line: { color, width: 2 },
          marker: { color },
          hovertemplate:
            "<b>%{theta}</b><br>" +
            `Producción: %{r:${valueFormat}}${suffix}` +
            "<extra></extra>",
        };

        const layout = {
          showlegend: false,
          margin: { t: 20, r: 20, b: 20, l: 20 },
          paper_bgcolor: "white",
          plot_bgcolor: "white",
          font: { family: "Arial, sans-serif", color: "#2c3e50" },
          polar: {
            bgcolor: "white",
            angularaxis: {
              direction: "clockwise",
              rotation: 90,
              tickfont: { size: 11 },
            },
            radialaxis: {
              visible: true,
              range: [0, radialMax],
              tickfont: { size: 11, color: "#004236" },
              tickformat: "",
              ticksuffix: "",
              tickvals: tickValues,
              ticktext: tickTexts,
            },
          },
        };

        const config = { displayModeBar: false, responsive: true };

        try {
          const result = Plotly.newPlot(chartContainer, [trace], layout, config);
          const whenReady =
            result && typeof result.then === "function"
              ? result
              : Promise.resolve(result);
          whenReady
            .then(() => Plotly.Plots.resize(chartContainer).catch(() => {}))
            .catch((error) =>
              console.error("Error al renderizar radar:", error)
            );
        } catch (error) {
          console.error("Error creando gráfico radar:", error);
          chartContainer.textContent = "No fue posible renderizar el gráfico radar.";
          chartContainer.classList.add("text-muted", "text-center", "py-3");
        }
      };

      const renderCurrent = () => {
        const filteredCategories = [];
        const filteredValues = [];
        baseCategories.forEach((category, index) => {
          if (selectedSet.has(category)) {
            filteredCategories.push(category);
            filteredValues.push(baseValues[index]);
          }
        });
        renderRadar(filteredCategories, filteredValues);
      };

      const updateAllCheckboxes = (checked) => {
        selectedSet.clear();
        if (checked) {
          baseCategories.forEach((category) => selectedSet.add(category));
        }
        checkboxMap.forEach((checkbox) => {
          checkbox.checked = checked;
        });
        renderCurrent();
      };

      const selectAllButton = document.createElement("button");
      selectAllButton.type = "button";
      selectAllButton.className = "btn btn-sm btn-outline-secondary";
      selectAllButton.textContent = "Todas";
      selectAllButton.addEventListener("click", () => updateAllCheckboxes(true));
      controlsActions.appendChild(selectAllButton);

      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "btn btn-sm btn-outline-secondary";
      clearButton.textContent = "Limpiar";
      clearButton.addEventListener("click", () => updateAllCheckboxes(false));
      controlsActions.appendChild(clearButton);

      baseCategories.forEach((category) => {
        const optionLabel = document.createElement("label");
        optionLabel.style.display = "inline-flex";
        optionLabel.style.alignItems = "center";
        optionLabel.style.gap = "0.35rem";
        optionLabel.style.fontSize = "0.85rem";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = category;
        checkbox.checked = true;

        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            selectedSet.add(category);
          } else {
            selectedSet.delete(category);
          }
          renderCurrent();
        });

        optionLabel.appendChild(checkbox);
        optionLabel.appendChild(document.createTextNode(category));
        checkboxContainer.appendChild(optionLabel);
        checkboxMap.set(category, checkbox);
      });

      requestAnimationFrame(() => {
        if (document.body.contains(chartContainer)) {
          renderCurrent();
        } else {
          setTimeout(renderCurrent, 0);
        }
      });

      return card;
    };

    distributionRow.appendChild(
      buildRadarCard(
        distributionRelative?.crudo,
        "Producción Septiembre (BOPD) CRUDO",
        "fa-water"
      )
    );
    distributionRow.appendChild(
      buildRadarCard(
        distributionRelative?.blancos,
        "Producción Septiembre (BOPD) BLANCOS",
        "fa-flask"
      )
    );

    distributionBody.appendChild(distributionRow);

    const radarConclusionCard = document.createElement("div");
    radarConclusionCard.className = "card mt-3";
    radarConclusionCard.style.backgroundColor = "#EDEDED";
    const radarConclusionHeader = document.createElement("div");
    radarConclusionHeader.className = "card-header bg-light";
    radarConclusionHeader.innerHTML = `
      <h6 class="mb-0">
        <i class="fas fa-lightbulb me-2"></i>
        Conclusión Integrada Radar
      </h6>
    `;
    radarConclusionCard.appendChild(radarConclusionHeader);
    const radarConclusionBody = document.createElement("div");
    radarConclusionBody.className = "card-body";
    radarConclusionBody.style.backgroundColor = "#EDEDED";
    radarConclusionBody.style.minHeight = "120px";
    if (radarConclusionText && typeof radarConclusionText === "string") {
      radarConclusionText
        .split(/\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .forEach((paragraph) => {
          const p = document.createElement("p");
          p.className = "mb-3";
          p.textContent = paragraph;
          radarConclusionBody.appendChild(p);
        });
    }
    radarConclusionCard.appendChild(radarConclusionBody);
    distributionBody.appendChild(radarConclusionCard);

    distributionCard.appendChild(distributionBody);
    container.appendChild(distributionCard);

    console.log("Tab 1 renderizado");
  }
  /**
   * Crea el contenido del Tab 2: Producción: Meta vs Real
   * @private
   */
  createProductionAnalysisTab(container, data) {
    console.log("Creando contenido Tab 2 - Producción: Meta vs Real");

    if (!container) {
      console.warn("Contenedor no disponible para Producción: Meta vs Real");
      return;
    }

    ReportCardFactory.renderProductionAnalysisTab(container, {
      sections: [
        {
          dataset: data?.programmedAnalysisTable,
          panoramaTitle: "Crudo: Producción vs Meta Panorama General",
        },
        {
          dataset: data?.programmedBlancosTable,
          panoramaTitle: "Productos Blancos: Producción vs Meta Panorama General",
        },
      ],
    });
  }

  /**
   * Crea el contenido del Tab 3: Producción: POP vs Real
   * @private
   */
  createTab2Content(container, data) {
    console.log("📈 Creando contenido Tab 3 - Producción: POP vs Real");

    if (!container) {
      console.warn("Contenedor no disponible para Producción: POP vs Real");
      return;
    }

    const datasetCrudo =
      data?.popVsRealTable || data?.pop_vs_real_table || null;
    const datasetBlancos =
      data?.popBlancosVsRealTable || data?.pop_blancos_vs_real_table || null;

    const sections = [];

    const isValidDataset = (dataset) =>
      dataset &&
      Array.isArray(dataset.headers) &&
      dataset.headers.length &&
      Array.isArray(dataset.rows) &&
      dataset.rows.length;

    if (isValidDataset(datasetCrudo)) {
      sections.push({
        dataset: datasetCrudo,
        panoramaTitle:
          datasetCrudo?.panorama_general?.titulo ||
          "Crudo: Producción vs POP Panorama General",
      });
    }

    if (isValidDataset(datasetBlancos)) {
      sections.push({
        dataset: datasetBlancos,
        panoramaTitle:
          datasetBlancos?.panorama_general?.titulo ||
          "Productos Blancos: Producción vs POP Panorama General",
      });
    }

    if (!sections.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "alert alert-info";
      placeholder.innerHTML = `
        <i class="fas fa-info-circle me-2"></i>
        No hay datos disponibles para mostrar Producción vs POP.
      `;
      container.appendChild(placeholder);
      console.log("⚠️ Sin datos para Tab 3 - Producción: POP vs Real");
      return;
    }

    ReportCardFactory.renderProductionAnalysisTab(container, {
      sections,
    });

    console.log("✅ Tab 3 renderizado con datos de Producción vs POP");
  }


  /**
   * Renderiza el reporte de balance mensual usando la estructura legacy
   * (para compatibilidad con monthlyBalance.js existente)
   *
   * @param {HTMLElement} container - Contenedor
   * @param {Object} payload - Payload del backend
   */
  static renderLegacyReport(container, payload) {
    console.log("📊 Renderizando reporte legacy de balance mensual");

    if (!container) return;

    if (!payload || !payload.success) {
      console.warn("renderMonthlyBalanceReport: payload inválido");
      return;
    }

    container.innerHTML = "";
    const message = payload?.message || "Página en construcción";

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
      <p class="mb-0">Pronto se agregarán componentes para este reporte.</p>
    `;
    card.appendChild(body);

    container.appendChild(card);
  }

  /**
   * Limpia y destruye el reporte
   */
  destroy() {
    if (this.tabManager) {
      this.tabManager.destroy();
      this.tabManager = null;
    }
    console.log(`🗑️ MonthlyBalanceReport destruido: ${this.reportId}`);
  }
}

// Exponer en el scope global
if (typeof window !== "undefined") {
  window.MonthlyBalanceReport = MonthlyBalanceReport;
}
