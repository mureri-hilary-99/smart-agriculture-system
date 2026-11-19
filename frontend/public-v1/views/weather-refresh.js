import { api, currentFarmId } from "../js/api.js";
import {
  card,
  display,
  errorState,
  fmtDate,
  fmtNumber,
  pageIntro,
  statusLine,
  textField,
} from "../../components.js";

export function render(params = {}) {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Refresh weather",
        description: "Requests a fresh observation from the configured external provider. Restricted to admin or system clients in the API contract.",
        index: "Endpoint 23 / 36",
      })}</div>

      <div class="col-5">
        ${card({
          title: "Provider request",
          meta: "POST",
          body: `<form id="refreshWeatherForm" class="form-stack">
            ${textField("farm_id", "Farm ID", { value: currentFarmId(params), required: true, hint: "Coordinates are resolved from the farm record." })}
            <div class="actions"><button class="btn" type="submit" id="refreshButton">Fetch current weather</button></div>
            <div id="refreshStatus" class="status-line hidden"></div>
          </form>`,
        })}
      </div>

      <div class="col-7">
        ${card({
          title: "Provider response",
          meta: "WeatherReading",
          body: '<div id="refreshResult">' + statusLine("No refresh request sent in this session.", "muted") + "</div>",
        })}
      </div>
    </div>`;
}

export async function init(params = {}) {
  const form = document.querySelector("#refreshWeatherForm");
  const button = document.querySelector("#refreshButton");
  const status = document.querySelector("#refreshStatus");
  const result = document.querySelector("#refreshResult");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const farmId = new FormData(form).get("farm_id");
    button.disabled = true;
    status.className = "status-line";
    status.textContent = "Contacting weather provider...";
    result.innerHTML = '<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line mid"></div><div class="skeleton skeleton-line short"></div>';

    try {
      const weather = await api.post("/api/v1/weather/refresh", { farm_id: Number(farmId) });
      localStorage.setItem("sa.farm_id", String(farmId));
      status.className = "status-line";
      status.textContent = "Provider response stored.";
      result.innerHTML = `
        <div class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="metric"><div class="metric-label">Temperature</div><div class="metric-value">${fmtNumber(weather.temperature, 1)} C</div></div>
          <div class="metric"><div class="metric-label">Humidity</div><div class="metric-value">${fmtNumber(weather.humidity, 1)} %</div></div>
          <div class="metric"><div class="metric-label">Rainfall</div><div class="metric-value">${fmtNumber(weather.rainfall, 1)} mm</div></div>
          <div class="metric"><div class="metric-label">Source</div><div class="metric-value">${display(weather.source)}</div></div>
        </div>
        <div style="margin-top:14px">${statusLine("Recorded " + fmtDate(weather.recorded_at) + " · Reading ID " + display(weather.id), "muted")}</div>`;
    } catch (error) {
      status.className = "status-line error";
      status.textContent = error.message;
      result.innerHTML = errorState(error);
    } finally {
      button.disabled = false;
    }
  });
}
