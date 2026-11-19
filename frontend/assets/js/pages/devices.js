/* Devices page — GET /devices (17) and POST /devices (18). */

import { requireAuth } from "../auth.js";
import { apiRequest, errorMessage } from "../api.js";
import { qs, setAlert, formValues, numberOrNull, escapeHtml, skeletonRows, debounce, busy } from "../ui.js";

const gate = requireAuth();
if (gate) {
  if (gate.unauthorized) {
    setAlert(qs("#devices-alert"), "warn", "Administrator access is required to register devices.");
  } else {
    const alertBox = qs("#devices-alert");
    const listTarget = qs("#device-list");
    const filter = qs("#filter-farm");
    const form = qs("#device-register");
    const submit = qs("#device-register-submit");
    const keyPanel = qs("#key-panel");
    const keyValue = qs("#device-key-value");

    async function loadDevices() {
      setAlert(alertBox, "", "");
      listTarget.innerHTML = `<div class="table-wrap"><table><tbody>${skeletonRows(4, 4)}</tbody></table></div>`;
      try {
        const data = await apiRequest("/api/v1/devices", {
          auth: true,
          query: { farm_id: numberOrNull(filter.value) }
        });
        const items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) {
          listTarget.innerHTML = '<div class="table-empty">No devices registered.</div>';
          return;
        }
        listTarget.innerHTML = `
          <div class="table-wrap"><table>
            <thead><tr><th>Label</th><th>Type</th><th>Status</th><th>Last seen</th></tr></thead>
            <tbody>${items.map((device) => `
              <tr>
                <td>${escapeHtml(device.label)}</td>
                <td>${escapeHtml(device.type)}</td>
                <td>${escapeHtml(device.status || "—")}</td>
                <td class="small muted">${escapeHtml(device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "—")}</td>
              </tr>`).join("")}</tbody>
          </table></div>`;
      } catch (error) {
        listTarget.innerHTML = "";
        setAlert(alertBox, "error", errorMessage(error));
      }
    }

    filter?.addEventListener("input", debounce(loadDevices, 300));

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      setAlert(alertBox, "", "");
      const values = formValues(form);
      const payload = {
        farm_id: numberOrNull(values.farm_id),
        label: (values.label || "").trim(),
        type: values.type || "esp32"
      };
      if (!payload.farm_id || !payload.label) {
        setAlert(alertBox, "error", "Farm ID and label are required.");
        return;
      }
      busy(submit, true, "Register device");
      try {
        const created = await apiRequest("/api/v1/devices", { method: "POST", auth: true, body: payload });
        keyPanel.style.display = "block";
        keyValue.textContent = created.device_key || "(no key returned)";
        keyPanel.dataset.key = created.device_key || "";
        setAlert(alertBox, "info", `Device ${created.id} registered.`);
        form.reset();
        await loadDevices();
      } catch (error) {
        setAlert(alertBox, "error", errorMessage(error));
      } finally {
        busy(submit, false, "Register device");
      }
    });

    qs("#copy-key")?.addEventListener("click", async () => {
      const key = keyPanel.dataset.key || "";
      if (!key) return;
      try {
        await navigator.clipboard.writeText(key);
        setAlert(alertBox, "info", "Device key copied to clipboard.");
      } catch {
        setAlert(alertBox, "warn", "Clipboard access denied. Select and copy the key manually.");
      }
    });

    loadDevices();
  }
}
