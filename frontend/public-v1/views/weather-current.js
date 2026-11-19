import { api, currentFarmId } from "../api.js";
import {
  card,
  display,
  errorState,
  figure,
  fmtDate,
  fmtNumber,
  metric,
  pageIntro,
  skeletonBlock,
  statusLine,
  textField,
} from "../components.js";

export function render(params = {}) {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Current weather",
        description: "Cache-first weather conditions resolved for the farm location. Provider fallback is used only when the cached record is unavailable.",
        index: "Endpoint 21 / 36",
      })}</div>

      <div class="col-4">
        ${card({
          title: "Select farm",
          meta: "GET",
          body: `<form id="weatherCurrentForm" class="form-stack">
            ${textField("farm_id", "Farm ID", { value: currentFarmId(params), required: true })}
            <div class="actions"><button class="btn" type="submit">Load weather</button></div>
            <a class="btn secondary" href="#/weather/refresh">Force provider refresh</a>
          </form>`,
        })}
      </div>

      <div class="col-8">
        ${card({
          title: "Conditions",
          meta: "Weather service",
          body: '<div id="weatherCurrentResult">' + skeletonBlock(5) + "</div>",
        })}
      </div>
    </div>`;
}

export async function init(params = {}, root = document) {
  const form = root.querySelector("#weatherCurrentForm");
  const output = root.querySelector("#weatherCurrentResult");
  let farmId = currentFarmId(params);

  async function load() {
    output.innerHTML = skeletonBlock(5);
    try {
      const weather = await api.get("/api/v1/weather/current", { query: { farm_id: farmId } });
      output.innerHTML = `
        <div class="grid">
          <div class="col-5">${figure("weather-placeholder.svg", "Weather illustration", "Location conditions")}</div>
          <div class="col-7">
            <div class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
              ${metric("Temperature", fmtNumber(weather.temperature, 1) + " C")}
              ${metric("Humidity", fmtNumber(weather.humidity, 1) + " %")}
              ${metric("Rainfall", fmtNumber(weather.rainfall, 1) + " mm")}
              ${metric("Source", display(weather.source))}
            </div>
            <div style="margin-top:14px">${statusLine("Observed at " + fmtDate(weather.recorded_at) + (weather.provider ? " · Provider: " + weather.provider : ""), "muted")}</div>
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
