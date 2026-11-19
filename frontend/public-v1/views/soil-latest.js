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
        title: "Latest soil reading",
        description: "Most recent accepted field measurement for a farm. Soil moisture is displayed for monitoring but is not a current model input.",
        index: "Endpoint 20 / 36",
      })}</div>

      <div class="col-4">
        ${card({
          title: "Select farm",
          meta: "GET",
          body: `<form id="latestSoilForm" class="form-stack">
            ${textField("farm_id", "Farm ID", { value: currentFarmId(params), required: true })}
            <div class="actions"><button class="btn" type="submit">Load reading</button></div>
          </form>`,
        })}
      </div>

      <div class="col-8">
        ${card({
          title: "Current field state",
          meta: "Soil sensor",
          body: '<div id="latestSoilResult">' + skeletonBlock(5) + "</div>",
        })}
      </div>
    </div>`;
}

export async function init(params = {}, root = document) {
  const form = root.querySelector("#latestSoilForm");
  const output = root.querySelector("#latestSoilResult");
  let farmId = currentFarmId(params);

  async function load() {
    output.innerHTML = skeletonBlock(5);
    try {
      const reading = await api.get("/api/v1/soil-readings/latest", { query: { farm_id: farmId } });
      const flags = reading.quality_flags || [];
      output.innerHTML = `
        <div class="grid">
          <div class="col-5">
            ${figure("sensor-placeholder.svg", "Soil sensor probe", "Sensor acquisition")}
          </div>
          <div class="col-7">
            <div class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
              ${metric("Recorded", fmtDate(reading.recorded_at))}
              ${metric("Source", display(reading.source))}
              ${metric("Soil moisture", fmtNumber(reading.soil_moisture, 1) + " %")}
              ${metric("pH", fmtNumber(reading.ph, 2))}
              ${metric("Temperature", fmtNumber(reading.temperature, 1) + " C")}
              ${metric("Humidity", fmtNumber(reading.humidity, 1) + " %")}
            </div>
            <div class="metric-grid" style="margin-top:14px">
              ${metric("Nitrogen (N)", fmtNumber(reading.N, 1))}
              ${metric("Phosphorus (P)", fmtNumber(reading.P, 1))}
              ${metric("Potassium (K)", fmtNumber(reading.K, 1))}
            </div>
            ${reading.is_valid ? "" : statusLine("Reading stored with validation warning. Check sensor calibration.", "error")}
            ${flags.length ? statusLine("Quality flags: " + flags.join(", "), "muted") : ""}
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
