import { api, currentFarmId } from "../api.js";
import {
  card,
  display,
  endpointLabel,
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
  const from = params.from || "";
  const to = params.to || "";
  const page = params.page || "1";
  const pageSize = params.page_size || "20";

  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Soil readings",
        description: "Archived soil and environmental measurements. Values are shown exactly as stored, including invalid readings and quality flags.",
        index: "Endpoint 19 / 36",
      })}</div>

      <div class="col-12">
        ${card({
          title: "Query",
          meta: "GET",
          body: `
            <form id="soilFilter" class="form-grid">
              ${textField("farm_id", "Farm ID", { value: farmId, required: true })}
              ${textField("from", "From date", { type: "date", value: from })}
              ${textField("to", "To date", { type: "date", value: to })}
              ${textField("page", "Page", { type: "number", value: page, min: 1 })}
              ${textField("page_size", "Rows per page", { type: "number", value: pageSize, min: 1, max: 100 })}
              <div class="actions"><button class="btn" type="submit">Apply filter</button></div>
            </form>`,
        })}
      </div>

      <div class="col-12">
        ${card({
          title: "Readings",
          meta: "Newest first",
          body: '<div id="soilResults">' + skeletonRows(8) + "</div>",
        })}
      </div>
    </div>`;
}

export async function init(params = {}, root = document) {
  const form = root.querySelector("#soilFilter");
  const results = root.querySelector("#soilResults");
  const query = {
    farm_id: currentFarmId(params),
    from: params.from || "",
    to: params.to || "",
    page: params.page || "1",
    page_size: params.page_size || "20",
  };

  async function load() {
    results.innerHTML = skeletonRows(8);
    try {
      const data = await api.get("/api/v1/soil-readings", { query });
      const items = data.items || [];
      const rows = items.map((item) => [
        display(item.id),
        display(item.farm_id),
        display(item.device_id),
        fmtDate(item.recorded_at),
        fmtNumber(item.N, 1),
        fmtNumber(item.P, 1),
        fmtNumber(item.K, 1),
        fmtNumber(item.temperature, 1),
        fmtNumber(item.humidity, 1),
        fmtNumber(item.ph, 2),
        fmtNumber(item.rainfall, 1),
        fmtNumber(item.soil_moisture, 1),
        display(item.source),
        display(item.is_valid),
        display(item.quality_flags),
      ]);

      results.innerHTML =
        table(
          [
            "ID", "Farm", "Device", "Recorded", "N", "P", "K", "Temp C",
            "Humidity %", "pH", "Rain mm", "Moisture %", "Source", "Valid", "Quality flags",
          ],
          rows
        ) + pager({ page: query.page, total: data.total, pageSize: query.page_size, route: "/soil-readings", query: { farm_id: query.farm_id, from: query.from, to: query.to } });
    } catch (error) {
      results.innerHTML = errorState(error);
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
    const hash = `#/soil-readings?${new URLSearchParams(next).toString()}`;
    if (window.location.hash === hash) load();
    else window.location.hash = hash;
  });

  await load();
}
