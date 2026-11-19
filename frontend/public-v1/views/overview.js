import { api, currentFarmId } from "../api.js";
import {
  alternativesList,
  card,
  confidenceBlock,
  display,
  errorState,
  figure,
  fmtDate,
  fmtNumber,
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
        title: "Field overview",
        description: "Current field state assembled from the latest soil reading, current weather and most recent persisted decision.",
        index: "Dashboard / endpoints 20, 21, 26",
      })}</div>

      <div class="col-12">
        ${card({
          title: "Select farm",
          meta: "Shared filter",
          body: `<form id="overviewForm" class="form-grid">
            ${textField("farm_id", "Farm ID", { value: currentFarmId(params), required: true })}
            <div class="actions"><button class="btn" type="submit">Refresh overview</button></div>
          </form>`,
        })}
      </div>

      <div class="col-12">${figure("field-placeholder.svg", "Cultivated field rows", "Farm monitoring surface")}</div>

      <div class="col-6">
        ${card({ title: "Latest soil", meta: "Endpoint 20", body: '<div id="overviewSoil">' + skeletonBlock(5) + "</div>" })}
      </div>
      <div class="col-6">
        ${card({ title: "Current weather", meta: "Endpoint 21", body: '<div id="overviewWeather">' + skeletonBlock(5) + "</div>" })}
      </div>
      <div class="col-12">
        ${card({ title: "Latest recommendation", meta: "Endpoint 26", body: '<div id="overviewRecommendation">' + skeletonBlock(6) + "</div>" })}
      </div>
    </div>`;
}

export async function init(params = {}, root = document) {
  const form = root.querySelector("#overviewForm");
  const soil = root.querySelector("#overviewSoil");
  const weather = root.querySelector("#overviewWeather");
  const recommendation = root.querySelector("#overviewRecommendation");
  let farmId = currentFarmId(params);

  async function load() {
    soil.innerHTML = skeletonBlock(5);
    weather.innerHTML = skeletonBlock(5);
    recommendation.innerHTML = skeletonBlock(6);

    const query = { farm_id: farmId };
    const [soilResult, weatherResult, recommendationResult] = await Promise.allSettled([
      api.get("/api/v1/soil-readings/latest", { query }),
      api.get("/api/v1/weather/current", { query }),
      api.get("/api/v1/recommendations/latest", { query }),
    ]);

    soil.innerHTML = soilResult.status === "fulfilled"
      ? `
        <div class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="metric"><div class="metric-label">Moisture</div><div class="metric-value">${fmtNumber(soilResult.value.soil_moisture, 1)} %</div></div>
          <div class="metric"><div class="metric-label">Soil pH</div><div class="metric-value">${fmtNumber(soilResult.value.ph, 2)}</div></div>
          <div class="metric"><div class="metric-label">Temperature</div><div class="metric-value">${fmtNumber(soilResult.value.temperature, 1)} C</div></div>
          <div class="metric"><div class="metric-label">Recorded</div><div class="metric-value" style="font-size:14px">${fmtDate(soilResult.value.recorded_at)}</div></div>
        </div>
        <div class="actions"><a class="btn secondary compact" href="#/soil-readings/latest">Open reading</a></div>`
      : errorState(soilResult.reason);

    weather.innerHTML = weatherResult.status === "fulfilled"
      ? `
        <div class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="metric"><div class="metric-label">Air temperature</div><div class="metric-value">${fmtNumber(weatherResult.value.temperature, 1)} C</div></div>
          <div class="metric"><div class="metric-label">Humidity</div><div class="metric-value">${fmtNumber(weatherResult.value.humidity, 1)} %</div></div>
          <div class="metric"><div class="metric-label">Rainfall</div><div class="metric-value">${fmtNumber(weatherResult.value.rainfall, 1)} mm</div></div>
          <div class="metric"><div class="metric-label">Source</div><div class="metric-value" style="font-size:14px">${display(weatherResult.value.source)}</div></div>
        </div>
        <div class="actions"><a class="btn secondary compact" href="#/weather/current">Open weather</a></div>`
      : errorState(weatherResult.reason);

    recommendation.innerHTML = recommendationResult.status === "fulfilled"
      ? (() => {
          const item = recommendationResult.value;
          const low = isLowConfidence(item);
          return `
            <div class="metric-grid" style="grid-template-columns:1fr">
              <div class="metric"><div class="metric-label">Recommended crop</div><div class="metric-value">${display(item.recommended_crop)}</div></div>
            </div>
            <div style="margin-top:16px">${confidenceBlock(item)}</div>
            ${item.advice ? statusLine(item.advice, low ? "error" : "") : ""}
            <div style="margin-top:16px">
              <div class="metric-label">Alternatives</div>
              ${alternativesList(item.top_recommendations)}
            </div>
            <div class="actions">
              <a class="btn secondary" href="#/recommendations/latest">Full view</a>
              <a class="btn quiet" href="#/recommendations/new">Generate another</a>
            </div>`;
        })()
      : errorState(recommendationResult.reason);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    farmId = new FormData(form).get("farm_id");
    localStorage.setItem("sa.farm_id", String(farmId));
    const hash = `#/overview?farm_id=${encodeURIComponent(farmId)}`;
    if (window.location.hash === hash) load();
    else window.location.hash = hash;
  });

  await load();
}
