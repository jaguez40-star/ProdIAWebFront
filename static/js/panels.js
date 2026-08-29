// Panel Manager - Handle collapsible panels and layout

class PanelManager {
  constructor() {
    console.log("PanelManager constructor called");
    this.panels = {
      chat: { element: null, visible: true },
      analytics: { element: null, visible: true },
    };
    this.init();
  }

  init() {
    console.log("PanelManager init called");
    this.initializePanels();
    this.setupEventListeners();
  }

  initializePanels() {
    console.log("initializePanels called");
    // Get panel elements
    this.panels.chat.element = document.getElementById("chat-panel");
    this.panels.analytics.element = document.getElementById("analytics-panel");

    console.log("Panel elements:", {
      chat: this.panels.chat.element,
      analytics: this.panels.analytics.element,
    });

    // Analytics panel is always visible and cannot be collapsed
    this.panels.analytics.visible = true;

    // Initialize visibility from localStorage if available
    this.loadPanelStates();

    // Force initial layout update
    this.updateLayout();
  }

  setupEventListeners() {
    // Collapse/expand buttons
    document.querySelectorAll(".collapse-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const panelName = btn.dataset.panel;
        this.togglePanel(panelName);
      });
    });

    // Click on collapsed panel to expand (analytics cannot be collapsed)
    document.addEventListener("click", (e) => {
      const collapsedPanel = e.target.closest(".panel.collapsed");
      if (collapsedPanel && !e.target.closest(".collapse-btn")) {
        const panelName = this.getPanelNameFromElement(collapsedPanel);
        if (panelName && panelName !== "analytics") {
          // Prevent analytics from being toggled
          this.togglePanel(panelName);
        }
      }
    });

    // Window resize handler for responsive layout
    window.addEventListener("resize", () => {
      this.handleResize();
    });
  }

  getPanelNameFromElement(panelElement) {
    if (panelElement.id === "chat-panel") return "chat";
    if (panelElement.id === "analytics-panel") return "analytics";
    return null;
  }

  togglePanel(panelName) {
    // Analytics panel cannot be collapsed
    if (panelName === "analytics") {
      return;
    }

    if (!this.panels[panelName]) return;

    const panel = this.panels[panelName];
    panel.visible = !panel.visible;

    this.updatePanelVisibility(panelName);
    this.updateLayout();
    this.savePanelStates();
  }

  updatePanelVisibility(panelName) {
    const panel = this.panels[panelName];
    if (!panel.element) return;

    const content = panel.element.querySelector(".panel-content");
    const button = panel.element.querySelector(".collapse-btn");

    if (panel.visible) {
      // Show panel
      panel.element.classList.remove("collapsed");
      if (content) {
        content.style.display = "block";
        content.style.opacity = "1";
      }

      // Update button for expanded state
      if (button) {
        button.setAttribute(
          "title",
          `Colapsar ${this.getPanelDisplayName(panelName)}`
        );
        button.innerHTML = '<i class="fas fa-minus"></i>';
      }
    } else {
      // Hide panel - keep header visible for expand button
      panel.element.classList.add("collapsed");
      if (content) {
        content.style.display = "none";
        content.style.opacity = "0";
      }

      // Update button for collapsed state - show panel icon
      if (button) {
        button.setAttribute(
          "title",
          `Expandir ${this.getPanelDisplayName(panelName)}`
        );
        const panelIcon = this.getPanelIcon(panelName);
        button.innerHTML = `<i class="fas ${panelIcon}"></i>`;
      }
    }
  }

  getPanelDisplayName(panelName) {
    const names = {
      chat: "Chat",
      analytics: "Analytics",
    };
    return names[panelName] || panelName;
  }

  getPanelIcon(panelName) {
    const icons = {
      chat: "fa-comments",
      analytics: "fa-chart-bar",
    };
    return icons[panelName] || "fa-square";
  }

  updateLayout() {
    console.log("updateLayout called");
    const layoutContainer = document.querySelector(".two-panel-layout, .three-panel-layout");
    if (!layoutContainer) {
      console.error("Layout container not found");
      return;
    }

    const collapsedWidth = "60px";
    const chatVisible = this.panels.chat.visible;
    // Analytics is always visible
    const analyticsVisible = true;

    console.log("Panel visibility:", {
      chatVisible,
      analyticsVisible,
    });

    let newColumns;
    // Two panel layout - 30/70 split when both visible (chat 30%, analytics 70%)
    if (chatVisible && analyticsVisible) {
      // Both visible - chat gets 30%, analytics gets 70%
      newColumns = "30% 70%";
    } else if (chatVisible && !analyticsVisible) {
      // Only chat visible
      newColumns = `1fr ${collapsedWidth}`;
    } else if (!chatVisible && analyticsVisible) {
      // Only analytics visible
      newColumns = `${collapsedWidth} 1fr`;
    } else {
      // Both collapsed (edge case)
      newColumns = `${collapsedWidth} ${collapsedWidth}`;
    }

    console.log("Setting grid columns to:", newColumns);
    layoutContainer.style.gridTemplateColumns = newColumns;

    // Resize Plotly charts after layout change
    this.resizePlotlyCharts();
  }

  resizePlotlyCharts() {
    // Give the layout time to settle, then resize all Plotly charts
    setTimeout(() => {
      const plotlyCharts = document.querySelectorAll('.js-plotly-plot');
      console.log(`Found ${plotlyCharts.length} Plotly charts to resize`);

      plotlyCharts.forEach((chart) => {
        if (typeof Plotly !== 'undefined' && chart.offsetParent) {
          Plotly.Plots.resize(chart).catch(() => {});
        }
      });
    }, 150);
  }

  handleResize() {
    const width = window.innerWidth;

    if (width < 768) {
      // Mobile: Stack panels vertically
      this.setMobileLayout();
    } else {
      // Desktop: Use grid layout
      this.updateLayout();
    }
  }

  setMobileLayout() {
    const layoutContainer = document.querySelector(".three-panel-layout");
    if (!layoutContainer) return;

    // Reset to single column on mobile
    layoutContainer.style.gridTemplateColumns = "1fr";

    // Show all panel content on mobile, analytics is always visible
    Object.keys(this.panels).forEach((panelName) => {
      this.panels[panelName].visible = true;
      this.updatePanelVisibility(panelName);
    });
  }

  savePanelStates() {
    const states = {};
    Object.keys(this.panels).forEach((name) => {
      // Don't save analytics state since it's always visible
      if (name !== "analytics") {
        states[name] = this.panels[name].visible;
      }
    });
    localStorage.setItem("ecpInsightsPanelStates", JSON.stringify(states));
  }

  loadPanelStates() {
    try {
      const saved = localStorage.getItem("ecpInsightsPanelStates");
      if (saved) {
        const states = JSON.parse(saved);
        Object.keys(states).forEach((name) => {
          if (this.panels[name] && name !== "analytics") {
            // Don't load state for analytics
            this.panels[name].visible = states[name];
            this.updatePanelVisibility(name);
          }
        });
        // Ensure analytics is always visible
        this.panels.analytics.visible = true;
        this.updatePanelVisibility("analytics");
        this.updateLayout();
      }
    } catch (error) {
      console.warn("Could not load panel states:", error);
    }
  }

  // Method to expand all panels
  expandAllPanels() {
    Object.keys(this.panels).forEach((name) => {
      this.panels[name].visible = true;
      this.updatePanelVisibility(name);
    });
    this.updateLayout();
    this.savePanelStates();
  }

  // Method to collapse all panels except analytics
  focusPanel(panelName) {
    Object.keys(this.panels).forEach((name) => {
      if (name === "analytics") {
        // Analytics is always visible
        this.panels[name].visible = true;
      } else {
        this.panels[name].visible = name === panelName;
      }
      this.updatePanelVisibility(name);
    });
    this.updateLayout();
    this.savePanelStates();
  }
}

// Database Manager - Handle database info panel
class DatabaseManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // SQL editor toggle
    document
      .getElementById("toggle-sql-editor")
      ?.addEventListener("click", () => {
        this.toggleSqlEditor();
      });

    // SQL execution
    document
      .getElementById("execute-sql-btn")
      ?.addEventListener("click", () => {
        this.executeSql();
      });

    // Clear SQL
    document.getElementById("clear-sql-btn")?.addEventListener("click", () => {
      this.clearSql();
    });
  }

  async loadInfo() {
    try {
      const response = await fetch("/api/database/info");
      const data = await response.json();

      if (data.success) {
        this.updateDatabaseInfo(data);
      } else {
        this.showDatabaseError(data.error);
      }
    } catch (error) {
      console.error("Error loading database info:", error);
      this.showDatabaseError("Error de conexión");
    }
  }

  updateDatabaseInfo(data) {
    // Update totals
    document.getElementById("total-tables").textContent =
      data.total_tables || "-";
    document.getElementById("total-records").textContent =
      AppManager.formatNumber(data.total_records || 0);

    // Update tables list
    const tablesList = document.getElementById("tables-list");
    if (tablesList && data.tables) {
      tablesList.innerHTML = "";

      Object.entries(data.tables)
        .slice(0, 5)
        .forEach(([tableName, info]) => {
          const tableItem = document.createElement("div");
          tableItem.className = "table-item";
          tableItem.innerHTML = `
                    <div class="table-name">${tableName}</div>
                    <div class="table-stats">
                        ${AppManager.formatNumber(
                          info.row_count || 0
                        )} registros • 
                        ${info.columns?.length || 0} columnas
                    </div>
                `;
          tablesList.appendChild(tableItem);
        });
    }
  }

  showDatabaseError(error) {
    document.getElementById("total-tables").textContent = "!";
    document.getElementById("total-records").textContent = "!";

    const tablesList = document.getElementById("tables-list");
    if (tablesList) {
      tablesList.innerHTML = `
                <div class="text-center text-danger p-3">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p class="mb-0 small">${error}</p>
                </div>
            `;
    }
  }

  toggleSqlEditor() {
    const editor = document.getElementById("sql-editor-container");
    const toggleBtn = document.getElementById("toggle-sql-editor");

    if (editor && toggleBtn) {
      const isVisible = editor.style.display !== "none";

      if (isVisible) {
        editor.style.display = "none";
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
      } else {
        editor.style.display = "block";
        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
      }
    }
  }

  async executeSql() {
    const queryTextarea = document.getElementById("sql-query");
    const query = queryTextarea?.value.trim();

    if (!query) {
      window.app?.showToast("Ingresa una consulta SQL", "warning");
      return;
    }

    try {
      const response = await fetch("/api/sql/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      this.showSqlResults(data);
    } catch (error) {
      console.error("Error executing SQL:", error);
      window.app?.showToast("Error ejecutando consulta", "error");
    }
  }

  showSqlResults(data) {
    const resultsContainer = document.getElementById("sql-results");
    if (!resultsContainer) return;

    if (data.success) {
      resultsContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    ${data.message}
                </div>
            `;
    } else {
      resultsContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle"></i>
                    Error: ${data.error}
                </div>
            `;
    }

    resultsContainer.style.display = "block";
  }

  clearSql() {
    const queryTextarea = document.getElementById("sql-query");
    const resultsContainer = document.getElementById("sql-results");

    if (queryTextarea) queryTextarea.value = "";
    if (resultsContainer) resultsContainer.style.display = "none";
  }
}

// Initialize managers
console.log("Initializing global managers...");
window.panelManager = new PanelManager();
window.databaseManager = new DatabaseManager();

// Ensure DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, re-checking panel manager initialization...");
  if (!window.panelManager) {
    console.log("Panel manager not found, creating new instance...");
    window.panelManager = new PanelManager();
  }

  // Force analytics to be visible
  setTimeout(() => {
    if (window.panelManager && window.panelManager.panels.analytics) {
      console.log("Forcing analytics panel to be visible...");
      window.panelManager.panels.analytics.visible = true;
      window.panelManager.updateLayout();
    }
  }, 500);
});
