/* Farms page — GET /farms (12) and POST /farms (13). */

import { requireAuth } from "../auth.js";
import { apiRequest, errorMessage } from "../api.js";
import { qs, setAlert, formValues, numberOrNull, escapeHtml, skeletonRows, busy } from "../ui.js";

const gate = requireAuth();
if (gate) {
  if (gate.unauthorized) {
    setAlert(qs("#farms-alert"), "warn", "Administrator access is required for this page.");
  } else {
    const alertBox = qs("#farms-alert");
    const listTarget = qs("#farm-list");
    const pageInfo = qs("#farm-page-info");
    const prev = qs("#farms-prev");
    const next = qs("#farms-next");
    const form = qs("#farm-create");
    const submit = qs("#farm-create-submit");
    let page = 1;
    const pageSize = 20;

    function renderPage(data) {
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) {
        listTarget.innerHTML = '<div class="table-empty">No farms recorded yet.</div>';
      } else {
        listTarget.innerHTML = `
          <div class="table-wrap"><table>
            <thead><tr><th>Farm</th><th>County</th><th>Coordinates</th><th></th></tr></thead>
            <tbody>${items.map((farm) => `
              <tr>
                <td>${escapeHtml(farm.name)}</td>
                <td>${escapeHtml(farm.county || "—")}</td>
                <td class="small muted">${escapeHtml(farm.latitude)}, ${escapeHtml(farm.longitude)}</td>
                <td><a class="link-arrow" href="farm-detail.html?id=${encodeURIComponent(farm.id)}">Open</a></td>
              </tr>`).join("")}</tbody>
          </table></div>`;
      }
      pageInfo.textContent = `Page ${data.page || page} · ${data.total ?? items.length} farm(s)`;
      prev.disabled = page <= 1;
      next.disabled = items.length < pageSize;
    }

    async function loadFarms() {
      setAlert(alertBox, "", "");
      listTarget.innerHTML = `<div class="table-wrap"><table><tbody>${skeletonRows(4, 4)}</tbody></table></div>`;
      try {
        const data = await apiRequest("/api/v1/farms", {
          auth: true,
          query: { page, page_size: pageSize }
        });
        renderPage(data);
      } catch (error) {
        listTarget.innerHTML = "";
        pageInfo.textContent = "";
        setAlert(alertBox, "error", errorMessage(error));
      }
    }

    prev?.addEventListener("click", () => { if (page > 1) { page -= 1; loadFarms(); } });
    next?.addEventListener("click", () => { page += 1; loadFarms(); });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      setAlert(alertBox, "", "");
      const values = formValues(form);
      const payload = {
        name: (values.name || "").trim(),
        latitude: numberOrNull(values.latitude),
        longitude: numberOrNull(values.longitude)
      };
      if (values.county && values.county.trim()) payload.county = values.county.trim();
      if (!payload.name || payload.latitude === null || payload.longitude === null) {
        setAlert(alertBox, "error", "Name, latitude and longitude are required.");
        return;
      }
      busy(submit, true, "Add farm");
      try {
        const created = await apiRequest("/api/v1/farms", { method: "POST", auth: true, body: payload });
        form.reset();
        setAlert(alertBox, "info", `Farm ${created.name || ""} created.`);
        page = 1;
        await loadFarms();
      } catch (error) {
        setAlert(alertBox, "error", errorMessage(error));
      } finally {
        busy(submit, false, "Add farm");
      }
    });

    loadFarms();
  }
}
