/* API reference page — generated docs links (endpoint 4) and base URL config. */

import { qs, setAlert, escapeHtml } from "../ui.js";

const base = window.AGRI_CONFIG.getApiBaseUrl();
const alertBox = qs("#api-alert");

[["docs", "#link-docs"], ["redoc", "#link-redoc"], ["openapi.json", "#link-openapi"]].forEach(([path, selector]) => {
  const link = qs(selector);
  if (link) link.href = `${base}/${path}`;
});

const input = qs("#base-url");
if (input) input.value = base;

qs("#base-url-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!input.value.trim()) return;
  window.AGRI_CONFIG.setApiBaseUrl(input.value);
  const newBase = window.AGRI_CONFIG.getApiBaseUrl();
  input.value = newBase;
  [["docs", "#link-docs"], ["redoc", "#link-redoc"], ["openapi.json", "#link-openapi"]].forEach(([path, selector]) => {
    const link = qs(selector);
    if (link) link.href = `${newBase}/${path}`;
  });
  setAlert(alertBox, "info", `Base URL saved: ${escapeHtml(newBase)}`);
});

qs("#base-url-reset")?.addEventListener("click", () => {
  window.AGRI_CONFIG.resetApiBaseUrl();
  const reset = window.AGRI_CONFIG.getApiBaseUrl();
  input.value = reset;
  [["docs", "#link-docs"], ["redoc", "#link-redoc"], ["openapi.json", "#link-openapi"]].forEach(([path, selector]) => {
    const link = qs(selector);
    if (link) link.href = `${reset}/${path}`;
  });
  setAlert(alertBox, "info", `Base URL reset to ${escapeHtml(reset)}`);
});
