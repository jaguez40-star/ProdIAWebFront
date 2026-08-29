/**
 * Placeholder renderer for "Principales eventos de la semana y variación diaria - Pagina en construccion".
 * Deja el contenedor en blanco mostrando el mensaje recibido.
 */

export function renderPrincipalesEventosDeLaSemanaYVariaciNDiariaReport(container, payload) {
  if (!container) return;

  container.innerHTML = "";
  const message = payload?.message || "Principales eventos de la semana y variación diaria - Pagina en construccion";

  const notice = document.createElement("div");
  notice.className = "alert alert-info";
  notice.innerHTML = `
    <i class="fas fa-info-circle me-2"></i>
    $Principales eventos de la semana y variación diaria - Pagina en construccion
  `;
  container.appendChild(notice);
}

if (typeof window !== "undefined") {
  window.PrincipalesEventosDeLaSemanaYVariaciNDiariaRenderer = window.PrincipalesEventosDeLaSemanaYVariaciNDiariaRenderer || {};
  window.PrincipalesEventosDeLaSemanaYVariaciNDiariaRenderer.renderPrincipalesEventosDeLaSemanaYVariaciNDiariaReport = renderPrincipalesEventosDeLaSemanaYVariaciNDiariaReport;
}
