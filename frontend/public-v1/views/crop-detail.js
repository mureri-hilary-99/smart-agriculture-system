import { api } from "../api.js";
import {
  card,
  display,
  errorState,
  figure,
  jsonPanel,
  pageIntro,
  skeletonBlock,
  table,
  textField,
} from "../components.js";

export function render(params = {}) {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Crop detail",
        description: "Suitability reference for one crop. Ranges are advisory and must be interpreted with local conditions.",
        index: "Endpoint 29 / 36",
      })}</div>

      <div class="col-4">
        ${card({
          title: "Find crop",
          meta: "GET by code",
          body: `<form id="cropDetailForm" class="form-stack">
            ${textField("code", "Crop code", { value: params.code || "maize", required: true, placeholder: "e.g. maize" })}
            <div class="actions"><button class="btn" type="submit">Open crop</button></div>
            <a class="btn secondary" href="#/crops">Back to catalogue</a>
          </form>`,
        })}
      </div>

      <div class="col-8">
        ${card({
          title: "Suitability profile",
          meta: "Crop",
          body: '<div id="cropDetailResult">' + skeletonBlock(6) + "</div>",
        })}
      </div>
    </div>`;
}

export async function init(params = {}, root = document) {
  const form = root.querySelector("#cropDetailForm");
  const output = root.querySelector("#cropDetailResult");

  async function load(code) {
    output.innerHTML = skeletonBlock(6);
    try {
      const crop = await api.get(`/api/v1/crops/${encodeURIComponent(code)}`);
      const rangeRows = Object.entries(crop.optimal || {}).map(([key, value]) => [
        display(key),
        display(Array.isArray(value) ? value[0] : value),
        display(Array.isArray(value) ? value[1] : "—"),
      ]);

      output.innerHTML = `
        <div class="grid">
          <div class="col-5">${figure("crop-placeholder.svg", "Crop rows illustration", crop.code || "Crop")}</div>
          <div class="col-7">
            <div class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
              <div class="metric"><div class="metric-label">Name</div><div class="metric-value">${display(crop.name)}</div></div>
              <div class="metric"><div class="metric-label">Local name</div><div class="metric-value">${display(crop.local_name)}</div></div>
              <div class="metric"><div class="metric-label">Code</div><div class="metric-value">${display(crop.code)}</div></div>
              <div class="metric"><div class="metric-label">Active</div><div class="metric-value">${display(crop.is_active)}</div></div>
            </div>
            <div style="margin-top:16px">
              <div class="metric-label">Optimal ranges</div>
              ${table(["Factor", "Minimum", "Maximum"], rangeRows)}
            </div>
            <div style="margin-top:16px">${jsonPanel(crop)}</div>
          </div>
        </div>`;
    } catch (error) {
      output.innerHTML = errorState(error);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = new FormData(form).get("code");
    const hash = `#/crops/detail?code=${encodeURIComponent(code)}`;
    if (window.location.hash === hash) load(code);
    else window.location.hash = hash;
  });

  if (params.code) await load(params.code);
  else output.innerHTML = '<div class="empty">Enter a crop code.</div>';
}
