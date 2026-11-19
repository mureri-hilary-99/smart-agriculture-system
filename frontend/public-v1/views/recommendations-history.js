import { api, currentFarmId } from "../api.js";
import {
  card,
  display,
  errorState,
  fmtDate,
  fmtNumber,
  isLowConfidence,
  pageIntro,
  pager,
  skeletonRows,
  table,
  textField,
} from "../components.js";

export function render(params = {}) {
  const farmId = currentFarmId(params);
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Recommendation history",
        description: "Every persisted decision with its confidence, model version and status. Click a record to inspect the full payload.",
        index: "Endpoint 25 / 36",
      })}</div>

      <div class="col-12">
        ${card({
          title: "Query",
          meta: "GET",
          body: `<form id="recommendationHistoryForm" class="form-grid">
            ${textField("farm_id", "Farm ID", { value: farmId, required: true })}
            ${textField("from", "From date", { type: "date", value: params.from || "" })}
            ${textField("to", "To date", { type: "date", value: params.to || "" })}
            ${textField("page", "Page", { type: "number", value: params.page || "1", min: 1 })}
            ${textField("page_size", "Rows per page", { type: "number", value: params.page_size || "20", min: 1, max: 100 })}
            <div class="actions"><button class="btn" type="submit">Apply filter</button></div>
          </form>`,
        })}
      </div>

      <div class="col-12">
        ${card({
          title: "Saved decisions",
          meta: "Newest first",
          body: '<div id="recommendationHistoryResult">' + skeletonRows(7) + "</div>",
        })}
      </div>
    </div>`;
}

export async function init(params = {}, root = document) {
  const form = root.querySelector("#recommendationHistoryForm");
  const output = root.querySelector("#recommendationHistoryResult");
  const query = {
    farm_id: currentFarmId(params),
    from: params.from || "",
    to: params.to || "",
    page: params.page || "1",
    page_size: params.page_size || "20",
  };

  async function load() {
    output.innerHTML = skeletonRows(7);
    try {
      const data = await api.get("/api/v1/recommendations", { query });
      const rows = (data.items || []).map((item) => {
        const low = isLowConfidence(item);
        return [
          `<a href="#/recommendations/detail?id=${encodeURIComponent(item.id)}">${display(item.id)}</a>`,
          display(item.farm_id),
          display(item.recommended_crop),
          fmtNumber(item.confidence, 4),
          low ? "low_confidence" : display(item.status || "ok"),
          display(item.model_version),
          fmtDate(item.created_at),
        ];
      });
      output.innerHTML =
        table(["ID", "Farm", "Recommended crop", "Confidence", "Status", "Model", "Created"], rows) +
        pager({ page: query.page, total: data.total, pageSize: query.page_size, route: "/recommendations", query: { farm_id: query.farm_id, from: query.from, to: query.to } });
    } catch (error) {
      output.innerHTML = errorState(error);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formdata = new FormData(form);
    const next = {
      farm_id: formdata.get("farm_id"),
      from: formdata.get("from"),
      to: formdata.get("to"),
      page: formdata.get("page") || "1",
      page_size: formdata.get("page_size") || "20",
    };
    localStorage.setItem("sa.farm_id", String(next.farm_id));
    const hash = `#/recommendations?${new URLSearchParams(next).toString()}`;
    if (window.location.hash === hash) load();
    else window.location.hash = hash;
  });

  await load();
}
