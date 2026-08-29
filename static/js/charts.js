// Analytics Manager - Handle charts and analytics

class AnalyticsManager {
  constructor() {
    this.stats = {};
    this.currentData = null;
    this.currentChartRecommendations = [];
    this.activeCharts = new Map();
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.hideAnalytics(); // Start with empty state
  }

  setupEventListeners() {
    // Clear current chat
    document
      .getElementById("clear-current-chat")
      ?.addEventListener("click", () => {
        this.clearCurrentChat();
      });

    // Refresh analytics
    document
      .getElementById("refresh-analytics")
      ?.addEventListener("click", () => {
        this.loadStats();
      });

    // Cleanup deleted conversations
    document
      .getElementById("cleanup-deleted")
      ?.addEventListener("click", () => {
        this.cleanupDeleted();
      });

    // Export data
    document.getElementById("export-data")?.addEventListener("click", () => {
      this.exportData();
    });
  }

  async loadStats() {
    try {
      const response = await fetch("/chat/stats");
      const data = await response.json();

      if (data.success) {
        this.stats = data.stats;
        this.updateStatsDisplay();
        this.updateCharts();
      } else {
        console.error("Error loading stats:", data.error);
      }
    } catch (error) {
      console.error("Error loading analytics:", error);
      this.showStatsError();
    }
  }

  updateStatsDisplay() {
    // Update conversation and message counts (los contadores pueden no existir
    // en vistas que no son el dashboard de analytics → usar optional chaining)
    const convEl = document.getElementById("total-conversations");
    if (convEl) {
      convEl.textContent = this.stats.total_conversations || "0";
    }

    const msgEl = document.getElementById("total-messages");
    if (msgEl) {
      msgEl.textContent = AppManager.formatNumber(this.stats.total_messages || 0);
    }
  }

  updateCharts() {
    this.createMessagesChart();
    this.createDatabaseChart();
  }

  createMessagesChart() {
    const messagesChart = document.getElementById("messages-chart");
    if (!messagesChart || !this.stats.messages_by_role) return;

    const data = [
      {
        x: Object.keys(this.stats.messages_by_role),
        y: Object.values(this.stats.messages_by_role),
        type: "bar",
        marker: {
          color: ["#F7DB17", "#004236"],
        },
      },
    ];

    const layout = {
      title: {
        text: "Mensajes por Tipo",
        font: { size: 14 },
      },
      margin: { t: 40, l: 40, r: 20, b: 40 },
      height: 200,
      plot_bgcolor: "rgba(0,0,0,0)",
      paper_bgcolor: "rgba(0,0,0,0)",
      font: { size: 12 },
    };

    const config = {
      displayModeBar: false,
      responsive: true,
    };

    Plotly.newPlot(messagesChart, data, layout, config);
  }

  async createDatabaseChart() {
    const databaseChart = document.getElementById("database-chart");
    if (!databaseChart) return;

    try {
      // Get database info
      const response = await fetch("/api/database/info");
      const dbData = await response.json();

      if (dbData.success && dbData.tables) {
        const tableNames = Object.keys(dbData.tables).slice(0, 5);
        const recordCounts = tableNames.map(
          (name) => dbData.tables[name].row_count || 0
        );

        const data = [
          {
            x: tableNames,
            y: recordCounts,
            type: "bar",
            marker: {
              color: "#FF5F00",
            },
          },
        ];

        const layout = {
          title: {
            text: "Registros por Tabla",
            font: { size: 14 },
          },
          margin: { t: 40, l: 60, r: 20, b: 60 },
          height: 200,
          plot_bgcolor: "rgba(0,0,0,0)",
          paper_bgcolor: "rgba(0,0,0,0)",
          font: { size: 12 },
          xaxis: {
            tickangle: -45,
          },
        };

        const config = {
          displayModeBar: false,
          responsive: true,
        };

        Plotly.newPlot(databaseChart, data, layout, config);
      } else {
        this.showChartError(
          databaseChart,
          "No hay datos de la base de datos disponibles"
        );
      }
    } catch (error) {
      console.error("Error creating database chart:", error);
      this.showChartError(
        databaseChart,
        "Error cargando datos de la base de datos"
      );
    }
  }

  showChartError(chartElement, message) {
    chartElement.innerHTML = `
            <div class="text-center text-muted p-4">
                <i class="fas fa-chart-bar fa-2x mb-2"></i>
                <p class="mb-0 small">${message}</p>
            </div>
        `;
  }

  showStatsError() {
    const convEl = document.getElementById("total-conversations");
    if (convEl) convEl.textContent = "!";

    const msgEl = document.getElementById("total-messages");
    if (msgEl) msgEl.textContent = "!";

    const charts = ["messages-chart", "database-chart"];
    charts.forEach((chartId) => {
      const chart = document.getElementById(chartId);
      if (chart) {
        this.showChartError(chart, "Error cargando datos");
      }
    });
  }

  clearCurrentChat() {
    if (window.ChatManager) {
      window.ChatManager.clearCurrentChat();
      window.app?.showToast("Chat limpiado", "success");
    }
  }

  async cleanupDeleted() {
    try {
      // This would need to be implemented in the backend
      window.app?.showToast(
        "Funcionalidad de limpieza no implementada aún",
        "info"
      );
    } catch (error) {
      console.error("Error cleaning up:", error);
      window.app?.showToast("Error en la limpieza", "error");
    }
  }

  exportData() {
    // Simple CSV export of current stats
    if (!this.stats) {
      window.app?.showToast("No hay datos para exportar", "warning");
      return;
    }

    const csvData = this.generateCSV();
    this.downloadCSV(csvData, "ecp-insights-stats.csv");
    window.app?.showToast("Datos exportados", "success");
  }

  generateCSV() {
    const rows = [
      ["Metric", "Value"],
      ["Total Conversations", this.stats.total_conversations || 0],
      ["Total Messages", this.stats.total_messages || 0],
      ["Recent Conversations", this.stats.recent_conversations || 0],
    ];

    if (this.stats.messages_by_role) {
      Object.entries(this.stats.messages_by_role).forEach(([role, count]) => {
        rows.push([`Messages by ${role}`, count]);
      });
    }

    return rows.map((row) => row.join(",")).join("\n");
  }

  downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Method to create sample/demo charts when no data is available
  createDemoCharts() {
    // Demo messages chart
    const messagesChart = document.getElementById("messages-chart");
    if (messagesChart) {
      const data = [
        {
          x: ["Usuario", "Asistente"],
          y: [15, 18],
          type: "bar",
          marker: {
            color: ["#F7DB17", "#004236"],
          },
        },
      ];

      const layout = {
        title: {
          text: "Mensajes por Tipo (Demo)",
          font: { size: 14 },
        },
        margin: { t: 40, l: 40, r: 20, b: 40 },
        height: 200,
        plot_bgcolor: "rgba(0,0,0,0)",
        paper_bgcolor: "rgba(0,0,0,0)",
        font: { size: 12 },
      };

      const config = {
        displayModeBar: false,
        responsive: true,
      };

      Plotly.newPlot(messagesChart, data, layout, config);
    }

    // Demo database chart
    const databaseChart = document.getElementById("database-chart");
    if (databaseChart) {
      const data = [
        {
          x: ["Ventas", "Empleados", "Productos"],
          y: [5000, 500, 1200],
          type: "bar",
          marker: {
            color: "#FF5F00",
          },
        },
      ];

      const layout = {
        title: {
          text: "Registros por Tabla (Demo)",
          font: { size: 14 },
        },
        margin: { t: 40, l: 60, r: 20, b: 60 },
        height: 200,
        plot_bgcolor: "rgba(0,0,0,0)",
        paper_bgcolor: "rgba(0,0,0,0)",
        font: { size: 12 },
      };

      const config = {
        displayModeBar: false,
        responsive: true,
      };

      Plotly.newPlot(databaseChart, data, layout, config);
    }
  }

  // ===== PANEL 3 METHODS (NEW) =====

  // Process Panel 3 data from chat response
  processPanel3Data(panel3Data, sourceData = null) {
    console.log("🔍 Processing Panel 3 analytics data:", panel3Data);
    console.log("🔍 Source data:", sourceData);

    // Check if data is graphable
    if (!panel3Data || !panel3Data.success) {
      console.log("❌ Panel 3 data invalid or unsuccessful");
      this.hideAnalytics();
      return;
    }

    if (!panel3Data.is_graphable) {
      console.log("❌ Data not graphable, showing fallback");
      // Show fallback message for non-graphable data
      this.showFallbackMessage(
        panel3Data.fallback_message ||
          "Los datos no son aptos para generar gráficos"
      );
      return;
    }

    console.log("✅ Data is graphable, proceeding with button generation");

    // Store data for chart generation
    this.currentChartRecommendations = panel3Data.chart_recommendations || [];
    this.currentDynamicButtons = panel3Data.dynamic_buttons || [];
    this.currentSourceData = sourceData; // Store source data from Panel 1
    this.currentQueryType = panel3Data.query_type || "general";
    this.currentPetroleumMetrics = panel3Data.petroleum_metrics_found || [];

    console.log(
      `📊 Stored data - Dynamic buttons: ${this.currentDynamicButtons.length}, Recommendations: ${this.currentChartRecommendations.length}`
    );
    console.log("🎯 Query type:", this.currentQueryType);
    console.log("🔘 Dynamic buttons:", this.currentDynamicButtons);

    // Show/hide sections appropriately
    this.showAnalytics();

    // Generate dynamic chart buttons (prioritize dynamic buttons over legacy recommendations)
    if (this.currentDynamicButtons.length > 0) {
      console.log("✅ Generating dynamic buttons...");
      this.generateDynamicButtons();
    } else if (this.currentChartRecommendations.length > 0) {
      console.log("⚠️ No dynamic buttons, using legacy recommendations...");
      this.generateChartButtons(); // Fallback to legacy method
    } else {
      console.log("❌ No buttons to generate");
    }

    // Display any auto-generated charts
    if (panel3Data.auto_charts && panel3Data.auto_charts.length > 0) {
      this.displayAutoCharts(panel3Data.auto_charts);
    }
  }

  // Generate dynamic chart buttons (new enhanced method)
  generateDynamicButtons() {
    console.log(
      "🔘 generateDynamicButtons called with",
      this.currentDynamicButtons.length,
      "buttons"
    );

    const buttonsContainer = document.getElementById("chart-buttons-container");
    const buttonsSection = document.getElementById("chart-buttons-section");

    console.log("🔍 DOM elements found:", {
      buttonsContainer: !!buttonsContainer,
      buttonsSection: !!buttonsSection,
      buttonsCount: this.currentDynamicButtons.length,
    });

    if (!buttonsContainer || !this.currentDynamicButtons.length) {
      console.log("❌ Missing container or no buttons to generate");
      if (buttonsSection) buttonsSection.style.display = "none";
      return;
    }

    // Clear existing buttons
    buttonsContainer.innerHTML = "";
    console.log("🧹 Cleared existing buttons");

    // Create buttons for each dynamic recommendation
    this.currentDynamicButtons.forEach((btn, index) => {
      console.log(
        `🔘 Creating button ${index + 1}:`,
        btn.title,
        btn.chart_type
      );

      const button = document.createElement("button");
      button.className =
        btn.css_class || "btn btn-sm btn-outline-primary chart-trigger-btn";
      button.innerHTML = `
                <i class="fas fa-chart-${this.getChartIcon(
                  btn.chart_type
                )}"></i>
                ${btn.title}
            `;
      button.title = btn.description;
      button.dataset.buttonId = btn.id;
      button.dataset.chartIndex = index;
      button.dataset.chartType = btn.chart_type;
      button.dataset.buttonType = "dynamic";

      // Add click handler for dynamic buttons
      button.addEventListener("click", () =>
        this.generateChartFromDynamicButton(index)
      );

      buttonsContainer.appendChild(button);
      console.log(`✅ Button ${index + 1} added to container`);
    });

    buttonsSection.style.display = "block";
    console.log("✅ Buttons section made visible");
  }

  // Generate interactive chart buttons (legacy method for backwards compatibility)
  generateChartButtons() {
    const buttonsContainer = document.getElementById("chart-buttons-container");
    const buttonsSection = document.getElementById("chart-buttons-section");

    if (!buttonsContainer || !this.currentChartRecommendations.length) {
      buttonsSection.style.display = "none";
      return;
    }

    // Clear existing buttons
    buttonsContainer.innerHTML = "";

    // Create buttons for each recommendation
    this.currentChartRecommendations.forEach((rec, index) => {
      const button = document.createElement("button");
      button.className = "btn btn-sm btn-outline-primary chart-trigger-btn";
      button.innerHTML = `
                <i class="fas fa-chart-${this.getChartIcon(
                  rec.chart_type
                )}"></i>
                ${rec.title}
            `;
      button.title = rec.description;
      button.dataset.chartIndex = index;
      button.dataset.chartType = rec.chart_type;
      button.dataset.buttonType = "legacy";

      // Add click handler
      button.addEventListener("click", () =>
        this.generateChartFromButton(index)
      );

      buttonsContainer.appendChild(button);
    });

    buttonsSection.style.display = "block";
  }

  // Generate chart when dynamic button is clicked (new method)
  async generateChartFromDynamicButton(buttonIndex) {
    const dynamicButton = this.currentDynamicButtons[buttonIndex];
    if (!dynamicButton) return;

    const button = document.querySelector(
      `[data-chart-index="${buttonIndex}"][data-button-type="dynamic"]`
    );
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
    }

    try {
      // Show loading state
      this.showLoading();

      // Create chart from dynamic button configuration
      const chartConfig = this.createChartFromDynamicButton(
        dynamicButton,
        buttonIndex
      );

      if (chartConfig) {
        this.displayChart(chartConfig);

        // Mark button as used
        if (button) {
          button.classList.remove("btn-outline-primary");
          button.classList.add("btn-success");
          button.innerHTML = `<i class="fas fa-check"></i> ${dynamicButton.title}`;
        }

        // Store the generated chart
        this.activeCharts.set(chartConfig.id, chartConfig);
        window.app?.showToast("Gráfico creado exitosamente", "success");
      } else {
        console.error("❌ Chart configuration is null - chart not created");
        window.app?.showToast(
          "No se pudo crear el gráfico: Datos insuficientes",
          "warning"
        );
      }
    } catch (error) {
      console.error("Error generating dynamic chart:", error);
      window.app?.showToast(
        `Error generando gráfico: ${error.message}`,
        "error"
      );
    } finally {
      // Reset button state
      if (button) {
        button.disabled = false;
        if (!button.classList.contains("btn-success")) {
          button.innerHTML = `
                        <i class="fas fa-chart-${this.getChartIcon(
                          dynamicButton.chart_type
                        )}"></i>
                        ${dynamicButton.title}
                    `;
        }
      }
      this.hideLoading();
    }
  }

  // Create chart from dynamic button configuration
  createChartFromDynamicButton(dynamicButton, index) {
    const chartId = `dynamic_chart_${Date.now()}_${index}`;
    const config = dynamicButton.config || {};

    console.log("📊 Creating chart from dynamic button:", dynamicButton.title);
    console.log("🔍 Current source data available:", !!this.currentSourceData);
    console.log(
      "📊 Source data length:",
      this.currentSourceData ? this.currentSourceData.length : 0
    );
    console.log(
      "📊 Source data sample:",
      this.currentSourceData ? this.currentSourceData.slice(0, 2) : null
    );

    let chartConfig = {
      id: chartId,
      type: dynamicButton.chart_type,
      title: dynamicButton.title,
      description: dynamicButton.description,
    };

    // Only use real data - no fallbacks
    if (
      this.currentSourceData &&
      Array.isArray(this.currentSourceData) &&
      this.currentSourceData.length > 0
    ) {
      console.log("✅ Using real data for chart");
      chartConfig = this.createChartFromRealDataDynamic(dynamicButton, chartId);
    } else {
      console.error("❌ No real data available - chart creation aborted");
      console.error("❌ currentSourceData:", this.currentSourceData);
      return null; // Don't create chart without real data
    }

    return chartConfig;
  }

  // Create chart from real data using dynamic button config
  createChartFromRealDataDynamic(dynamicButton, chartId) {
    const data = this.currentSourceData;
    const config = dynamicButton.config || {};

    let chartConfig = {
      id: chartId,
      type: dynamicButton.chart_type,
      title: dynamicButton.title,
      description: dynamicButton.description,
    };

    console.log("🔧 Creating chart type:", dynamicButton.chart_type);
    console.log("🔧 Chart config:", config);
    console.log("🔧 Data sample:", data ? data.slice(0, 2) : "No data");

    switch (dynamicButton.chart_type) {
      case "bar":
      case "grouped_bar":
        return this.createRealBarChart(data, config, chartConfig);
      case "line":
      case "multi_line":
        return this.createRealLineChart(data, config, chartConfig);
      case "area":
        return this.createRealAreaChart(data, config, chartConfig);
      case "scatter":
        return this.createRealScatterChart(data, config, chartConfig);
      case "histogram":
        return this.createRealHistogramChart(data, config, chartConfig);
      case "box_plot":
        return this.createRealBoxPlotChart(data, config, chartConfig);
      case "heatmap":
      case "correlation_heatmap":
        return this.createRealHeatmapChart(data, config, chartConfig);
      case "dashboard":
        return this.createRealDashboardChart(data, config, chartConfig);
      case "subplot_combo":
        return this.createSubplotComboChart(data, config, chartConfig);
      case "horizontal_comparison_bar":
        return this.createHorizontalComparisonBarChart(data, config, chartConfig);
      case "multi_line_grouped":
        return this.createMultiLineGroupedChart(data, config, chartConfig);
      default:
        console.error("❌ Unsupported chart type:", dynamicButton.chart_type);
        return null;
    }
  }

  // Show fallback message for non-graphable data
  showFallbackMessage(message) {
    const emptyState = document.getElementById("analytics-empty-state");
    const buttonsSection = document.getElementById("chart-buttons-section");
    const chartsArea = document.getElementById("charts-display-area");

    // Hide buttons and charts
    if (buttonsSection) buttonsSection.style.display = "none";
    if (chartsArea) chartsArea.innerHTML = "";

    // Show custom fallback message
    if (emptyState) {
      emptyState.innerHTML = `
                <div class="text-center text-muted p-3">
                    <i class="fas fa-chart-bar fa-2x mb-2 text-warning"></i>
                    <div class="fallback-message">
                        ${message.replace(/\n/g, "<br>")}
                    </div>
                </div>
            `;
      emptyState.style.display = "block";
    }
  }

  // Generate chart when button is clicked
  async generateChartFromButton(recommendationIndex) {
    const recommendation =
      this.currentChartRecommendations[recommendationIndex];
    if (!recommendation) return;

    const button = document.querySelector(
      `[data-chart-index="${recommendationIndex}"]`
    );
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
    }

    try {
      // Show loading state
      this.showLoading();

      // For now, generate charts directly from recommendation
      // TODO: Add backend endpoint for custom chart generation
      const chartConfig = this.createChartFromRecommendation(
        recommendation,
        recommendationIndex
      );

      if (chartConfig) {
        this.displayChart(chartConfig);
        window.app?.showToast("Gráfico creado exitosamente", "success");

        // Mark button as used
        if (button) {
          button.classList.remove("btn-outline-primary");
          button.classList.add("btn-success");
          button.innerHTML = `<i class="fas fa-check"></i> ${recommendation.title}`;
        }
      }
    } catch (error) {
      console.error("Error generating chart:", error);
      window.app?.showToast(
        `Error generando gráfico: ${error.message}`,
        "error"
      );
    } finally {
      // Reset button state
      if (button) {
        button.disabled = false;
        if (!button.classList.contains("btn-success")) {
          button.innerHTML = `
                        <i class="fas fa-chart-${this.getChartIcon(
                          recommendation.chart_type
                        )}"></i>
                        ${recommendation.title}
                    `;
        }
      }
      this.hideLoading();
    }
  }

  // Create chart from recommendation using real data
  createChartFromRecommendation(recommendation, index) {
    const chartId = `chart_${Date.now()}_${index}`;

    let chartConfig = {
      id: chartId,
      type: recommendation.chart_type,
      title: recommendation.title,
    };

    // Only use real data - no fallbacks
    if (
      this.currentSourceData &&
      Array.isArray(this.currentSourceData) &&
      this.currentSourceData.length > 0
    ) {
      chartConfig = this.createChartFromRealData(recommendation, chartId);
    } else {
      console.error("❌ No real data available for legacy chart creation");
      return null; // No fallback - return null instead
    }

    return chartConfig;
  }

  // Create chart from real source data
  createChartFromRealData(recommendation, chartId) {
    const data = this.currentSourceData;
    const config = recommendation.config || {};

    let chartConfig = {
      id: chartId,
      type: recommendation.chart_type,
      title: recommendation.title,
    };

    try {
      switch (recommendation.chart_type) {
        case "bar":
          return this.createRealBarChart(data, config, chartConfig);
        case "line":
          return this.createRealLineChart(data, config, chartConfig);
        case "scatter":
          return this.createRealScatterChart(data, config, chartConfig);
        case "histogram":
          return this.createRealHistogramChart(data, config, chartConfig);
        default:
          console.error(
            "❌ Unsupported chart type for legacy recommendation:",
            recommendation.chart_type
          );
          return null; // No fallback - return null instead
      }
    } catch (error) {
      console.error("Error creating real data chart:", error);
      return null; // No fallback - return null instead
    }
  }

  // Create bar chart from real data
  createRealBarChart(data, config, chartConfig) {
    console.log("📊 createRealBarChart called with:", {
      dataLength: data ? data.length : 0,
      config: config,
      chartTitle: chartConfig.title,
    });

    const xCol = config.x_axis || this.findCategoricalColumn(data);
    const yCol = config.y_axis || this.findNumericColumn(data);

    console.log("📊 Column detection:", {
      xCol: xCol,
      yCol: yCol,
      configXAxis: config.x_axis,
      configYAxis: config.y_axis,
    });

    if (!xCol || !yCol) {
      console.error("❌ Missing columns for bar chart:", { xCol, yCol });
      console.error(
        "❌ Available columns:",
        data && data.length > 0 ? Object.keys(data[0]) : "No data"
      );
      return null; // No fallback - return null instead
    }

    // Aggregate data for bar chart
    const aggregatedData = this.aggregateDataForBarChart(data, xCol, yCol);
    console.log("📊 Aggregated data:", aggregatedData);

    chartConfig.data = {
      x: aggregatedData.x,
      y: aggregatedData.y,
      type: "bar",
      marker: { color: "#F7DB17" },
    };

    chartConfig.layout = {
      title: chartConfig.title,
      xaxis: { title: xCol || "Categoría" },
      yaxis: { title: yCol || "Valor" },
    };

    console.log("✅ Bar chart config created:", chartConfig);
    return chartConfig;
  }

  // Create line chart from real data
  createRealLineChart(data, config, chartConfig) {
    const xCol =
      config.x_axis ||
      this.findDateColumn(data) ||
      this.findCategoricalColumn(data);
    const yCols = config.y_axis || [this.findNumericColumn(data)];

    if (!xCol || !yCols || yCols.length === 0) {
      console.error("❌ Missing columns for line chart:", { xCol, yCols });
      console.error(
        "❌ Available columns:",
        data && data.length > 0 ? Object.keys(data[0]) : "No data"
      );
      return null; // No fallback - return null instead
    }

    const traces = [];
    yCols.forEach((yCol, index) => {
      if (yCol && data.length > 0 && data[0].hasOwnProperty(yCol)) {
        traces.push({
          x: data.map((row) => row[xCol]),
          y: data.map((row) => row[yCol]),
          type: "scatter",
          mode: "lines+markers",
          name: yCol,
          line: { color: ["#004236", "#F7DB17", "#FF5F00"][index % 3] },
        });
      }
    });

    chartConfig.data = traces;
    chartConfig.layout = {
      title: chartConfig.title,
      xaxis: { title: xCol || "Tiempo" },
      yaxis: { title: "Valores" },
    };

    return chartConfig;
  }

  // Create scatter chart from real data
  createRealScatterChart(data, config, chartConfig) {
    const xCol = config.x_axis || this.findNumericColumn(data, 0);
    const yCol = config.y_axis || this.findNumericColumn(data, 1);

    if (!xCol || !yCol) {
      console.error("❌ Missing columns for scatter chart:", { xCol, yCol });
      console.error(
        "❌ Available columns:",
        data && data.length > 0 ? Object.keys(data[0]) : "No data"
      );
      return null; // No fallback - return null instead
    }

    chartConfig.data = {
      x: data.map((row) => row[xCol]),
      y: data.map((row) => row[yCol]),
      type: "scatter",
      mode: "markers",
      marker: { color: "#FF5F00" },
    };

    chartConfig.layout = {
      title: chartConfig.title,
      xaxis: { title: xCol || "Variable X" },
      yaxis: { title: yCol || "Variable Y" },
    };

    return chartConfig;
  }

  // Create histogram from real data
  createRealHistogramChart(data, config, chartConfig) {
    const column = config.column || this.findNumericColumn(data);

    if (!column) {
      console.error("❌ Missing column for histogram chart:", { column });
      console.error(
        "❌ Available columns:",
        data && data.length > 0 ? Object.keys(data[0]) : "No data"
      );
      return null; // No fallback - return null instead
    }

    chartConfig.data = {
      x: data.map((row) => row[column]).filter((val) => val != null),
      type: "histogram",
      marker: { color: "#004236" },
    };

    chartConfig.layout = {
      title: chartConfig.title,
      xaxis: { title: column || "Variable" },
      yaxis: { title: "Frecuencia" },
    };

    return chartConfig;
  }

  // Helper functions to find appropriate columns
  findCategoricalColumn(data) {
    if (!data || data.length === 0) return null;

    const keys = Object.keys(data[0]);
    const categoricalKeys = [
      "CAMPO",
      "VICE_HOM",
      "WELL_COMMON_NAME",
      "FIELD_NAME",
      "DMU_CODE",
    ];

    // Look for known categorical columns first
    for (const key of categoricalKeys) {
      if (keys.includes(key)) return key;
    }

    // Look for string columns
    for (const key of keys) {
      const value = data[0][key];
      if (typeof value === "string" && key.toLowerCase().includes("name")) {
        return key;
      }
    }

    return keys[0]; // Fallback to first column
  }

  findNumericColumn(data, index = 0) {
    if (!data || data.length === 0) return null;

    const keys = Object.keys(data[0]);
    const numericKeys = ["BOPD", "OIL_VOLUME", "WATER", "GAS", "GOR", "WOR"];

    // Look for known numeric columns first
    for (const key of numericKeys) {
      if (keys.includes(key)) {
        if (index === 0) return key;
        index--;
      }
    }

    // Look for numeric columns
    const numericCols = keys.filter((key) => {
      const value = data[0][key];
      return (
        typeof value === "number" ||
        (!isNaN(parseFloat(value)) && isFinite(value))
      );
    });

    return numericCols[index] || numericCols[0] || null;
  }

  findDateColumn(data) {
    if (!data || data.length === 0) return null;

    const keys = Object.keys(data[0]);
    const dateKeys = ["fecha", "date", "OBSERVATION_DATETIME", "AÑO"];

    for (const key of dateKeys) {
      if (keys.includes(key)) return key;
    }

    return null;
  }

  aggregateDataForBarChart(data, xCol, yCol) {
    const aggregation = {};

    data.forEach((row) => {
      const category = row[xCol];
      const value = parseFloat(row[yCol]) || 0;

      if (aggregation[category]) {
        aggregation[category] += value;
      } else {
        aggregation[category] = value;
      }
    });

    return {
      x: Object.keys(aggregation),
      y: Object.values(aggregation),
    };
  }

  // Create area chart from real data
  createRealAreaChart(data, config, chartConfig) {
    const xCol =
      config.x_axis ||
      this.findDateColumn(data) ||
      this.findCategoricalColumn(data);
    const yCol = config.y_axis || this.findNumericColumn(data);

    if (!xCol || !yCol) {
      console.error("❌ Missing columns for area chart:", { xCol, yCol });
      console.error(
        "❌ Available columns:",
        data && data.length > 0 ? Object.keys(data[0]) : "No data"
      );
      return null; // No fallback - return null instead
    }

    chartConfig.data = {
      x: data.map((row) => row[xCol]),
      y: data.map((row) => parseFloat(row[yCol]) || 0),
      type: "scatter",
      mode: "lines",
      fill: "tozeroy",
      line: { color: "#F7DB17" },
    };

    chartConfig.layout = {
      title: chartConfig.title,
      xaxis: { title: xCol || "Tiempo" },
      yaxis: { title: yCol || "Valor" },
    };

    return chartConfig;
  }

  // Create box plot chart from real data
  createRealBoxPlotChart(data, config, chartConfig) {
    const columns = config.columns || [this.findNumericColumn(data)];

    if (!columns || columns.length === 0) {
      console.error("❌ Missing columns for box plot chart:", { columns });
      console.error(
        "❌ Available columns:",
        data && data.length > 0 ? Object.keys(data[0]) : "No data"
      );
      return null; // No fallback - return null instead
    }

    const traces = columns.map((col) => ({
      y: data.map((row) => parseFloat(row[col]) || 0),
      type: "box",
      name: col,
    }));

    chartConfig.data = traces;
    chartConfig.layout = {
      title: chartConfig.title,
      yaxis: { title: "Valores" },
    };

    return chartConfig;
  }

  // Create heatmap chart from real data
  createRealHeatmapChart(data, config, chartConfig) {
    const columns = config.columns || [
      this.findNumericColumn(data, 0),
      this.findNumericColumn(data, 1),
    ];

    if (!columns || columns.length < 2) {
      console.error("❌ Missing columns for heatmap chart:", { columns });
      console.error(
        "❌ Available columns:",
        data && data.length > 0 ? Object.keys(data[0]) : "No data"
      );
      return null; // No fallback - return null instead
    }

    // Calculate correlation matrix
    const correlationMatrix = this.calculateCorrelationMatrix(data, columns);

    chartConfig.data = {
      z: correlationMatrix.values,
      x: correlationMatrix.labels,
      y: correlationMatrix.labels,
      type: "heatmap",
      colorscale: [
        [0, "#004236"],
        [0.5, "#F7DB17"],
        [1, "#FF5F00"],
      ],
    };

    chartConfig.layout = {
      title: chartConfig.title,
      xaxis: { title: "Variables" },
      yaxis: { title: "Variables" },
    };

    return chartConfig;
  }

  // Create dashboard chart (combination of multiple charts)
  createRealDashboardChart(data, config, chartConfig) {
    // For dashboard, create a simple overview chart
    const numCol = this.findNumericColumn(data);
    const catCol = this.findCategoricalColumn(data);

    if (!numCol || !catCol) {
      console.error("❌ Missing columns for dashboard chart:", {
        numCol,
        catCol,
      });
      console.error(
        "❌ Available columns:",
        data && data.length > 0 ? Object.keys(data[0]) : "No data"
      );
      return null; // No fallback - return null instead
    }

    const aggregatedData = this.aggregateDataForBarChart(data, catCol, numCol);

    chartConfig.data = {
      x: aggregatedData.x,
      y: aggregatedData.y,
      type: "bar",
      marker: {
        color: aggregatedData.y,
        colorscale: "Viridis",
      },
    };

    chartConfig.layout = {
      title: `${chartConfig.title} - Vista General`,
      xaxis: { title: catCol },
      yaxis: { title: numCol },
    };

    return chartConfig;
  }

  // Create subplot combo chart (multiple subplots with different chart types)
  createSubplotComboChart(data, config, chartConfig) {
    console.log("📊 createSubplotComboChart called with:", {
      data: data.slice(0, 2),
      config,
      chartConfig,
    });

    if (!config.subplots || !Array.isArray(config.subplots)) {
      console.error("❌ Missing subplots configuration");
      return null;
    }

    const xCol = config.x_axis || this.findCategoricalColumn(data);
    if (!xCol) {
      console.error("❌ Missing x-axis column");
      return null;
    }

    const traces = [];
    const annotations = [];

    // Process each subplot configuration
    config.subplots.forEach((subplot, idx) => {
      const yCol = subplot.y_axis ? subplot.y_axis[0] : null;

      if (!yCol || !data[0].hasOwnProperty(yCol)) {
        console.warn(`⚠️ Column ${yCol} not found in data for subplot ${idx}`);
        return;
      }

      // Create trace based on subplot type
      // Filter out NaN, null, and undefined values
      const trace = {
        x: data.map((row) => row[xCol]),
        y: data.map((row) => {
          const val = row[yCol];
          return (val === null || val === undefined || isNaN(val)) ? null : val;
        }),
        name: subplot.title || yCol,
        xaxis: idx === 0 ? "x" : `x${idx + 1}`,
        yaxis: idx === 0 ? "y" : `y${idx + 1}`,
      };

      if (subplot.type === "line") {
        trace.type = "scatter";
        trace.mode = "lines+markers";
        trace.line = { color: "#004236", width: 2 };
        trace.marker = { size: 6 };
        trace.connectgaps = false; // Don't connect gaps where values are null
      } else if (subplot.type === "bar") {
        trace.type = "bar";
        trace.marker = {
          color: data.map((row) => {
            const val = row[yCol];
            if (val === null || val === undefined || isNaN(val)) return "#CCCCCC";
            return val >= 0 ? "#00A86B" : "#FF5F00";
          }),
        };
      }

      traces.push(trace);
    });

    // Create layout with subplots
    const numSubplots = config.subplots.length;
    const layout = {
      title: {
        text: chartConfig.title,
        font: { size: 16 }
      },
      showlegend: true,
      height: 700,  // Increased height for better spacing
      margin: {
        t: 80,  // Top margin for title
        b: 60,  // Bottom margin for x-axis labels
        l: 80,  // Left margin for y-axis labels
        r: 40   // Right margin
      },
      grid: {
        rows: config.layout.rows || numSubplots,
        columns: config.layout.cols || 1,
        pattern: 'independent',
        roworder: 'top to bottom'
      },
    };

    // Configure axes for each subplot
    config.subplots.forEach((subplot, idx) => {
      const yaxisKey = idx === 0 ? "yaxis" : `yaxis${idx + 1}`;
      const xaxisKey = idx === 0 ? "xaxis" : `xaxis${idx + 1}`;

      const domain = this.calculateDomain(idx, numSubplots, config.layout.row_heights);

      layout[yaxisKey] = {
        title: subplot.yaxis_title || subplot.y_axis[0],
        domain: domain,
      };

      layout[xaxisKey] = {
        title: idx === numSubplots - 1 ? xCol : "",
        showticklabels: idx === numSubplots - 1,
        anchor: yaxisKey.replace("axis", ""),
      };

      // Add subplot title as annotation positioned at the top of each subplot
      if (subplot.title) {
        annotations.push({
          xref: "paper",
          yref: "paper",
          x: 0.5,
          y: domain[1] + 0.01,  // Position just above the subplot domain
          xanchor: "center",
          yanchor: "bottom",
          text: `<b>${subplot.title}</b>`,
          showarrow: false,
          font: { size: 12 },
        });
      }
    });

    layout.annotations = annotations;

    chartConfig.data = traces;
    chartConfig.layout = layout;

    console.log("✅ Subplot combo chart created:", chartConfig);
    return chartConfig;
  }

  // Helper: Calculate domain for subplot positioning
  calculateDomain(index, total, heights) {
    const gap = 0.05;

    if (!heights || heights.length !== total) {
      // Equal distribution
      const plotHeight = (1 - gap * (total - 1)) / total;
      const start = 1 - (index + 1) * (plotHeight + gap) + gap;
      return [start, start + plotHeight];
    }

    // Custom heights - heights are proportions of available space
    // Available space = 1 - gaps
    const availableSpace = 1 - gap * (total - 1);

    // Calculate actual heights from proportions
    const actualHeights = heights.map(h => h * availableSpace);

    // Calculate position from top
    let currentPos = 1;
    for (let i = 0; i < index; i++) {
      currentPos -= actualHeights[i];
      currentPos -= gap;
    }

    const end = currentPos;
    const start = currentPos - actualHeights[index];

    return [start, end];
  }

  // Create horizontal comparison bar chart (for min/max comparisons)
  createHorizontalComparisonBarChart(data, config, chartConfig) {
    console.log("📊 createHorizontalComparisonBarChart called with:", {
      data,
      config,
    });

    if (!data || data.length === 0) {
      console.error("❌ No data provided");
      return null;
    }

    const mapping = config.data_mapping || {};
    const row = data[0]; // Single row result

    // Extract values from the data
    const categories = mapping.categories || ["Mes_Min", "Mes_Max"];
    const values = mapping.values || ["Total_Min", "Total_Max"];
    const labels = mapping.labels || ["Mínimo", "Máximo"];
    const colors = config.colors || { min: "#00A86B", max: "#004236" };

    // Build the chart data
    const yCategories = labels;
    const xValues = [row[values[0]], row[values[1]]];
    const textLabels = mapping.month_labels
      ? [`${row[categories[0]]}: ${this.formatNumber(row[values[0]])}`,
         `${row[categories[1]]}: ${this.formatNumber(row[values[1]])}`]
      : xValues.map(v => this.formatNumber(v));

    const trace = {
      x: xValues,
      y: yCategories,
      type: "bar",
      orientation: "h",
      text: textLabels,
      textposition: "outside",
      textfont: {
        size: 12,
        color: "#333"
      },
      marker: {
        color: [colors.min, colors.max],
        line: {
          color: "#333",
          width: 1
        }
      },
      hovertemplate: "%{y}: %{x:,.0f}<extra></extra>",
    };

    chartConfig.data = [trace];
    chartConfig.layout = {
      title: chartConfig.title,
      xaxis: {
        title: "Producción (BOPD)",
        showgrid: true,
        gridcolor: "#e0e0e0",
      },
      yaxis: {
        title: "",
        automargin: true,
      },
      height: 300,
      margin: {
        l: 100,
        r: 150,
        t: 80,
        b: 60,
      },
    };

    console.log("✅ Horizontal comparison bar chart created:", chartConfig);
    return chartConfig;
  }

  // Helper: Format number with thousand separators
  formatNumber(num) {
    if (num == null) return "N/A";
    return num.toLocaleString("es-ES", {
      maximumFractionDigits: 0,
    });
  }

  // Create multi-line chart grouped by category (for product participation)
  createMultiLineGroupedChart(data, config, chartConfig) {
    console.log("📊 createMultiLineGroupedChart called with:", {
      data: data.slice(0, 5),
      config,
    });

    if (!data || data.length === 0) {
      console.error("❌ No data provided");
      return null;
    }

    const xCol = config.x_axis || "Mes";
    const yCol = config.y_axis || "Porcentaje";
    const groupCol = config.group_by || "Producto";
    const seriesConfig = config.series_config || {};
    const filters = config.filters || {};
    const excludeProducts = filters.exclude_products || [];

    // Filter data to exclude specific products
    const filteredData = data.filter(row =>
      !excludeProducts.includes(row[groupCol])
    );

    // Group data by product
    const groupedData = {};
    filteredData.forEach(row => {
      const group = row[groupCol];
      if (!groupedData[group]) {
        groupedData[group] = {
          x: [],
          y: []
        };
      }
      groupedData[group].x.push(row[xCol]);
      groupedData[group].y.push(row[yCol]);
    });

    // Create traces for each product line
    const traces = [];
    Object.keys(groupedData).forEach((product, idx) => {
      const seriesCfg = seriesConfig[product] || {};
      const trace = {
        x: groupedData[product].x,
        y: groupedData[product].y,
        type: "scatter",
        mode: "lines+markers",
        name: seriesCfg.name || product,
        line: {
          color: seriesCfg.color || this.getDefaultColor(idx),
          width: 2
        },
        marker: {
          size: 6,
          color: seriesCfg.color || this.getDefaultColor(idx)
        },
        hovertemplate: `%{fullData.name}<br>%{x}: %{y:.2f}%<extra></extra>`,
      };
      traces.push(trace);
    });

    // Build layout
    const layoutConfig = config.layout || {};
    chartConfig.data = traces;
    chartConfig.layout = {
      title: chartConfig.title,
      xaxis: {
        title: layoutConfig.xaxis_title || xCol,
        showgrid: true,
        gridcolor: "#e0e0e0",
      },
      yaxis: {
        title: layoutConfig.yaxis_title || yCol,
        showgrid: true,
        gridcolor: "#e0e0e0",
        rangemode: "tozero",
      },
      showlegend: layoutConfig.showlegend !== false,
      legend: {
        x: 0.02,
        y: 0.98,
        xanchor: "left",
        yanchor: "top",
        bgcolor: "rgba(255, 255, 255, 0.8)",
        bordercolor: "#333",
        borderwidth: 1
      },
      height: layoutConfig.height || 400,
      margin: {
        l: 60,
        r: 40,
        t: 80,
        b: 60,
      },
    };

    console.log("✅ Multi-line grouped chart created:", chartConfig);
    return chartConfig;
  }

  // Helper: Get default color from palette
  getDefaultColor(index) {
    const colors = ["#004236", "#F7DB17", "#FF5F00", "#00A86B", "#00A8E8"];
    return colors[index % colors.length];
  }

  // Calculate correlation matrix for heatmap
  calculateCorrelationMatrix(data, columns) {
    const matrix = [];
    const labels = columns;

    for (let i = 0; i < columns.length; i++) {
      const row = [];
      for (let j = 0; j < columns.length; j++) {
        if (i === j) {
          row.push(1);
        } else {
          const correlation = this.calculateCorrelation(
            data,
            columns[i],
            columns[j]
          );
          row.push(correlation);
        }
      }
      matrix.push(row);
    }

    return { values: matrix, labels: labels };
  }

  // Calculate Pearson correlation between two variables
  calculateCorrelation(data, col1, col2) {
    const values1 = data.map((row) => parseFloat(row[col1]) || 0);
    const values2 = data.map((row) => parseFloat(row[col2]) || 0);

    const n = values1.length;
    const sum1 = values1.reduce((a, b) => a + b, 0);
    const sum2 = values2.reduce((a, b) => a + b, 0);
    const sum1Sq = values1.reduce((a, b) => a + b * b, 0);
    const sum2Sq = values2.reduce((a, b) => a + b * b, 0);
    const pSum = values1.reduce((acc, val, i) => acc + val * values2[i], 0);

    const num = pSum - (sum1 * sum2) / n;
    const den = Math.sqrt(
      (sum1Sq - (sum1 * sum1) / n) * (sum2Sq - (sum2 * sum2) / n)
    );

    return den === 0 ? 0 : num / den;
  }

  // Sample chart creation function removed - no more fallbacks allowed

  // Display auto-generated charts
  displayAutoCharts(charts) {
    charts.forEach((chart) => {
      this.displayChart(chart);
    });
  }

  // Display a single chart
  displayChart(chartConfig) {
    const chartsArea = document.getElementById("charts-display-area");
    if (!chartsArea || !chartConfig) {
      console.error(
        "❌ Cannot display chart: missing chart area or configuration"
      );
      return;
    }

    // Create year filter buttons HTML if available
    let yearButtonsHtml = '';
    if (chartConfig.year_buttons && chartConfig.year_buttons.length > 0) {
      yearButtonsHtml = `
        <div class="btn-group btn-group-sm ms-auto" role="group" aria-label="Filtro de año">
          ${chartConfig.year_buttons.map(btn => `
            <button type="button"
                    class="btn ${btn.active ? 'btn-primary' : 'btn-outline-primary'}"
                    data-year="${btn.year}"
                    onclick="window.AnalyticsManager.filterChartByYear('${chartConfig.id}', '${btn.year}')">
              ${btn.label}
            </button>
          `).join('')}
        </div>
      `;
    }

    // Create chart container with unique ID
    const chartContainer = document.createElement("div");
    chartContainer.className = "chart-container mb-4";
    chartContainer.id = `container-${chartConfig.id}`;

    // Determine height based on chart type
    const chartHeight = this.getChartHeight(chartConfig.type);

    chartContainer.innerHTML = `
            <div class="card">
                <div class="card-header bg-light d-flex align-items-center">
                    <h6 class="mb-0">
                        <i class="fas fa-chart-${this.getChartIcon(
                          chartConfig.type
                        )}"></i>
                        ${chartConfig.title}
                    </h6>
                    ${yearButtonsHtml}
                </div>
                <div class="card-body" style="padding-bottom: 2rem;">
                    <div id="${
                      chartConfig.id
                    }" class="chart-plot" style="height: ${chartHeight}px; min-height: ${chartHeight}px; overflow: visible;"></div>
                </div>
            </div>
        `;

    chartsArea.appendChild(chartContainer);

    // Check if this is a frontend-only chart
    if (chartConfig.frontend_only) {
      console.log("🎨 Rendering frontend-only chart:", chartConfig.type);
      this.renderFrontendOnlyChart(chartConfig);
    } else {
      // Render the Plotly chart normally
      this.renderPlotlyChart(chartConfig);
    }

    // Store active chart
    this.activeCharts.set(chartConfig.id, chartConfig);
  }

  renderFrontendOnlyChart(chartConfig) {
    console.log("🎨 ========== FRONTEND-ONLY CHART RENDERING ==========");
    console.log("🎨 Chart Type:", chartConfig.type);
    console.log("🎨 Data Rows:", chartConfig.data ? chartConfig.data.length : 0);
    console.log("🎨 Data Sample (first row):", chartConfig.data ? chartConfig.data[0] : null);
    console.log("🎨 Config:", chartConfig.config);
    console.log("🎨 Chart ID:", chartConfig.id);

    try {
      const data = chartConfig.data;
      const config = chartConfig.config;

      if (!data || data.length === 0) {
        console.error("❌ No data provided to renderFrontendOnlyChart");
        this.showChartError(chartConfig.id, "No hay datos disponibles para generar el gráfico");
        return;
      }

      // Create a temporary button-like config for compatibility
      const dynamicButton = {
        chart_type: chartConfig.type,
        title: chartConfig.title,
        description: chartConfig.description,
      };

      // Call the appropriate chart creation method based on type
      let finalChartConfig = null;

      switch (chartConfig.type) {
        case "subplot_combo":
          finalChartConfig = this.createSubplotComboChart(data, config, chartConfig);
          break;
        case "horizontal_comparison_bar":
          finalChartConfig = this.createHorizontalComparisonBarChart(data, config, chartConfig);
          break;
        case "multi_line_grouped":
          finalChartConfig = this.createMultiLineGroupedChart(data, config, chartConfig);
          break;
        default:
          console.error(`❌ Unknown frontend-only chart type: ${chartConfig.type}`);
          return;
      }

      if (!finalChartConfig) {
        console.error("❌ Failed to create frontend chart configuration");
        this.showChartError(chartConfig.id, "Error generando configuración del gráfico");
        return;
      }

      console.log("🎨 Final chart config created:", {
        dataLength: finalChartConfig.data ? finalChartConfig.data.length : 0,
        layoutKeys: finalChartConfig.layout ? Object.keys(finalChartConfig.layout) : []
      });

      // Render the chart using Plotly
      Plotly.newPlot(chartConfig.id, finalChartConfig.data, finalChartConfig.layout, {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
      });

      console.log("✅ Frontend-only chart rendered successfully");
      console.log("🎨 ================================================");

    } catch (error) {
      console.error("❌ Error rendering frontend-only chart:", error);
      console.error("❌ Stack trace:", error.stack);
      this.showChartError(chartConfig.id, `Error: ${error.message}`);
    }
  }

  showChartError(chartId, message) {
    const chartElement = document.getElementById(chartId);
    if (chartElement) {
      chartElement.innerHTML = `
        <div class="alert alert-danger text-center m-4" role="alert">
          <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
          <h6>Error al Generar Gráfico</h6>
          <p class="mb-0 small">${message}</p>
        </div>
      `;
    }
  }

  filterChartByYear(chartId, year) {
    console.log(`🔄 Filtering chart ${chartId} by year ${year}`);

    // Find the original button that created this chart
    const originalConfig = this.activeCharts.get(chartId);
    if (!originalConfig || !originalConfig.original_button_config) {
      console.warn('No original button config found for chart:', chartId);
      return;
    }

    // Update config with year filter
    const updatedConfig = {
      ...originalConfig.original_button_config,
      config: {
        ...originalConfig.original_button_config.config,
        filter_year: year
      }
    };

    // Remove old chart
    const container = document.getElementById(`container-${chartId}`);
    if (container) {
      container.remove();
    }

    // Regenerate chart with new year filter
    if (window.ChatManager) {
      window.ChatManager.generateChartFromButton(updatedConfig);
    } else {
      console.error('ChatManager not available for year filtering');
    }
  }

  // Render Plotly chart
  renderPlotlyChart(chartConfig) {
    const chartElement = document.getElementById(chartConfig.id);
    if (!chartElement) return;

    try {
      const data = Array.isArray(chartConfig.data)
        ? chartConfig.data
        : [chartConfig.data];

      // Preservar configuraciones del backend (especialmente margin para botones)
      const layout = {
        ...chartConfig.layout,
        font: chartConfig.layout?.font || { size: 12 },
        plot_bgcolor: chartConfig.layout?.plot_bgcolor || "rgba(0,0,0,0)",
        paper_bgcolor: chartConfig.layout?.paper_bgcolor || "rgba(0,0,0,0)",
        // Usar el margin del backend si existe (necesario para botones de animación)
        margin: chartConfig.layout?.margin || { t: 50, l: 50, r: 30, b: 50 },
      };

      const config = {
        displayModeBar: true,  // Mostrar barra de herramientas
        responsive: true,
        staticPlot: false,
        modeBarButtonsToRemove: ['select2d', 'lasso2d'],  // Remover botones innecesarios
        displaylogo: false,
      };

      // Si hay frames, crear animación con frames
      if (chartConfig.frames && chartConfig.frames.length > 0) {
        const numFrames = chartConfig.frames.length;
        // Calcular duración por frame para totalizar 4 segundos
        const frameDuration = Math.max(40, Math.floor(4000 / numFrames));

        console.log(`🎬 Creando gráfico animado:`);
        console.log(`   - Total frames: ${numFrames}`);
        console.log(`   - Duración por frame: ${frameDuration}ms`);
        console.log(`   - Duración total: ~${(frameDuration * numFrames / 1000).toFixed(1)}s`);

        // Inicializar con el primer frame
        const initialData = chartConfig.frames[0].data;
        console.log(`   - Primer frame data points:`, initialData[0]?.x?.length);

        Plotly.newPlot(chartElement, initialData, layout, config)
          .then(() => {
            console.log("✅ Plot creado, añadiendo frames...");
            // Añadir todos los frames
            return Plotly.addFrames(chartElement, chartConfig.frames);
          })
          .then(() => {
            console.log("✅ Frames añadidos exitosamente");
            console.log(`   - Frame names:`, chartConfig.frames.slice(0, 3).map(f => f.name), '...');

            // Obtener nombres de frames
            const frameNames = chartConfig.frames.map(f => f.name);

            // Reproducir animación automáticamente
            console.log("🎬 Iniciando animación...");
            return Plotly.animate(chartElement, frameNames, {
              frame: {duration: frameDuration, redraw: true},
              transition: {duration: Math.floor(frameDuration * 0.5), easing: 'linear'},
              mode: 'immediate'
            });
          })
          .then(() => {
            console.log("✅ Animación completada exitosamente");
          })
          .catch((error) => {
            console.error("❌ Error en animación:", error);
            console.error("Stack:", error.stack);
            console.error("chartConfig.frames:", chartConfig.frames);
            // Si falla, mostrar datos completos
            console.warn("⚠️ Fallback: mostrando gráfico completo sin animación");
            Plotly.newPlot(chartElement, data, layout, config);
          });
      } else {
        console.log("ℹ️ Sin frames, renderizado normal");
        // Renderizado normal sin frames
        Plotly.newPlot(chartElement, data, layout, config);
      }
    } catch (error) {
      console.error("Error rendering Plotly chart:", error);
      chartElement.innerHTML = `
                <div class="text-center text-muted p-4">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error renderizando gráfico</p>
                </div>
            `;
    }
  }

  // Remove a chart
  removeChart(chartId) {
    const chartContainer = document
      .querySelector(`[data-chart-id="${chartId}"]`)
      .closest(".chart-container");
    if (chartContainer) {
      chartContainer.remove();
      this.activeCharts.delete(chartId);

      // Reset corresponding button in Panel 2 when chart is closed
      this.resetChartButton(chartId);
    }
  }

  resetChartButton(chartId) {
    // Find the button that generated this chart and reset it
    const panel2Buttons = document.querySelectorAll(
      "#database-panel .chart-button.btn-success"
    );

    panel2Buttons.forEach((btn) => {
      // Reset all success buttons when any chart is closed
      // (Simple approach - could be more specific if needed)
      if (btn.classList.contains("btn-success")) {
        // Unescape HTML entities before parsing JSON
        const unescapedConfig = btn.dataset.buttonConfig
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        const buttonConfig = JSON.parse(unescapedConfig);

        // Reset visual state
        btn.classList.remove("btn-success");
        btn.classList.add("btn-outline-primary");
        btn.disabled = false;

        // Reset button content
        const iconClass = this.getChartButtonIcon(buttonConfig.chart_type);
        btn.innerHTML = `
                    <div class="d-flex align-items-center">
                        <i class="fas fa-${iconClass} me-2"></i>
                        <div class="text-start flex-grow-1">
                            <div class="fw-bold">${buttonConfig.title}</div>
                            <small class="text-muted">${buttonConfig.description}</small>
                        </div>
                        <i class="fas fa-chevron-right ms-2 text-muted"></i>
                    </div>
                `;

        console.log(`🔄 Reset button: ${buttonConfig.title}`);
      }
    });
  }

  getChartButtonIcon(chartType) {
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
    };
    return iconMap[chartType] || "chart-bar";
  }

  // Get icon for chart type
  getChartIcon(chartType) {
    const iconMap = {
      bar: "bar",
      line: "line-chart",
      area: "area",
      scatter: "chart-scatter",
      histogram: "chart-bar",
      heatmap: "th",
      pie: "chart-pie",
    };
    return iconMap[chartType] || "chart-bar";
  }

  // Get appropriate height for chart type
  getChartHeight(chartType) {
    const heightMap = {
      subplot_combo: 750,  // Tall height for subplots
      multi_line_grouped: 500,  // Medium height for multi-line
      horizontal_comparison_bar: 400,  // Standard height
      ranking_bar: 500,  // Medium height for rankings
      pie: 450,  // Standard height for pie charts
      bar: 400,  // Standard height
      line: 400,  // Standard height
      scatter: 400,  // Standard height
      heatmap: 500,  // Slightly taller for heatmaps
    };
    return heightMap[chartType] || 400;  // Default to 400px
  }

  // Show analytics section
  showAnalytics() {
    console.log("📱 showAnalytics() called");
    const emptyState = document.getElementById("analytics-empty-state");
    const chartsArea = document.getElementById("charts-display-area");

    console.log("🔍 DOM elements found:", {
      emptyState: !!emptyState,
      chartsArea: !!chartsArea,
    });

    if (emptyState) emptyState.style.display = "none";
    if (chartsArea) chartsArea.style.display = "block";

    console.log("✅ Analytics section shown");
  }

  // Hide analytics section
  hideAnalytics() {
    const emptyState = document.getElementById("analytics-empty-state");
    const chartsArea = document.getElementById("charts-display-area");
    const buttonsSection = document.getElementById("chart-buttons-section");
    const loading = document.getElementById("analytics-loading");

    if (emptyState) emptyState.style.display = "block";
    if (chartsArea) chartsArea.style.display = "none";
    if (buttonsSection) buttonsSection.style.display = "none";
    if (loading) loading.style.display = "none";

    // Clear existing data
    this.currentChartRecommendations = [];
    this.activeCharts.clear();

    // Clear containers
    const buttonsContainer = document.getElementById("chart-buttons-container");
    if (buttonsContainer) buttonsContainer.innerHTML = "";
    if (chartsArea) chartsArea.innerHTML = "";
  }

  // Show loading state
  showLoading() {
    document.getElementById("analytics-loading").style.display = "block";
  }

  // Hide loading state
  hideLoading() {
    document.getElementById("analytics-loading").style.display = "none";
  }

  // Clear all charts
  clearAllCharts() {
    this.hideAnalytics();
  }
}

// Initialize analytics manager
try {
  window.AnalyticsManager = new AnalyticsManager();
  console.log("✅ AnalyticsManager initialized successfully");
} catch (error) {
  console.error("❌ Failed to initialize AnalyticsManager:", error);
}
