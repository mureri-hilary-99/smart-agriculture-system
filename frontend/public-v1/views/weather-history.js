import { api, currentFarmId } from "../api.js";
import {
  card,
  display,
  errorState,
  fmtDate,
  fmtNumber,
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
        title: "Weather history",
        description: "Archived weather observations linked to each farm. Use the range filter to prepare data for reporting.",
        index: "Endpoint 22 / 36",
      })}</div>

      <div class="col-12">
        ${card({
          title: "Query",
          meta: "GET",
          body: `<form id="weatherHistoryForm" class="form-grid">
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
          title: "Observations",
          meta: "Newest first",
          body: '<div id="weatherHistoryResult">' + skeletonRows(7) + "</div>",
        })}
      </div>
    </div>`;
}

export async function init(params = {}, root = document) {
  const form = root.querySelector("#weatherHistoryForm");
  const output = root.querySelector("#weatherHistoryResult");
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
      const data = await api.get("/api/v1/weather", { query });
      const rows = (data.items || []).map((item) => [
        display(item.id),
        display(item.farm_id),
        fmtDate(item.recorded_at),
        fmtNumber(item.temperature, 1),
        fmtNumber(item.humidity, 1),
        fmtNumber(item.rainfall, 1),
        display(item.source),
        display(item.provider),
      ]);
      output.innerHTML =
        table(["ID", "Farm", "Recorded", "Temp C", "Humidity %", "Rain mm", "Source", "Provider"], rows) +
        pager({ page: query.page, total: data.total, pageSize: query.page_size, route: "/weather", query: { farm_id: query.farm_id, from: query.from, to: query.to } });
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
    const hash = `#/weather?${new URLSearchParams(next).toString()}`;
    if (window.location.hash === hash) load();
    else window.location.hash = hash;
  });

  await load();
}
