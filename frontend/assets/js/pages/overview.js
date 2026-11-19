/* Overview page — uses GET / and GET /health (endpoints 1-2). */

import { apiRequest, errorMessage } from "../api.js";
import { qs, setAlert, skeletonLines, escapeHtml } from "../ui.js";

const target = qs("#overview-status");

async function loadStatus() {
  if (!target) return;
  target.innerHTML = skeletonLines(4);
  try {
    const [banner, health] = await Promise.all([
      apiRequest("/"),
      apiRequest("/health")
    ]);
    const ok = health.status === "healthy";
    target.innerHTML = `
      <div class="status ${ok ? "status--ok" : "status--warn"}">${ok ? "Operational" : "Degraded"}</div>
      <div class="data-grid">
        <div class="data-cell"><div class="data-label">Service</div><div class="data-value small">${escapeHtml(banner.message || "—")}</div></div>
        <div class="data-cell"><div class="data-label">Health</div><div class="data-value small">${escapeHtml(health.status || "—")}</div></div>
      </div>
      <p class="small muted">Base URL: ${escapeHtml(window.AGRI_CONFIG.getApiBaseUrl())}</p>`;
  } catch (error) {
    target.innerHTML = "";
    setAlert(target, "error", `Status unavailable. ${errorMessage(error)}`);
  }
}

qs("#status-refresh")?.addEventListener("click", loadStatus);
loadStatus();
