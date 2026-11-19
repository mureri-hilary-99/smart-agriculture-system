import { api, currentFarmId } from "../api.js";
import {
  card,
  display,
  errorState,
  fmtNumber,
  metric,
  pageIntro,
  skeletonBlock,
  table,
  textField,
} from "../components.js";

export function render(params = {}) {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Reports summary",
        description: "Aggregated field activity for a farm and date range. The same filters are available on the CSV export page.",
        index: "Endpoint 34 / 36",
      })}</div>

      <div class="col-12">
        ${card({
          title: "Report range",
          meta: "GET",
          body: `<form id="reportSummaryForm" class="form-grid">
            ${textField("farm_id", "Farm ID", { value: currentFarmId(params), required: true })}
            ${textField("from", "From date", { type: "date", value: params.from || "", required: true })}
            ${textField("to", "To date", { type: "date", value: params.to || "", required: true })}
            <div class="actions"><button class="btn" type="submit">Build summary</button></div>
          </form>`,
        })}
      </div>

      <div class="col-12">
        ${card({
          title: "Aggregates",
          meta: "Summary",
          body: '<div id="reportSummaryResult">' + skeletonBlock(7) + "</div>",
        })}
      </div>
    </div>`;
}

function normalizeTimeline(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => ({
      label: entry.date || entry.label || entry.bucket || entry.period || "—",
      value: Number(entry.count ?? entry.value ?? entry.total ?? 0),
    }));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).map(([label, entry]) => ({
      label,
      value: Number(entry?.count ?? entry?.value ?? entry ?? 0),
    }));
  }
  return [];
}

function normalizeCounts(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => [display(entry.crop || entry.label || entry.name), display(entry.count ?? entry.value)]);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, count]) => [display(key), display(count)]);
  }
  return [];
}

export async function init(params = {}, root = document) {
  const form = root.querySelector("#reportSummaryForm");
  const output = root.querySelector("#reportSummaryResult");
  let query = {
    farm_id: currentFarmId(params),
    from: params.from || "",
    to: params.to || "",
  };

  async function load() {
    output.innerHTML = skeletonBlock(7);
    try {
      const summary = await api.get("/api/v1/reports/summary", { query });
      const timeline = normalizeTimeline(summary.timeline);
      const max = Math.max(1, ...timeline.map((item) => item.value));
      const counts = normalizeCounts(summary.recommendation_counts);
      const exportHash = `#/reports/export?${new URLSearchParams(query).toString()}`;

      output.innerHTML = `
        <div class="metric-grid">
          ${metric("Readings", display(summary.readings_count))}
          ${metric("Average moisture", fmtNumber(summary.avg_moisture, 1) + " %")}
          ${metric("Average pH", fmtNumber(summary.avg_ph, 2))}
        </div>

        <div class="grid" style="margin-top:20px">
          <div class="col-6">
            <div class="metric-label">Recommendation distribution</div>
            ${table(["Crop", "Count"], counts)}
          </div>
          <div class="col-6">
            <div class="metric-label">Activity timeline</div>
            <div class="timeline">
              ${timeline.length
                ? timeline.map((item) => `
                    <div class="timeline-row">
                      <span class="timeline-label">${display(item.label)}</span>
                      <span class="timeline-track"><span class="timeline-fill" style="display:block;width:${Math.round((item.value / max) * 100)}%"></span></span>
                      <span class="timeline-value">${display(item.value)}</span>
                    </div>`).join("")
                : '<div class="empty">No timeline data in this range.</div>'}
            </div>
          </div>
        </div>

        <div class="actions" style="margin-top:20px">
          <a class="btn secondary" href="${exportHash}">Open CSV export with these filters</a>
        </div>`;
    } catch (error) {
      output.innerHTML = errorState(error);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    query = {
      farm_id: data.get("farm_id"),
      from: data.get("from"),
      to: data.get("to"),
    };
    localStorage.setItem("sa.farm_id", String(query.farm_id));
    const hash = `#/reports/summary?${new URLSearchParams(query).toString()}`;
    if (window.location.hash === hash) load();
    else window.location.hash = hash;
  });

  if (params.from && params.to) await load();
  else output.innerHTML = '<div class="empty">Select a date range to build the report.</div>';
}
