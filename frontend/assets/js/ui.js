/* Small DOM helpers shared by every page. */

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function setAlert(target, type, message) {
  if (!target) return;
  if (!message) {
    target.innerHTML = "";
    return;
  }
  target.innerHTML = `<div class="alert alert--${escapeHtml(type)}">${escapeHtml(message)}</div>`;
}

export function setFieldError(input, message) {
  if (!input) return;
  const field = input.closest(".field");
  const slot = field && field.querySelector(".field-error");
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
  if (slot) slot.textContent = message || "";
}

export function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—";
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function skeletonLines(count = 3) {
  let html = "";
  for (let i = 0; i < count; i += 1) {
    html += `<div class="skeleton skeleton-line${i === count - 1 ? " skeleton-line--short" : ""}"></div>`;
  }
  return html;
}

export function skeletonRows(rows = 5, columns = 4) {
  let html = "";
  for (let r = 0; r < rows; r += 1) {
    html += "<tr>";
    for (let c = 0; c < columns; c += 1) {
      html += `<td><div class="skeleton skeleton-row" style="width:${70 + ((r + c) % 3) * 10}%"></div></td>`;
    }
    html += "</tr>";
  }
  return html;
}

export function errorMessage(error) {
  if (!error) return "Unknown error";
  if (error.status) return `${error.status} — ${error.message}`;
  return error.message || "Request failed";
}

export function busy(button, isBusy, idleText) {
  if (!button) return;
  if (idleText !== undefined) button.dataset.idleText = idleText;
  button.disabled = isBusy;
  button.textContent = isBusy ? "Working…" : (button.dataset.idleText || button.textContent);
}

export function debounce(fn, wait = 250) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
