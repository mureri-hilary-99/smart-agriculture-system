import { api } from "../api.js";
import {
  card,
  display,
  errorState,
  fmtDate,
  jsonPanel,
  pageIntro,
  pager,
  skeletonRows,
  table,
  textField,
} from "../components.js";

export function render(params = {}) {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Audit log",
        description: "Administrative and data-change history. Metadata is expanded inline for traceability.",
        index: "Endpoint 36 / 36",
      })}</div>

      <div class="col-12">
        ${card({
          title: "Query",
          meta: "GET",
          body: `<form id="auditLogForm" class="form-grid">
            ${textField("actor_id", "Actor ID", { type: "number", value: params.actor_id || "", min: 1 })}
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
          title: "Entries",
          meta: "Newest first",
          body: '<div id="auditLogResult">' + skeletonRows(7) + "</div>",
        })}
      </div>
    </div>`;
}

export async function init(params = {}, root = document) {
  const form = root.querySelector("#auditLogForm");
  const output = root.querySelector("#auditLogResult");
  const query = {
    actor_id: params.actor_id || "",
    from: params.from || "",
    to: params.to || "",
    page: params.page || "1",
    page_size: params.page_size || "20",
  };

  async function load() {
    output.innerHTML = skeletonRows(7);
    try {
      const data = await api.get("/api/v1/audit-logs", { query });
      const rows = (data.items || []).map((item) => [
        display(item.id),
        display(item.actor_user_id ?? item.actor_id),
        display(item.action),
        display(item.entity),
        display(item.entity_id),
        fmtDate(item.created_at),
      ]);

      const details = (data.items || [])
        .filter((item) => item.metadata)
        .map((item) => `<div class="metric-label" style="margin-top:14px">Entry ${display(item.id)}</div>${jsonPanel(item.metadata)}`)
        .join("");

      output.innerHTML =
        table(["ID", "Actor", "Action", "Entity", "Entity ID", "Created"], rows) +
        pager({ page: query.page, total: data.total, pageSize: query.page_size, route: "/audit-logs", query: { actor_id: query.actor_id, from: query.from, to: query.to } }) +
        details;
    } catch (error) {
      output.innerHTML = errorState(error);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formdata = new FormData(form);
    const next = {
      actor_id: formdata.get("actor_id"),
      from: formdata.get("from"),
      to: formdata.get("to"),
      page: formdata.get("page") || "1",
      page_size: formdata.get("page_size") || "20",
    };
    const hash = `#/audit-logs?${new URLSearchParams(next).toString()}`;
    if (window.location.hash === hash) load();
    else window.location.hash = hash;
  });

  await load();
}
