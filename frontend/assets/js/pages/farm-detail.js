/* Farm detail — GET /farms/{id} (14) and PATCH /farms/{id} (15). */

import { requireAuth } from "../auth.js";
import { apiRequest, errorMessage } from "../api.js";
import { qs, setAlert, formValues, numberOrNull, escapeHtml, formatDate, skeletonLines, busy } from "../ui.js";

const gate = requireAuth();
const farmId = new URLSearchParams(location.search).get("id");

if (gate) {
  if (gate.unauthorized) {
    setAlert(qs("#farm-detail-alert"), "warn", "Administrator access is required for this page.");
  } else if (!farmId) {
    setAlert(qs("#farm-detail-alert"), "error", "No farm id was supplied. Open a farm from the farms page.");
  } else {
    const alertBox = qs("#farm-detail-alert");
    const readTarget = qs("#farm-read");
    const form = qs("#farm-edit");
    const submit = qs("#farm-edit-submit");

    function renderFarm(farm) {
      readTarget.innerHTML = `
        <div class="data-grid" style="display:block">
          <div class="data-cell" style="border-right:0"><div class="data-label">Farm ID</div><div class="data-value small">${escapeHtml(farm.id)}</div></div>
          <div class="data-cell" style="border-right:0"><div class="data-label">Name</div><div class="data-value small">${escapeHtml(farm.name)}</div></div>
          <div class="data-cell" style="border-right:0"><div class="data-label">County</div><div class="data-value small">${escapeHtml(farm.county || "—")}</div></div>
          <div class="data-cell" style="border-right:0"><div class="data-label">Latitude</div><div class="data-value small">${escapeHtml(farm.latitude)}</div></div>
          <div class="data-cell" style="border-right:0"><div class="data-label">Longitude</div><div class="data-value small">${escapeHtml(farm.longitude)}</div></div>
          <div class="data-cell" style="border-right:0"><div class="data-label">Created</div><div class="data-value small">${escapeHtml(formatDate(farm.created_at))}</div></div>
        </div>`;
      ["name", "latitude", "longitude", "county"].forEach((key) => {
        if (form.elements[key]) form.elements[key].value = farm[key] ?? "";
      });
    }

    async function loadFarm() {
      readTarget.innerHTML = skeletonLines(5);
      try {
        const farm = await apiRequest(`/api/v1/farms/${encodeURIComponent(farmId)}`, { auth: true });
        renderFarm(farm);
      } catch (error) {
        readTarget.innerHTML = "";
        setAlert(alertBox, "error", errorMessage(error));
      }
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      setAlert(alertBox, "", "");
      const values = formValues(form);
      const payload = {
        name: (values.name || "").trim(),
        latitude: numberOrNull(values.latitude),
        longitude: numberOrNull(values.longitude),
        county: (values.county || "").trim()
      };
      busy(submit, true, "Save changes");
      try {
        const updated = await apiRequest(`/api/v1/farms/${encodeURIComponent(farmId)}`, {
          method: "PATCH",
          auth: true,
          body: payload
        });
        renderFarm(updated);
        setAlert(alertBox, "info", "Farm updated.");
      } catch (error) {
        setAlert(alertBox, "error", errorMessage(error));
      } finally {
        busy(submit, false);
      }
    });

    loadFarm();
  }
}
