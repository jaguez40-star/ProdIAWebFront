/**
 * Placeholder renderer for "Principales eventos de la semana y variacion diaria - Pagina en construccion".
 * Deja el contenedor en blanco mostrando el mensaje recibido.
 */

export function renderWeeklyEventsReport(container, payload) {
  if (!container) return;

  container.innerHTML = "";
  const message = payload?.message || "Principales eventos de la semana y variacion diaria - Pagina en construccion";

  const notice = document.createElement("div");
  notice.className = "alert alert-info";
  notice.innerHTML = `
    <i class="fas fa-info-circle me-2"></i>
    $Principales eventos de la semana y variacion diaria - Pagina en construccion
  `;
  container.appendChild(notice);
}

if (typeof window !== "undefined") {
  window.WeeklyEventsRenderer = window.WeeklyEventsRenderer || {};
  window.WeeklyEventsRenderer.renderWeeklyEventsReport = renderWeeklyEventsReport;
}
