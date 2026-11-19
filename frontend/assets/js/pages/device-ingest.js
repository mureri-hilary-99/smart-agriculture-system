/* ESP32 ingestion — POST /api/v1/devices/ingestions (endpoint 16). */

import { apiRequest, errorMessage } from "../api.js";
import { qs, qsa, setAlert, formValues, numberOrNull, setFieldError, escapeHtml, formatPercent, skeletonLines, busy } from "../ui.js";

const form = qs("#ingest-form");
const submit = qs("#ingest-submit");
const result = qs("#ingest-result");
const raw = qs("#ingest-raw");
const alertBox = qs("#ingest-alert");

function toIsoLocal(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAlert(alertBox, "", "");
  qsa(".field-error", form).forEach((slot) => { slot.textContent = ""; });
  qsa("input", form).forEach((input) => input.removeAttribute("aria-invalid"));

  const values = formValues(form);
  const recordedAt = toIsoLocal(values.recorded_at);
  const numericFields = ["N", "P", "K", "ph", "soil_moisture", "soil_temperature", "soil_humidity", "weather_temperature", "weather_humidity", "rainfall"];
  const numbers = Object.fromEntries(numericFields.map((key) => [key, numberOrNull(values[key])]));
  let valid = true;
  numericFields.forEach((key) => {
    if (numbers[key] === null) { setFieldError(form.elements[key], "Enter a valid number."); valid = false; }
  });
  if (!values.device_id || !values.device_id.trim()) { setFieldError(form.elements.device_id, "Device ID is required."); valid = false; }
  if (!values.device_key || !values.device_key.trim()) { setFieldError(form.elements.device_key, "Device key is required."); valid = false; }
  if (!recordedAt) { setFieldError(form.elements.recorded_at, "Choose a valid date and time."); valid = false; }
  if (!valid) {
    setAlert(alertBox, "error", "Correct the highlighted fields before submitting.");
    return;
  }

  const payload = {
    device_id: values.device_id.trim(),
    recorded_at: recordedAt,
    soil: {
      N: numbers.N,
      P: numbers.P,
      K: numbers.K,
      ph: numbers.ph,
      soil_moisture: numbers.soil_moisture,
      temperature: numbers.soil_temperature,
      humidity: numbers.soil_humidity
    },
    weather: {
      temperature: numbers.weather_temperature,
      humidity: numbers.weather_humidity,
      rainfall: numbers.rainfall
    }
  };
  raw.textContent = "Waiting for response…";
  result.innerHTML = skeletonLines(5);
  busy(submit, true, "Submit batch");

  try {
    const data = await apiRequest("/api/v1/devices/ingestions", {
      method: "POST",
      deviceKey: values.device_key.trim(),
      body: payload
    });
    const rec = data.recommendation || {};
    const flags = Array.isArray(data.quality_flags) ? data.quality_flags : [];
    result.innerHTML = `
      <div class="status status--ok">Batch accepted</div>
      <div class="data-grid" style="margin-top:1rem">
        <div class="data-cell"><div class="data-label">Soil reading</div><div class="data-value small">${escapeHtml(data.soil_reading_id ?? "—")}</div></div>
        <div class="data-cell"><div class="data-label">Weather reading</div><div class="data-value small">${escapeHtml(data.weather_reading_id ?? "—")}</div></div>
        <div class="data-cell"><div class="data-label">Recommendation</div><div class="data-value small">${escapeHtml(rec.id ?? "—")}</div></div>
      </div>
      <div style="margin-top:1.25rem">
        <div class="data-label">Recommended crop</div>
        <div class="data-value small">${escapeHtml(rec.recommended_crop || "—")}</div>
        <div class="small muted">Confidence ${formatPercent(rec.confidence)} · status ${escapeHtml(rec.status || "—")}</div>
      </div>
      ${flags.length ? `<div class="alert alert--warn" style="margin-top:1.25rem">Quality flags: ${flags.map(escapeHtml).join(", ")}</div>` : ""}`;
    raw.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    result.innerHTML = "";
    setAlert(alertBox, "error", errorMessage(error));
    raw.textContent = errorMessage(error);
  } finally {
    busy(submit, false);
  }
});
