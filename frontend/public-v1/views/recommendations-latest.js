import { api, currentFarmId } from "../api.js";
import {
  alternativesList,
  card,
  confidenceBlock,
  display,
  errorState,
  figure,
  isLowConfidence,
  pageIntro,
  skeletonBlock,
  statusLine,
  textField,
} from "../components.js";

export function render(params = {}) {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Latest recommendation",
        description: "Most recent persisted decision for the selected farm, with alternatives and the confidence gate applied by the API.",
        index: "Endpoint 26 / 36",
      })}</div>

      <div class="col-4">
        ${card({
          title: "Select farm",
          meta: "GET",
          body: `<form id="latestRecommendationForm" class="form-stack">
            ${textField("farm_id", "Farm ID", { value: currentFarmId(params), required: true })}
            <div class="actions"><button class="btn" type="submit">Load decision</button></div>
            <a class="btn secondary" href="#/recommendations/new">Generate a new one</a>
          </form>`,
        })}
      </div>

      <div class="col-8">
        ${card({
          title: "Decision",
          meta: "Recommendation",
          body: '<div id="latestRecommendationResult">' + skeletonBlock(6) + "</div>",
        })}
      </div>
    </div>`;
}

export async function init(params = {}, root = document) {
  const form = root.querySelector("#latestRecommendationForm");
  const output = root.querySelector("#latestRecommendationResult");
  let farmId = currentFarmId(params);

  async function load() {
    output.innerHTML = skeletonBlock(6);
    try {
      const item = await api.get("/api/v1/recommendations/latest", { query: { farm_id: farmId } });
      const low = isLowConfidence(item);
      output.innerHTML = `
        <div class="grid">
          <div class="col-5">${figure("crop-placeholder.svg", "Crop rows illustration", "Advisory output")}</div>
          <div class="col-7">
            <div class="metric-grid" style="grid-template-columns:1fr">
              <div class="metric">
                <div class="metric-label">Recommended crop</div>
                <div class="metric-value">${display(item.recommended_crop)}</div>
              </div>
            </div>
            <div style="margin-top:16px">${confidenceBlock(item)}</div>
            ${item.advice ? statusLine(item.advice, low ? "error" : "") : ""}
            ${low ? statusLine("Consult an extension officer and collect more local soil and climate data.", "muted") : ""}
            <div style="margin-top:16px">
              <div class="metric-label">Alternatives</div>
              ${alternativesList(item.top_recommendations)}
            </div>
            <div class="actions">
              <a class="btn secondary" href="#/recommendations/detail?id=${encodeURIComponent(item.id)}">Full detail</a>
              <a class="btn quiet" href="#/recommendations">History</a>
            </div>
            <div class="metric-note" style="margin-top:12px">Model: ${display(item.model_version)} · ${display(item.created_at)}</div>
          </div>
        </div>`;
    } catch (error) {
      output.innerHTML = errorState(error);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    farmId = new FormData(form).get("farm_id");
    localStorage.setItem("sa.farm_id", String(farmId));
    load();
  });

  await load();
}
