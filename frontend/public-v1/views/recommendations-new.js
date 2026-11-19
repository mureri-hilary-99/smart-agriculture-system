import { api, currentFarmId } from "../api.js";
import {
  alternativesList,
  card,
  confidenceBlock,
  display,
  errorState,
  fmtNumber,
  isLowConfidence,
  pageIntro,
  selectField,
  statusLine,
  textField,
} from "../components.js";

export function render(params = {}) {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Generate recommendation",
        description: "Runs the trained classifier and persists the result against a farm. Use latest stored readings or supply a manual feature set on the training scale.",
        index: "Endpoint 24 / 36",
      })}</div>

      <div class="col-5">
        ${card({
          title: "Recommendation request",
          meta: "POST",
          body: `<form id="newRecommendationForm" class="form-stack">
            ${textField("farm_id", "Farm ID", { value: currentFarmId(params), required: true })}
            ${selectField("source", "Input source", [
              { value: "latest", label: "Latest stored readings" },
              { value: "manual", label: "Manual feature entry" },
            ], params.source || "latest")}

            <div id="manualInputs" style="display:none" class="form-grid">
              ${textField("N", "Nitrogen (N)", { type: "number", step: "any", min: 0, value: "90" })}
              ${textField("P", "Phosphorus (P)", { type: "number", step: "any", min: 0, value: "40" })}
              ${textField("K", "Potassium (K)", { type: "number", step: "any", min: 0, value: "40" })}
              ${textField("temperature", "Temperature (C)", { type: "number", step: "any", value: "25.6" })}
              ${textField("humidity", "Humidity (%)", { type: "number", step: "any", min: 0, max: 100, value: "62.3" })}
              ${textField("ph", "Soil pH", { type: "number", step: "any", min: 0, max: 14, value: "6.8" })}
              ${textField("rainfall", "Rainfall (mm)", { type: "number", step: "any", min: 0, value: "120" })}
            </div>

            <div class="actions"><button class="btn" type="submit" id="recommendButton">Generate and save</button></div>
            <div id="recommendStatus" class="status-line hidden"></div>
            <p class="hint">N, P and K use the training dataset scale. Confirm units before showing them to farmers.</p>
          </form>`,
        })}
      </div>

      <div class="col-7">
        ${card({
          title: "Result",
          meta: "Recommendation",
          body: '<div id="recommendationResult">' + statusLine("Submit a request to see the persisted recommendation.", "muted") + "</div>",
        })}
      </div>
    </div>`;
}

export async function init() {
  const form = document.querySelector("#newRecommendationForm");
  const source = form.elements.source;
  const manual = document.querySelector("#manualInputs");
  const button = document.querySelector("#recommendButton");
  const status = document.querySelector("#recommendStatus");
  const output = document.querySelector("#recommendationResult");

  function toggleManual() {
    manual.style.display = source.value === "manual" ? "grid" : "none";
  }

  source.addEventListener("change", toggleManual);
  toggleManual();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const farmId = data.get("farm_id");
    const sourceValue = data.get("source");

    const body = { farm_id: Number(farmId), source: sourceValue };
    if (sourceValue === "manual") {
      body.inputs = {
        N: Number(data.get("N")),
        P: Number(data.get("P")),
        K: Number(data.get("K")),
        temperature: Number(data.get("temperature")),
        humidity: Number(data.get("humidity")),
        ph: Number(data.get("ph")),
        rainfall: Number(data.get("rainfall")),
      };
    }

    button.disabled = true;
    status.className = "status-line";
    status.textContent = "Running model and storing result...";
    output.innerHTML = '<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-block"></div><div class="skeleton skeleton-line mid"></div>';

    try {
      const result = await api.post("/api/v1/recommendations", body);
      localStorage.setItem("sa.farm_id", String(farmId));
      const low = isLowConfidence(result);
      status.className = "status-line";
      status.textContent = "Recommendation saved as record " + display(result.id) + ".";
      output.innerHTML = `
        <div class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="metric"><div class="metric-label">Recommended crop</div><div class="metric-value">${display(result.recommended_crop)}</div></div>
          <div class="metric"><div class="metric-label">Status</div><div class="metric-value">${display(result.status || (low ? "low_confidence" : "ok"))}</div></div>
        </div>
        <div style="margin-top:16px">${confidenceBlock(result)}</div>
        ${result.advice ? statusLine(result.advice, low ? "error" : "") : ""}
        ${low ? statusLine("Decision support only. Collect more local data and consult an extension officer before planting.", "muted") : ""}
        <div style="margin-top:16px">
          <div class="metric-label">Alternatives, already sorted</div>
          ${alternativesList(result.top_recommendations)}
        </div>
        <div class="actions">
          <a class="btn secondary" href="#/recommendations/detail?id=${encodeURIComponent(result.id)}">Open detail</a>
          <a class="btn quiet" href="#/recommendations">View history</a>
        </div>
        <div class="metric-note" style="margin-top:12px">Model: ${display(result.model_version)} · Created ${display(result.created_at)}</div>`;
    } catch (error) {
      status.className = "status-line error";
      status.textContent = error.message;
      output.innerHTML = errorState(error);
    } finally {
      button.disabled = false;
    }
  });
}
