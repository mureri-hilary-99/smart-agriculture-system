import { api } from "../api.js";
import {
  card,
  display,
  errorState,
  pageIntro,
  pager,
  selectField,
  skeletonRows,
  table,
  textField,
} from "../components.js";

export function render(params = {}) {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Crop catalogue",
        description: "Supported crops and their environmental suitability ranges. The catalogue should mirror the model classes.",
        index: "Endpoint 28 / 36",
      })}</div>

      <div class="col-12">
        ${card({
          title: "Filter",
          meta: "GET",
          body: `<form id="cropFilterForm" class="form-grid">
            ${textField("q", "Search", { value: params.q || "", placeholder: "Crop name or code" })}
            ${selectField("is_active", "Status", [
              { value: "", label: "All crops" },
              { value: "true", label: "Active only" },
              { value: "false", label: "Inactive only" },
            ], params.is_active || "")}
            ${textField("page", "Page", { type: "number", value: params.page || "1", min: 1 })}
            ${textField("page_size", "Rows per page", { type: "number", value: params.page_size || "20", min: 1, max: 100 })}
            <div class="actions"><button class="btn" type="submit">Apply filter</button></div>
          </form>`,
        })}
      </div>

      <div class="col-12">
        ${card({
          title: "Supported crops",
          meta: "Catalogue",
          body: '<div id="cropListResult">' + skeletonRows(7) + "</div>",
        })}
      </div>
    </div>`;
}

export async function init(params = {}, root = document) {
  const form = root.querySelector("#cropFilterForm");
  const output = root.querySelector("#cropListResult");
  const query = {
    q: params.q || "",
    is_active: params.is_active || "",
    page: params.page || "1",
    page_size: params.page_size || "20",
  };

  async function load() {
    output.innerHTML = skeletonRows(7);
    try {
      const data = await api.get("/api/v1/crops", { query });
      const rows = (data.items || []).map((crop) => {
        const ranges = Object.entries(crop.optimal || {})
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join("-") : value}`)
          .join(" · ");
        return [
          `<a href="#/crops/detail?code=${encodeURIComponent(crop.code)}">${display(crop.code)}</a>`,
          display(crop.name),
          display(crop.local_name),
          display(crop.is_active),
          display(ranges, "No ranges recorded"),
        ];
      });
      output.innerHTML =
        table(["Code", "Name", "Local name", "Active", "Optimal ranges"], rows) +
        pager({ page: query.page, total: data.total, pageSize: query.page_size, route: "/crops", query: { q: query.q, is_active: query.is_active } });
    } catch (error) {
      output.innerHTML = errorState(error);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formdata = new FormData(form);
    const next = {
      q: formdata.get("q"),
      is_active: formdata.get("is_active"),
      page: formdata.get("page") || "1",
      page_size: formdata.get("page_size") || "20",
    };
    const hash = `#/crops?${new URLSearchParams(next).toString()}`;
    if (window.location.hash === hash) load();
    else window.location.hash = hash;
  });

  await load();
}
