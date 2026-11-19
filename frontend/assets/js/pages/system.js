/* System page — GET / and GET /health (endpoints 1-2). */

import { apiRequest, errorMessage } from "../api.js";
import { qs, setAlert, skeletonLines, escapeHtml } from "../ui.js";

const bannerResult = qs("#banner-result");
const healthResult = qs("#health-result");
const alertBox = qs("#system-alert");

function render(target, title, data) {
  if (!target) return;
  target.innerHTML = `
    <div class="status status--ok">200 OK</div>
    <dl class="data-grid" style="display:block">
      ${Object.entries(data || {}).map(([key, value]) => `
        <div class="data-cell" style="border-right:0">
          <div class="data-label">${escapeHtml(key)}</div>
          <div class="data-value small">${escapeHtml(typeof value === "object" ? JSON.stringify(value) : value)}</div>
        </div>`).join("")}
    </dl>`;
}

async function checkAll() {
  if (alertBox) alertBox.innerHTML = "";
  if (bannerResult) bannerResult.innerHTML = skeletonLines(3);
  if (healthResult) healthResult.innerHTML = skeletonLines(3);

  try {
    const [banner, health] = await Promise.all([apiRequest("/"), apiRequest("/health")]);
    render(bannerResult, "Banner", banner);
    render(healthResult, "Health", health);
    if (health.status !== "healthy") {
      setAlert(alertBox, "warn", "The health endpoint responded, but the service did not report 'healthy'.");
    }
  } catch (error) {
    if (bannerResult) bannerResult.innerHTML = "";
    if (healthResult) healthResult.innerHTML = "";
    setAlert(alertBox, "error", `Checks failed. ${errorMessage(error)}`);
  }
}

qs("#check-all")?.addEventListener("click", checkAll);
checkAll();
