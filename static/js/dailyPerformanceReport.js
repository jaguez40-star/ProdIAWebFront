/**
 * 📊 Daily Performance Report
 *
 * Reporte especializado para "Desempeño de la Producción (diario)" con tabs.
 * Tab 1: Gráfico de desempeño + Tabla de resumen diferidas
 * Tab 2: Card de resumen mensual
 *
 * @author Claude Code
 * @version 1.0.0
 */

class DailyPerformanceReport {
  constructor() {
    this.reportId = `daily-perf-${Date.now()}`;
    this.tabManager = null;
    this._resizeHandlers = new Map();
    this._resizeObserverMap = new Map();
  }

  /**
   * Renderiza el reporte completo con tabs
   *
   * @param {HTMLElement} container - Contenedor donde se renderiza el reporte
   * @param {Object} data - Datos del reporte
   * @param {Object} data.chartData - Datos del gráfico Plotly
   * @param {Object} data.deferredTable - Tabla de resumen diferidas
   * @param {Object} data.summaryTable - Tabla de resumen mensual
   * @param {Object} data.analysisTable - Tabla de análisis gerencial
   * @param {Object} data.productionTypesTable - Tabla de producción por tipo
   */
  renderWithTabs(container, data) {
    console.log("📊 DailyPerformanceReport.renderWithTabs llamado con:", data);

    if (!container) {
      console.error("❌ Container no proporcionado");
      return;

    if (window.ChatManager && typeof window.ChatManager.setDailyReportMode === "function") {
      window.ChatManager.setDailyReportMode(true);
    }
    }

    // Limpiar contenedor
    container.innerHTML = "";

    // Crear configuración de tabs
    const tabsConfig = {
      containerId: `${this.reportId}-tabs`,
      tabs: [
        {
          id: "resumen-diario",
          title: "Resumen Diario",
          icon: "fa-chart-line",
          active: true,
          contentRenderer: (tabPane) => this.createTab1Content(tabPane, data),
        },
        {
          id: "resumen-mes",
          title: "Resumen Mes",
          icon: "fa-calendar-alt",
          active: false,
          contentRenderer: (tabPane) => this.createTab2Content(tabPane, data),
        },
        {
          id: "produccion-map",
          title: "Producción-Map",
          icon: "fa-globe",
          active: false,
          contentRenderer: (tabPane) => this.createMapsTab(tabPane, data),
        },
      ],
    };

    // Crear tabs usando ReportTabManager
    this.tabManager = new ReportTabManager(this.reportId);
    const tabsContainer = this.tabManager.createTabContainer(tabsConfig);

    if (tabsContainer) {
      container.appendChild(tabsContainer);
      console.log("✅ Tabs de reporte diario creados exitosamente");
    } else {
      console.error("❌ Error creando tabs");
    }
  }

  /**
   * Crea el contenido del Tab 1: Gráfico + Diferidas
   * @private
   */
  createTab1Content(container, data) {
    console.log("📈 Creando contenido Tab 1 - Resumen Diario");

    // Crear sección del gráfico
    if (data.chartData) {
      const chartSection = this.createChartSection(data.chartData);
      container.appendChild(chartSection);
    }

    // Crear tabla de resumen diferidas
    if (data.deferredTable) {
      const deferredCard = ReportCardFactory.createDeferredSummaryCard(
        data.deferredTable
      );
      container.appendChild(deferredCard);
    }

    console.log("✅ Tab 1 renderizado");
  }

  /**
   * Crea el contenido del Tab 2: Resumen Mes
   * @private
   */
  createTab2Content(container, data) {
    console.log("📅 Creando contenido Tab 2 - Resumen Mes");

    // Crear card de resumen mensual
    if (data.summaryTable) {
      const summaryCard = ReportCardFactory.createSummaryTableCard(
        data.summaryTable
      );
      container.appendChild(summaryCard);
    } else {
      // Placeholder si no hay datos
      const placeholder = document.createElement("div");
      placeholder.className = "alert alert-info";
      placeholder.innerHTML = `
        <i class="fas fa-info-circle me-2"></i>
        No hay datos de resumen mensual disponibles
      `;
      container.appendChild(placeholder);
    }

    console.log("✅ Tab 2 renderizado");
  }

  /**
   * Crea el contenido del Tab 3: Producción-Map
   * @private
   */
  createMapsTab(container, data) {
    console.log("🗺️ Creando contenido Tab Producción-Map (diario)");

    if (!container) {
      console.warn("Contenedor no disponible para Producción-Map");
      return;
    }

    container.classList.add("map-tab-container");

    const mapsData = data?.maps || {};
    let slides = [
      {
        id: "map-variacion",
        title: "HEATMAP VARIACION % PRODUCCION: GERENCIAS OPERATIVAS",
        html:
          mapsData.map_variation_html ||
          mapsData.mapVariationHtml ||
          mapsData.map_variation ||
          null,
      },
      {
        id: "map-ger",
        title: "DISTRIBUCIÓN DE LA PRODUCCIÓN: GERENCIAS OPERATIVAS",
        html: mapsData.map_ger_html || mapsData.mapGerHtml || null,
      },
      {
        id: "map-campo",
        title: "DISTRIBUCIÓN DE LA PRODUCCIÓN: CAMPOS PRODUCTORES",
        html: mapsData.map_campo_html || mapsData.mapCampoHtml || null,
      },
    ].filter((slide) => typeof slide.html === "string" && slide.html.trim().length);

    // Reordenar siempre priorizando el mapa de variación cuando esté disponible
    if (slides.length > 1) {
      const preferredOrder =
        (Array.isArray(mapsData?.slideOrder) && mapsData.slideOrder) ||
        (Array.isArray(mapsData?.order) && mapsData.order) ||
        null;

      if (preferredOrder) {
        const orderMap = new Map(
          preferredOrder.map((slideId, idx) => [String(slideId), idx])
        );
        slides.sort((a, b) => {
          const aOrder =
            orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
          const bOrder =
            orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
          return aOrder - bOrder || a.title.localeCompare(b.title);
        });
      }

      const variationIndex = slides.findIndex(
        (slide) => slide.id === "map-variacion"
      );
      if (variationIndex > 0) {
        const [variationSlide] = slides.splice(variationIndex, 1);
        slides.unshift(variationSlide);
      }
    }

    if (!slides.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "alert alert-info";
      placeholder.innerHTML = `
        <i class="fas fa-info-circle me-2"></i>
        No se encontraron datos para renderizar los mapas de producción.
      `;
      container.appendChild(placeholder);
      return;
    }

    const carousel = document.createElement("div");
    carousel.className = "map-carousel";

    const slidesContainer = document.createElement("div");
    slidesContainer.className = "map-carousel-slides";

    slides.forEach((slide, index) => {
      const slideWrapper = document.createElement("div");
      slideWrapper.className = "map-carousel-slide";
      slideWrapper.dataset.index = index.toString();

      const title = document.createElement("h5");
      title.className = "map-carousel-title";
      title.textContent = slide.title;
      slideWrapper.appendChild(title);

      const frame = document.createElement("iframe");
      frame.setAttribute("loading", "lazy");
      frame.setAttribute("title", slide.title);
      frame.srcdoc = slide.html;
      frame.className = "map-carousel-frame";
      slideWrapper.appendChild(frame);

      slidesContainer.appendChild(slideWrapper);
    });

    const controls = document.createElement("div");
    controls.className = "map-carousel-controls";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "btn btn-outline-secondary btn-sm";
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "btn btn-outline-secondary btn-sm";
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';

    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);

    const indicators = document.createElement("div");
    indicators.className = "map-carousel-indicators";
    slides.forEach((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "map-carousel-dot";
      dot.dataset.index = index.toString();
      indicators.appendChild(dot);
    });

    carousel.appendChild(slidesContainer);
    carousel.appendChild(controls);
    carousel.appendChild(indicators);
    container.appendChild(carousel);

    let currentIndex = 0;

    const updateView = (index) => {
      const slideElements = carousel.querySelectorAll(".map-carousel-slide");
      const dots = carousel.querySelectorAll(".map-carousel-dot");

      slideElements.forEach((slideEl, idx) => {
        slideEl.classList.toggle("active", idx === index);
      });

      dots.forEach((dot, idx) => {
        dot.classList.toggle("active", idx === index);
      });

      currentIndex = index;
    };

    const goTo = (direction) => {
      const total = slides.length;
      const nextIndex = (currentIndex + direction + total) % total;
      updateView(nextIndex);
    };

    prevBtn.addEventListener("click", () => goTo(-1));
    nextBtn.addEventListener("click", () => goTo(1));
    indicators.querySelectorAll(".map-carousel-dot").forEach((dot) => {
      dot.addEventListener("click", (event) => {
        const target = event.currentTarget;
        if (!target) return;
        const index = Number(target.dataset.index || 0);
        updateView(index);
      });
    });

    updateView(0);
  }
  /**
   * Crea la sección del gráfico Plotly
   * @private
   */
  createChartSection(chartData) {
    console.log("📊 Creando sección de gráfico");

    const card = document.createElement("div");
    card.className = "card mb-3";

    // Header
    const header = document.createElement("div");
    header.className = "card-header bg-light";

    // Extract title text (handle both string and object formats)
    let titleText = "Panorama de Producción";
    if (chartData.layout?.title) {
      if (typeof chartData.layout.title === 'string') {
        titleText = chartData.layout.title;
      } else if (chartData.layout.title.text) {
        titleText = chartData.layout.title.text;
      }
    }

    header.innerHTML = `
      <h6 class="mb-0">
        <i class="fas fa-chart-area"></i>
        ${titleText}
      </h6>
    `;
    card.appendChild(header);

    // Body con el gráfico
    const body = document.createElement("div");
    body.className = "card-body";
    body.style.minHeight = "500px";
    body.style.padding = "1rem";

    // Contenedor flex para gráfico principal + barras laterales
    const chartRow = document.createElement("div");
    chartRow.style.display = "flex";
    chartRow.style.gap = "1px";
    chartRow.style.alignItems = "stretch";
    chartRow.style.width = "100%";

    // Gráfico principal
    const chartElement = document.createElement("div");
    chartElement.id = `chart-${this.reportId}`;
    chartElement.style.flex = "1 1 auto";
    chartElement.style.minWidth = "0";
    chartElement.style.height = "500px";

    // Barras laterales
    const barsElement = document.createElement("div");
    barsElement.id = `bars-${this.reportId}`;
    barsElement.style.flex = "0 0 160px";
    barsElement.style.maxWidth = "180px";
    barsElement.style.height = "500px";

    chartRow.appendChild(chartElement);
    chartRow.appendChild(barsElement);
    body.appendChild(chartRow);
    card.appendChild(body);

    // Renderizar gráfico Plotly después de un pequeño delay
    // para asegurar que el contenedor esté completamente renderizado
    setTimeout(() => {
      this.renderPlotlyChart(chartElement, chartData);
      this.renderSideBars(barsElement, chartData);
    }, 100);

    return card;
  }

  /**
   * Renderiza el gráfico Plotly (con soporte para animaciones)
   * @private
   */
  renderPlotlyChart(chartElement, chartData) {
    console.log("🎨 Renderizando gráfico Plotly");

    if (typeof Plotly === "undefined") {
      if (typeof window.ensurePlotlyLoaded === "function") {
        window.ensurePlotlyLoaded().then((loaded) => {
          if (loaded && typeof Plotly !== "undefined") {
            this.renderPlotlyChart(chartElement, chartData);
            return;
          }
          console.error("❌ Plotly no está disponible");
          chartElement.innerHTML = `
            <div class="alert alert-danger">
              <i class="fas fa-exclamation-triangle me-2"></i>
              Plotly no está cargado
            </div>
          `;
        });
        return;
      }

      console.error("❌ Plotly no está disponible");
      chartElement.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle me-2"></i>
          Plotly no está cargado
        </div>
      `;
      return;
    }

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d"],
    };

    // Asegurar que el layout tenga configuración responsive y márgenes adecuados
    // IMPORTANTE: No sobrescribir los ejes, solo mejorar las propiedades existentes
    const enhancedLayout = {
      ...chartData.layout,
      autosize: true,
      margin: {
        l: 60,
        r: 60,  // Increased for secondary y-axis
        t: 40,
        b: 100,  // Increased for rotated labels
        pad: 4
      }
    };

    // Normalizar título y agregar espacio adicional
    if (enhancedLayout.title) {
      if (typeof enhancedLayout.title === "string") {
        enhancedLayout.title = { text: enhancedLayout.title };
      }
      enhancedLayout.title = {
        ...enhancedLayout.title,
        pad: {
          ...(enhancedLayout.title.pad || {}),
          t: (enhancedLayout.title.pad && enhancedLayout.title.pad.t) || 0,
          b: Math.max(
            24,
            enhancedLayout.title.pad && enhancedLayout.title.pad.b
              ? enhancedLayout.title.pad.b
              : 24
          ),
        },
      };
    }

    // Mejorar xaxis sin sobrescribir
    if (enhancedLayout.xaxis) {
      enhancedLayout.xaxis = {
        ...enhancedLayout.xaxis,
        automargin: true,
        tickangle: -45
      };
    }

    // Mejorar yaxis sin sobrescribir
    if (enhancedLayout.yaxis) {
      enhancedLayout.yaxis = {
        ...enhancedLayout.yaxis,
        automargin: true
      };
    }

    // Preservar yaxis2 si existe (para barras)
    if (chartData.layout?.yaxis2) {
      enhancedLayout.yaxis2 = {
        ...chartData.layout.yaxis2,
        automargin: true
      };
    }

    // Preservar yaxis3 si existe
    if (chartData.layout?.yaxis3) {
      enhancedLayout.yaxis3 = {
        ...chartData.layout.yaxis3,
        automargin: true
      };
    }

    // Ajustar leyenda para evitar superposición con el título
    enhancedLayout.legend = {
      ...(chartData.layout?.legend || {}),
      y: (chartData.layout?.legend && chartData.layout.legend.y !== undefined)
        ? chartData.layout.legend.y
        : 0.95,
      yanchor: "top",
      orientation: chartData.layout?.legend?.orientation || "h",
      x: (chartData.layout?.legend && chartData.layout.legend.x !== undefined)
        ? chartData.layout.legend.x
        : 0.5,
      xanchor: chartData.layout?.legend?.xanchor || "center",
    };

    // Verificar si hay frames para animación
    if (chartData.frames && Array.isArray(chartData.frames) && chartData.frames.length > 0) {
      console.log(`🎬 Gráfico con animación (${chartData.frames.length} frames)`);

      const numFrames = chartData.frames.length;
      const frameDuration = chartData.frame_duration || 50;

      // Inicializar con el primer frame
      const initialData = chartData.frames[0].data;

      Plotly.newPlot(chartElement, initialData, enhancedLayout, config)
        .then(() => {
          console.log("✅ Plot creado, iniciando animación...");
          this._registerChartResize(chartElement);

          return new Promise((resolve) => {
            let currentFrame = 0;

            const animateNextFrame = () => {
              if (currentFrame < numFrames) {
                const frameData = chartData.frames[currentFrame].data;
                Plotly.react(chartElement, frameData, enhancedLayout, config);
                currentFrame++;
                setTimeout(animateNextFrame, frameDuration);
              } else {
                console.log("✅ Animación completada");
                resolve();
              }
            };

            setTimeout(animateNextFrame, 100);
          });
        })
        .then(() => {
          this._registerChartResize(chartElement);
          // Resize charts after animation
          if (window.panelManager && window.panelManager.resizePlotlyCharts) {
            setTimeout(() => {
              window.panelManager.resizePlotlyCharts();
            }, 100);
          }
        })
        .catch((error) => {
          console.error("❌ Error en animación:", error);
          // Fallback: mostrar sin animación
          Plotly.newPlot(chartElement, chartData.traces, enhancedLayout, config)
            .then(() => {
              this._registerChartResize(chartElement);
            })
            .catch((err) => {
              console.error("❌ Error en fallback:", err);
              chartElement.innerHTML = `
                <div class="alert alert-danger m-3">
                  <i class="fas fa-exclamation-triangle"></i>
                  Error al renderizar el gráfico
                </div>
              `;
            });
        });
    } else {
      // Sin animación, renderizado normal
      console.log("📊 Gráfico sin animación");

      Plotly.newPlot(chartElement, chartData.traces, enhancedLayout, config)
        .then(() => {
          console.log("✅ Gráfico renderizado exitosamente");
          this._registerChartResize(chartElement);

          if (window.panelManager && window.panelManager.resizePlotlyCharts) {
            setTimeout(() => {
              window.panelManager.resizePlotlyCharts();
            }, 100);
          }
        })
        .catch((err) => {
          console.error("❌ Error renderizando gráfico:", err);
          chartElement.innerHTML = `
            <div class="alert alert-danger m-3">
              <i class="fas fa-exclamation-triangle"></i>
              Error al renderizar el gráfico: ${err.message}
            </div>
          `;
        });
    }
  }

  _registerChartResize(chartElement) {
    if (!(chartElement instanceof HTMLElement)) {
      return;
    }

    const previousHandler = this._resizeHandlers.get(chartElement);
    if (previousHandler) {
      window.removeEventListener("resize", previousHandler);
    }

    const resizeHandler = () => {
      if (typeof Plotly === "undefined") return;
      // Skip resize if element was removed from the DOM or is not displayed
      if (!document.body.contains(chartElement) || !chartElement.offsetParent) return;
      Plotly.Plots.resize(chartElement).catch(() => {});
    };

    resizeHandler();
    window.addEventListener("resize", resizeHandler);
    this._resizeHandlers.set(chartElement, resizeHandler);

    if (typeof ResizeObserver !== "undefined") {
      const previousObserver = this._resizeObserverMap.get(chartElement);
      if (previousObserver) {
        previousObserver.disconnect();
      }
      const observer = new ResizeObserver(() => resizeHandler());
      observer.observe(chartElement);
      this._resizeObserverMap.set(chartElement, observer);
    }
  }

  /**
   * Renderiza las barras laterales (P50, Reto 747k, Proyección)
   * @private
   */
  renderSideBars(barsElement, chartData) {
    console.log("📊 Renderizando barras laterales");

    if (typeof Plotly === "undefined") {
      console.warn("⚠️ Plotly no disponible para barras laterales");
      return;
    }

    // Datos de las barras (hardcoded por ahora)
    const barLabels = ["P50", "Reto 747k", "Proyeccion Sept"];
    const barValues = [749500, 755700, 750100];

    // Calcular rango Y compartido con el gráfico principal
    const combinedValues = [...barValues];
    if (Array.isArray(chartData?.traces)) {
      chartData.traces.forEach((trace) => {
        if (Array.isArray(trace?.y)) {
          trace.y.forEach((val) => {
            if (val !== null && val !== undefined) {
              const num = typeof val === "number" ? val : Number(val);
              if (!Number.isNaN(num) && Number.isFinite(num)) {
                combinedValues.push(num);
              }
            }
          });
        }
      });
    }

    let minY = Math.min(...combinedValues);
    let maxY = Math.max(...combinedValues);
    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
      minY = 700000;
      maxY = 775000;
    } else {
      // Forzar rango fijo 700k - 775k
      minY = 700000;
      maxY = 775000;
    }
    const sharedRange = [minY, maxY];

    // Crear trace de barras
    const barTrace = {
      type: "bar",
      x: barLabels,
      y: barValues,
      marker: { color: ["#FF5F00", "#CCD32A", "#00214D"] },
      text: ["749.5k", "755.7k", "750.1k"],
      textposition: "outside",
      hovertemplate: "%{x}: %{y:.1f}k<extra></extra>",
    };

    // Layout de las barras
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

    // Renderizar después de un pequeño delay para asegurar que el gráfico principal esté listo
    setTimeout(() => {
      Plotly.newPlot(barsElement, [barTrace], barLayout, barConfig)
        .then(() => {
          console.log("✅ Barras laterales renderizadas");
        })
        .catch((err) => {
          console.error("❌ Error renderizando barras laterales:", err);
        });
    }, 200);
  }

  /**
   * Limpia y destruye el reporte
   */
  destroy() {
    if (this.tabManager) {
      this.tabManager.destroy();
      this.tabManager = null;
    }
    if (this._resizeHandlers) {
      this._resizeHandlers.forEach((handler) => {
        window.removeEventListener("resize", handler);
      });
      this._resizeHandlers.clear();
    }
    if (this._resizeObserverMap) {
      this._resizeObserverMap.forEach((observer) => observer.disconnect());
      this._resizeObserverMap.clear();
    }
    console.log(`🗑️ DailyPerformanceReport destruido: ${this.reportId}`);
  }
}

// Exponer en el scope global
if (typeof window !== "undefined") {
  window.DailyPerformanceReport = DailyPerformanceReport;
}
