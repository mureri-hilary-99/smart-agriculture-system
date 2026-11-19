import { api } from "../api.js";
import {
  alternativesList,
  card,
  confidenceBlock,
  display,
  errorState,
  fmtDate,
  isLowConfidence,
  jsonPanel,
  pageIntro,
  skeletonBlock,
  statusLine,
  textField,
} from "../components.js";

export function render(params = {}) {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Recommendation detail",
        description: "Single stored decision with the complete API payload, linked reading IDs and model metadata.",
        index: "Endpoint 27 / 36",
      })}</div>

      <div class="col-4">
        ${card({
          title: "Find record",
          meta: "GET by id",
          body: `<form id="recommendationDetailForm" class="form-stack">
            ${textField("id", "Recommendation ID", { type: "number", value: params.id || "", min: 1, required: true })}
            <div class="actions"><button class="btn" type="submit">Open record</button></div>
          </form>`,
        })}
      </div>

      <div class="col-8">
        ${card({
          title: "Record",
          meta: "Recommendation",
          body: '<div id="recommendationDetailResult">' + skeletonBlock(6) + "</div>",
        })}
      </div>
    </div>`;
}

export async function init(params = {}, root = document) {
  const form = root.querySelector("#recommendationDetailForm");
  const output = root.querySelector("#recommendationDetailResult");

  async function load(id) {
    output.innerHTML = skeletonBlock(6);
    try {
      const item = await api.get(`/api/v1/recommendations/${encodeURIComponent(id)}`);
      const low = isLowConfidence(item);
      output.innerHTML = `
        <div class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="metric"><div class="metric-label">Record</div><div class="metric-value">${display(item.id)}</div></div>
          <div class="metric"><div class="metric-label">Farm</div><div class="metric-value">${display(item.farm_id)}</div></div>
          <div class="metric"><div class="metric-label">Status</div><div class="metric-value">${display(item.status || (low ? "low_confidence" : "ok"))}</div></div>
          <div class="metric"><div class="metric-label">Model</div><div class="metric-value">${display(item.model_version)}</div></div>
        </div>

        <div class="metric-grid" style="margin-top:14px;grid-template-columns:1fr">
          <div class="metric">
            <div class="metric-label">Recommended crop</div>
            <div class="metric-value">${display(item.recommended_crop)}</div>
          </div>
        </div>

        <div style="margin-top:16px">${confidenceBlock(item)}</div>
        ${item.advice ? statusLine(item.advice, low ? "error" : "") : ""}
        <div style="margin-top:16px">
          <div class="metric-label">Alternatives</div>
          ${alternativesList(item.top_recommendations)}
        </div>

        <div class="metric-note" style="margin-top:16px">
          Soil reading ${display(item.soil_reading_id)} · Weather reading ${display(item.weather_reading_id)} · Created ${fmtDate(item.created_at)}
        </div>

        <div style="margin-top:16px">
          <div class="metric-label">Raw response</div>
          ${jsonPanel(item)}
        </div>`;
    } catch (error) {
      output.innerHTML = errorState(error);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const id = new FormData(form).get("id");
    const hash = `#/recommendations/detail?id=${encodeURIComponent(id)}`;
    if (window.location.hash === hash) load(id);
    else window.location.hash = hash;
  });

  if (params.id) await load(params.id);
  else output.innerHTML = statusLine("Enter a recommendation ID to load its stored record.", "muted");
}
