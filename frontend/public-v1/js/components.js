// Shared view primitives. Flat, single-font, no decorative UI widgets.

import { buildQuery } from "./public-v1/js/api.js";

export const LOW_CONFIDENCE_SENTINEL =
  "No reliable crop recommendation—collect more local soil and climate data";

export function isLowConfidence(item = {}) {
  return item.status === "low_confidence" || String(item.recommended_crop || "").includes("No reliable crop recommendation");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function display(value, fallback = "—") {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return escapeHtml(value.join(", ") || fallback);
  if (typeof value === "object") return escapeHtml(JSON.stringify(value));
  return escapeHtml(value);
}

export function fmtNumber(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "—";
}

export function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return escapeHtml(date.toISOString().replace("T", " ").slice(0, 19) + " UTC");
}

export function endpointLabel(method, path) {
  const methods = Array.isArray(method) ? method.join(" / ") : method;
  return `
    <div class="endpoint-line">
      <span class="endpoint-method">${escapeHtml(methods)}</span>
      <span class="endpoint-path">${escapeHtml(path)}</span>
    </div>`;
}

export function pageIntro({ title, description, index }) {
  return `
    <div class="page-intro" data-reveal>
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="page-index">${escapeHtml(index)}</div>
    </div>`;
}

export function card({ title, meta = "", body = "", className = "" }) {
  return `
    <section class="card ${escapeHtml(className)}" data-reveal>
      ${title ? `<div class="card-head"><span class="card-title">${escapeHtml(title)}</span>${meta ? `<span class="card-meta">${escapeHtml(meta)}</span>` : ""}</div>` : ""}
      <div class="card-body">${body}</div>
    </section>`;
}

export function metric(label, value, note = "") {
  return `
    <div class="metric">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${display(value)}</div>
      ${note ? `<div class="metric-note">${escapeHtml(note)}</div>` : ""}
    </div>`;
}

export function skeletonBlock(lines = 4) {
  return `
    <div class="skeleton skeleton-line short"></div>
    ${Array.from({ length: lines }, () => '<div class="skeleton skeleton-line"></div>').join("")}`;
}

export function skeletonRows(rows = 6) {
  return `<div>${Array.from({ length: rows }, () => '<div class="skeleton skeleton-row"></div>').join("")}</div>`;
}

export function skeletonCards(count = 3) {
  return `
    <div class="grid">
      ${Array.from({ length: count }, () => '<div class="col-4"><div class="skeleton skeleton-block"></div></div>').join("")}
    </div>`;
}

export function emptyState(message = "No records returned for this query.") {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

export function errorState(error) {
  const code = error?.status ? `${error.status} — ` : "";
  return `<div class="status-line error">${escapeHtml(code + (error?.message || "Unable to load this view."))}</div>`;
}

export function statusLine(message, kind = "") {
  return `<div class="status-line ${escapeHtml(kind)}">${escapeHtml(message)}</div>`;
}

function attrs(options = {}) {
  const list = [];
  if (options.step !== undefined) list.push(`step="${escapeHtml(options.step)}"`);
  if (options.min !== undefined) list.push(`min="${escapeHtml(options.min)}"`);
  if (options.max !== undefined) list.push(`max="${escapeHtml(options.max)}"`);
  if (options.required) list.push("required");
  if (options.placeholder) list.push(`placeholder="${escapeHtml(options.placeholder)}"`);
  return list.join(" ");
}

export function textField(name, label, options = {}) {
  return `
    <label class="field">
      <span class="field-label">${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="${escapeHtml(options.type || "text")}" value="${escapeHtml(options.value ?? "")}" ${attrs(options)} />
      ${options.hint ? `<span class="hint">${escapeHtml(options.hint)}</span>` : ""}
    </label>`;
}

export function selectField(name, label, choices = [], value = "") {
  return `
    <label class="field">
      <span class="field-label">${escapeHtml(label)}</span>
      <select name="${escapeHtml(name)}">
        ${choices
          .map(
            (choice) =>
              `<option value="${escapeHtml(choice.value)}" ${String(value) === String(choice.value) ? "selected" : ""}>${escapeHtml(choice.label)}</option>`
          )
          .join("")}
      </select>
    </label>`;
}

export function textareaField(name, label, value = "", hint = "") {
  return `
    <label class="field">
      <span class="field-label">${escapeHtml(label)}</span>
      <textarea name="${escapeHtml(name)}">${escapeHtml(value)}</textarea>
      ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ""}
    </label>`;
}

export function checkboxField(name, label, checked = false) {
  return `
    <label class="field">
      <span class="field-label">${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="checkbox" ${checked ? "checked" : ""} />
    </label>`;
}

export function table(headers, rows) {
  if (!rows.length) return emptyState();
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

export function confidenceBlock(item = {}) {
  const confidence = Number(item.confidence) || 0;
  const percent = Math.round(confidence * 100);
  const low = isLowConfidence(item);
  const label = low ? "Low confidence" : "Model confidence";

  return `
    <div class="confidence-row">
      <div>
        <div class="metric-label">${label}</div>
        <div class="bar-track"><div class="bar-fill ${low ? "low" : ""}" style="width:${Math.max(0, Math.min(100, percent))}%"></div></div>
      </div>
      <div class="bar-value">${fmtNumber(confidence, 4)}</div>
    </div>`;
}

export function alternativesList(items = []) {
  if (!items.length) return "";
  return `
    <ul class="alt-list">
      ${items
        .map(
          (item) => `
            <li>
              <span>${display(item.crop)}</span>
              <span class="alt-value">${fmtNumber(item.confidence, 4)}</span>
            </li>`
        )
        .join("")}
    </ul>`;
}

export function figure(src, alt, caption) {
  return `
    <figure class="figure">
      <img src="assets/${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" />
      <figcaption>${escapeHtml(caption)}</figcaption>
    </figure>`;
}

export function jsonPanel(value) {
  return `<pre class="json-panel">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

export function pager({ page = 1, total = 0, pageSize = 20, route = "", query = {} }) {
  const current = Number(page) || 1;
  const size = Number(pageSize) || 20;
  const pages = Math.max(1, Math.ceil(Number(total) / size));
  const prev = Math.max(1, current - 1);
  const next = Math.min(pages, current + 1);
  const link = (target) => `#${route}?${buildQuery({ ...query, page: target, page_size: size }).slice(1)}`;

  return `
    <div class="pager">
      <span>${display(total)} records / page ${current} of ${pages}</span>
      <a class="btn secondary compact" href="${link(prev)}">Previous</a>
      <a class="btn secondary compact" href="${link(next)}">Next</a>
    </div>`;
}

export function observeReveals(root = document) {
  const elements = root.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
  );

  elements.forEach((element) => observer.observe(element));
}

export function formValue(form, name) {
  return form.elements[name]?.value ?? "";
}
