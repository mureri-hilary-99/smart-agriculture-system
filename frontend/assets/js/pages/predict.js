/* Prediction page — POST /api/v1/predict (endpoint 3). */

import { apiRequest, errorMessage } from "../api.js";
import { qs, qsa, setAlert, setFieldError, formValues, numberOrNull, formatPercent, escapeHtml, skeletonLines, busy } from "../ui.js";

const form = qs("#predict-form");
const submit = qs("#predict-submit");
const result = qs("#predict-result");
const raw = qs("#predict-raw");
const alertBox = qs("#predict-alert");
const LOW_CONFIDENCE_PREFIX = "No reliable crop recommendation";

const FIELDS = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"];

function validate(values) {
  let valid = true;
  FIELDS.forEach((name) => {
    const input = form.elements[name];
    const value = values[name];
    let message = "";
    if (value === null) message = "Enter a valid number.";
    else if (["N", "P", "K", "rainfall"].includes(name) && value < 0) message = "Value must be zero or greater.";
    else if (name === "humidity" && (value < 0 || value > 100)) message = "Humidity must be between 0 and 100.";
    else if (name === "ph" && (value < 0 || value > 14)) message = "pH must be between 0 and 14.";
    setFieldError(input, message);
    if (message) valid = false;
  });
  return valid;
}

function isLowConfidence(crop) {
  return String(crop || "").startsWith(LOW_CONFIDENCE_PREFIX);
}

function renderResult(data) {
  const low = isLowConfidence(data.recommended_crop);
  const alternatives = Array.isArray(data.top_recommendations) ? data.top_recommendations : [];
  result.innerHTML = `
    <div class="status ${low ? "status--warn" : "status--ok"}">${low ? "Low confidence" : "Recommendation ready"}</div>
    <div class="data-grid" style="margin-top:1rem">
      <div class="data-cell"><div class="data-label">Recommended crop</div><div class="data-value small">${escapeHtml(data.recommended_crop)}</div></div>
      <div class="data-cell"><div class="data-label">Confidence</div><div class="data-value">${formatPercent(data.confidence)}</div></div>
    </div>
    <div class="meter" aria-hidden="true"><span style="width:${Math.min(Math.max(Number(data.confidence) || 0, 0), 1) * 100}%"></span></div>
    ${low ? '<div class="alert alert--warn" style="margin-top:1.25rem">The model is not confident in this result. Collect more local soil and climate data, or consult an extension officer before deciding.</div>' : ""}
    <div style="margin-top:1.5rem">
      <div class="data-label">Ranked alternatives</div>
      ${alternatives.map((item, index) => `
        <div class="result-item">
          <div class="result-head"><span>${index + 1}. ${escapeHtml(item.crop)}</span><span>${formatPercent(item.confidence)}</span></div>
          <div class="meter" aria-hidden="true"><span style="width:${Math.min(Math.max(Number(item.confidence) || 0, 0), 1) * 100}%"></span></div>
        </div>`).join("") || '<p class="small muted">No alternatives returned.</p>'}
    </div>
    <p class="form-note">Decision support only. Validate against local soil tests, seasonality, rainfall forecasts, water availability and extension advice.</p>`;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAlert(alertBox, "", "");
  raw.textContent = "Waiting for response…";

  const rawValues = formValues(form);
  const values = Object.fromEntries(FIELDS.map((name) => [name, numberOrNull(rawValues[name])]));
  if (!validate(values)) {
    setAlert(alertBox, "error", "Correct the highlighted fields before submitting.");
    raw.textContent = "No request sent.";
    return;
  }

  result.innerHTML = skeletonLines(5);
  busy(submit, true, "Generate recommendation");

  try {
    const data = await apiRequest("/api/v1/predict", { method: "POST", body: values });
    renderResult(data);
    raw.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    result.innerHTML = "";
    setAlert(alertBox, "error", `Prediction failed. ${errorMessage(error)}`);
    raw.textContent = errorMessage(error);
  } finally {
    busy(submit, false);
  }
});

form?.addEventListener("reset", () => {
  qsa(".field-error", form).forEach((slot) => { slot.textContent = ""; });
  qsa("input", form).forEach((input) => input.removeAttribute("aria-invalid"));
  result.innerHTML = '<p class="muted small">No prediction yet. Submit the form to see a recommendation.</p>';
  raw.textContent = "No response yet.";
  setAlert(alertBox, "", "");
});
