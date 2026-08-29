/**
 * 📊 Report Tabs Manager
 *
 * Sistema reutilizable para crear tabs Bootstrap 5 en reportes.
 * Proporciona una API consistente para gestionar navegación entre tabs.
 *
 * @author Claude Code
 * @version 1.0.0
 */

class ReportTabManager {
  /**
   * Crea una instancia del gestor de tabs
   * @param {string} reportId - ID único para este reporte
   */
  constructor(reportId) {
    this.reportId = reportId || `report-${Date.now()}`;
    this.activeTabId = null;
    this.tabs = [];
    this._lazyRenderers = new Map();
    this._renderedTabs = new Set();
  }

  /**
   * Crea el contenedor completo de tabs con navegación y contenido
   *
   * @param {Object} config - Configuración de tabs
   * @param {string} config.containerId - ID del contenedor (opcional)
   * @param {Array} config.tabs - Array de configuraciones de tabs
   * @param {string} config.tabs[].id - ID único del tab
   * @param {string} config.tabs[].title - Título mostrado en la navegación
   * @param {string} config.tabs[].icon - Clase de icono FontAwesome (opcional)
   * @param {Function} config.tabs[].contentRenderer - Función que renderiza el contenido del tab
   * @param {boolean} config.tabs[].active - Si este tab debe estar activo por defecto
   *
   * @returns {HTMLElement} Elemento contenedor con tabs completos
   *
   * @example
   * const tabManager = new ReportTabManager('daily-report');
   * const container = tabManager.createTabContainer({
   *   tabs: [
   *     {
   *       id: 'tab1',
   *       title: 'Resumen Diario',
   *       icon: 'fa-chart-line',
   *       contentRenderer: (container) => { ... },
   *       active: true
   *     }
   *   ]
   * });
   */
  createTabContainer(config) {
    if (!config || !Array.isArray(config.tabs) || config.tabs.length === 0) {
      console.error('❌ createTabContainer: configuración de tabs inválida');
      return null;
    }

    this.tabs = config.tabs;

    // Encontrar tab activo por defecto
    let activeTab = this.tabs.find(t => t.active);
    if (!activeTab) {
      activeTab = this.tabs[0];
      activeTab.active = true;
    }
    this.activeTabId = activeTab.id;

    // Crear contenedor principal
    const mainContainer = document.createElement('div');
    mainContainer.className = 'report-tabs-container';
    mainContainer.id = config.containerId || `tabs-${this.reportId}`;

    // Crear navegación de tabs
    const nav = this.createTabNav(this.tabs);
    mainContainer.appendChild(nav);

    // Crear contenido de tabs
    const content = this.createTabContent(this.tabs);
    mainContainer.appendChild(content);

    // Configurar event listeners
    this.setupEventListeners(mainContainer);

    console.log(`✅ Tabs creados para reporte: ${this.reportId}`, {
      totalTabs: this.tabs.length,
      activeTab: this.activeTabId
    });

    return mainContainer;
  }

  /**
   * Crea la barra de navegación de tabs (nav-tabs)
   * @private
   */
  createTabNav(tabs) {
    const nav = document.createElement('ul');
    nav.className = 'nav nav-tabs mb-3';
    nav.setAttribute('role', 'tablist');
    nav.id = `nav-${this.reportId}`;

    tabs.forEach((tab, index) => {
      const li = document.createElement('li');
      li.className = 'nav-item';
      li.setAttribute('role', 'presentation');

      const button = document.createElement('button');
      button.className = `nav-link ${tab.active ? 'active' : ''}`;
      button.id = `${this.reportId}-tab-${tab.id}`;
      button.setAttribute('data-bs-toggle', 'tab');
      button.setAttribute('data-bs-target', `#${this.reportId}-content-${tab.id}`);
      button.setAttribute('type', 'button');
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', `${this.reportId}-content-${tab.id}`);
      button.setAttribute('aria-selected', tab.active ? 'true' : 'false');

      // Añadir icono si está presente
      if (tab.icon) {
        const icon = document.createElement('i');
        icon.className = `fas ${tab.icon} me-2`;
        button.appendChild(icon);
      }

      // Añadir título
      const titleSpan = document.createElement('span');
      titleSpan.textContent = tab.title;
      button.appendChild(titleSpan);

      li.appendChild(button);
      nav.appendChild(li);
    });

    return nav;
  }

  /**
   * Crea el contenedor de contenido de tabs (tab-content)
   * @private
   */
  createTabContent(tabs) {
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    tabContent.id = `content-${this.reportId}`;

    tabs.forEach((tab, index) => {
      const pane = document.createElement('div');
      pane.className = `tab-pane fade ${tab.active ? 'show active' : ''}`;
      pane.id = `${this.reportId}-content-${tab.id}`;
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-labelledby', `${this.reportId}-tab-${tab.id}`);
      pane.setAttribute('tabindex', '0');

      // Renderizar contenido solo para el tab activo (lazy para los demas)
      if (typeof tab.contentRenderer === 'function') {
        this._lazyRenderers.set(tab.id, tab.contentRenderer);
        if (tab.active) {
          this._renderTabContent(tab.id, pane);
        }
      } else {
        // Contenido placeholder
        pane.innerHTML = `
          <div class="text-muted text-center py-4">
            <i class="fas fa-inbox fa-3x mb-3"></i>
            <p>Contenido del tab "${tab.title}"</p>
          </div>
        `;
      }

      tabContent.appendChild(pane);
    });

    return tabContent;
  }

  _renderTabContent(tabId, paneOverride = null) {
    if (this._renderedTabs.has(tabId)) {
      return;
    }

    const renderer = this._lazyRenderers.get(tabId);
    if (typeof renderer !== 'function') {
      return;
    }

    const pane =
      paneOverride ||
      document.getElementById(`${this.reportId}-content-${tabId}`);
    if (!pane) {
      return;
    }

    try {
      renderer(pane);
      this._renderedTabs.add(tabId);
    } catch (error) {
      console.error(`❌ Error renderizando contenido del tab ${tabId}:`, error);
      pane.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle me-2"></i>
          Error al cargar el contenido del tab
        </div>
      `;
    }
  }

  /**
   * Configura los event listeners para cambios de tab
   * @private
   */
  setupEventListeners(container) {
    const navButtons = container.querySelectorAll('[data-bs-toggle="tab"]');

    navButtons.forEach(button => {
      button.addEventListener('shown.bs.tab', (event) => {
        const targetId = event.target.getAttribute('data-bs-target');
        const tabId = targetId.replace(`#${this.reportId}-content-`, '');
        this.activeTabId = tabId;

        console.log(`📑 Tab activado: ${tabId}`);

        // Lazy render del contenido si aplica
        this._renderTabContent(tabId);

        // Disparar evento personalizado
        const customEvent = new CustomEvent('reportTabChanged', {
          detail: {
            reportId: this.reportId,
            tabId: tabId,
            target: event.target
          },
          bubbles: true
        });
        container.dispatchEvent(customEvent);
      });
    });
  }

  /**
   * Activa un tab específico programáticamente
   *
   * @param {string} tabId - ID del tab a activar
   * @returns {boolean} true si se activó exitosamente
   */
  activateTab(tabId) {
    const tabButton = document.getElementById(`${this.reportId}-tab-${tabId}`);

    if (!tabButton) {
      console.error(`❌ Tab no encontrado: ${tabId}`);
      return false;
    }

    // Usar la API de Bootstrap para activar el tab
    const tab = new bootstrap.Tab(tabButton);
    tab.show();

    this.activeTabId = tabId;
    console.log(`✅ Tab activado programáticamente: ${tabId}`);

        // Lazy render del contenido si aplica
        this._renderTabContent(tabId);

    return true;
  }

  /**
   * Obtiene el ID del tab actualmente activo
   * @returns {string|null}
   */
  getActiveTabId() {
    return this.activeTabId;
  }

  /**
   * Obtiene la configuración de un tab específico
   * @param {string} tabId
   * @returns {Object|null}
   */
  getTabConfig(tabId) {
    return this.tabs.find(t => t.id === tabId) || null;
  }

  /**
   * Actualiza el contenido de un tab existente
   *
   * @param {string} tabId - ID del tab
   * @param {Function} contentRenderer - Nueva función de renderizado
   */
  updateTabContent(tabId, contentRenderer) {
    const pane = document.getElementById(`${this.reportId}-content-${tabId}`);

    if (!pane) {
      console.error(`❌ Panel de tab no encontrado: ${tabId}`);
      return false;
    }

    // Limpiar contenido existente
    pane.innerHTML = '';

    // Renderizar nuevo contenido
    if (typeof contentRenderer === 'function') {
      try {
        contentRenderer(pane);
        console.log(`✅ Contenido del tab ${tabId} actualizado`);
        return true;
      } catch (error) {
        console.error(`❌ Error actualizando contenido del tab ${tabId}:`, error);
        return false;
      }
    }

    return false;
  }

  /**
   * Destruye el gestor de tabs y limpia referencias
   */
  destroy() {
    this.tabs = [];
    this._lazyRenderers = new Map();
    this._renderedTabs = new Set();
    this.activeTabId = null;
    console.log(`🗑️ ReportTabManager destruido: ${this.reportId}`);
  }
}

// Exponer en el scope global para compatibilidad
if (typeof window !== 'undefined') {
  window.ReportTabManager = ReportTabManager;
}
