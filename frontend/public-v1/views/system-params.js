import { api } from "../api.js";
import {
  card,
  display,
  errorState,
  fmtDate,
  pageIntro,
  skeletonRows,
  statusLine,
  table,
  textField,
  textareaField,
} from "../components.js";

export function render() {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "System parameters",
        description: "Runtime configuration such as the confidence threshold and refresh intervals. Values are stored as JSON so types are preserved.",
        index: "Endpoint 31 / 36",
      })}</div>

      <div class="col-7">
        ${card({
          title: "Registered parameters",
          meta: "GET / PATCH",
          body: '<div id="paramsResult">' + skeletonRows(6) + "</div>",
        })}
      </div>

      <div class="col-5">
        ${card({
          title: "Add or update",
          meta: "PATCH",
          body: `<form id="paramForm" class="form-stack">
            ${textField("key", "Parameter key", { required: true, placeholder: "min_confidence" })}
            ${textareaField("value", "JSON value", "0.60", "Use 0.60, true, or {\"days\":7}.")}
            <div class="actions"><button class="btn" type="submit" id="paramButton">Save parameter</button></div>
            <div id="paramStatus" class="status-line hidden"></div>
          </form>`,
        })}
      </div>
    </div>`;
}

function parseValue(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function init() {
  const output = document.querySelector("#paramsResult");
  const form = document.querySelector("#paramForm");
  const button = document.querySelector("#paramButton");
  const status = document.querySelector("#paramStatus");

  async function load() {
    output.innerHTML = skeletonRows(6);
    try {
      const data = await api.get("/api/v1/admin/system-params");
      const items = Array.isArray(data?.items)
        ? data.items
        : Object.entries(data || {}).map(([key, value]) => ({ key, value }));

      if (!items.length) {
        output.innerHTML = '<div class="empty">No system parameters registered.</div>';
        return;
      }

      output.innerHTML = table(
        ["Key", "Value", "Updated", "Action"],
        items.map((item) => {
          const key = String(item.key ?? "");
          const json = JSON.stringify(item.value ?? null);
          return [
            display(key),
            `<input data-value="${display(key)}" value="${display(json)}" aria-label="Value for ${display(key)}" />`,
            fmtDate(item.updated_at),
            `<button class="btn secondary compact" type="button" data-save="${display(key)}">Save</button>`,
          ];
        })
      );
    } catch (error) {
      output.innerHTML = errorState(error);
    }
  }

  async function save(key, raw) {
    status.className = "status-line";
    status.textContent = "Saving " + key + "...";
    try {
      const result = await api.patch("/api/v1/admin/system-params", { [key]: parseValue(raw) });
      status.className = "status-line";
      status.textContent = key + " saved.";
      await load();
      return result;
    } catch (error) {
      status.className = "status-line error";
      status.textContent = error.message;
      return null;
    }
  }

  output.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-save]");
    if (!trigger) return;
    const key = trigger.dataset.save;
    const input = output.querySelector(`[data-value="${CSS.escape(key)}"]`);
    save(key, input?.value ?? "");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    button.disabled = true;
    await save(data.get("key"), data.get("value"));
    button.disabled = false;
  });

  await load();
}
