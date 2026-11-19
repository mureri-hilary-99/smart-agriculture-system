import { api } from "../api.js";
import {
  card,
  display,
  errorState,
  jsonPanel,
  pageIntro,
  selectField,
  statusLine,
  textField,
  textareaField,
} from "../components.js";

const DEFAULT_RANGES = JSON.stringify(
  { N: [0, 120], P: [0, 80], K: [0, 120], ph: [5.5, 7.5], temperature: [18, 32], humidity: [40, 85], rainfall: [80, 220] },
  null,
  2
);

export function render() {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Crop management",
        description: "Administrative catalogue maintenance. Changes here should stay consistent with the trained model class list.",
        index: "Endpoint 30 / 36",
      })}</div>

      <div class="col-5">
        ${card({
          title: "Catalogue write",
          meta: "Admin",
          body: `<form id="cropAdminForm" class="form-stack">
            ${selectField("method", "Operation", [
              { value: "POST", label: "Create crop" },
              { value: "PATCH", label: "Update crop" },
              { value: "DELETE", label: "Delete crop" },
            ])}
            ${textField("code", "Crop code", { required: true, placeholder: "maize" })}
            ${textField("name", "Name", { placeholder: "Maize" })}
            ${textField("local_name", "Local name", { placeholder: "Mahindi" })}
            ${selectField("is_active", "Active", [
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ], "true")}
            ${textareaField("optimal", "Optimal ranges (JSON object of factor to [min, max])", DEFAULT_RANGES)}
            <div class="actions"><button class="btn" type="submit" id="cropAdminButton">Submit change</button></div>
            <div id="cropAdminStatus" class="status-line hidden"></div>
          </form>`,
        })}
      </div>

      <div class="col-7">
        ${card({
          title: "Response",
          meta: "API result",
          body: '<div id="cropAdminResult">' + statusLine("No catalogue change submitted in this session.", "muted") + "</div>",
        })}
      </div>
    </div>`;
}

export async function init() {
  const form = document.querySelector("#cropAdminForm");
  const method = form.elements.method;
  const button = document.querySelector("#cropAdminButton");
  const status = document.querySelector("#cropAdminStatus");
  const output = document.querySelector("#cropAdminResult");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const operation = data.get("method");
    const code = String(data.get("code") || "").trim();

    if (!code) {
      status.className = "status-line error";
      status.textContent = "Crop code is required.";
      return;
    }

    let optimal;
    try {
      optimal = JSON.parse(data.get("optimal") || "{}");
    } catch {
      status.className = "status-line error";
      status.textContent = "Optimal ranges must be valid JSON.";
      return;
    }

    let body;
    if (operation !== "DELETE") {
      body = {
        code,
        name: data.get("name"),
        local_name: data.get("local_name"),
        optimal,
        is_active: data.get("is_active") === "true",
      };
      if (operation === "PATCH") delete body.code;
    }

    button.disabled = true;
    status.className = "status-line";
    status.textContent = operation + " /api/v1/crops" + (operation === "POST" ? "" : "/" + code);
    output.innerHTML = '<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-block"></div>';

    try {
      const path = operation === "POST" ? "/api/v1/crops" : `/api/v1/crops/${encodeURIComponent(code)}`;
      const result = operation === "DELETE"
        ? await api.del(path)
        : operation === "PATCH"
          ? await api.patch(path, body)
          : await api.post(path, body);

      status.className = "status-line";
      status.textContent = operation === "DELETE" ? "Crop removed." : "Catalogue saved.";
      output.innerHTML = result ? jsonPanel(result) : statusLine("Delete completed with no response body.", "muted");
    } catch (error) {
      status.className = "status-line error";
      status.textContent = error.message;
      output.innerHTML = errorState(error);
    } finally {
      button.disabled = false;
    }
  });
}
