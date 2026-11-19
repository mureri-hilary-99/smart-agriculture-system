import { api, currentFarmId } from "../api.js";
import {
  card,
  errorState,
  pageIntro,
  selectField,
  skeletonBlock,
  statusLine,
  textField,
} from "../components.js";

export function render(params = {}) {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "CSV export",
        description: "Streams the report as a CSV attachment using the same farm and date filters as the summary page.",
        index: "Endpoint 35 / 36",
      })}</div>

      <div class="col-5">
        ${card({
          title: "Export query",
          meta: "GET / CSV",
          body: `<form id="exportForm" class="form-stack">
            ${textField("farm_id", "Farm ID", { value: currentFarmId(params), required: true })}
            ${textField("from", "From date", { type: "date", value: params.from || "", required: true })}
            ${textField("to", "To date", { type: "date", value: params.to || "", required: true })}
            ${selectField("format", "Format", [{ value: "csv", label: "CSV" }], "csv")}
            <div class="actions"><button class="btn" type="submit" id="exportButton">Download CSV</button></div>
            <div id="exportStatus" class="status-line hidden"></div>
          </form>`,
        })}
      </div>

      <div class="col-7">
        ${card({
          title: "File preview",
          meta: "First lines",
          body: '<div id="exportResult">' + statusLine("No export generated in this session.", "muted") + "</div>",
        })}
      </div>
    </div>`;
}

export async function init() {
  const form = document.querySelector("#exportForm");
  const button = document.querySelector("#exportButton");
  const status = document.querySelector("#exportStatus");
  const output = document.querySelector("#exportResult");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const farmId = data.get("farm_id");
    const query = {
      farm_id: farmId,
      from: data.get("from"),
      to: data.get("to"),
      format: data.get("format") || "csv",
    };

    button.disabled = true;
    status.className = "status-line";
    status.textContent = "Preparing CSV stream...";
    output.innerHTML = skeletonBlock(5);

    try {
      const blob = await api.download("/api/v1/reports/export", { query });
      const filename = `crop-report-farm-${farmId}.csv`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const text = await blob.text();
      const preview = text.split(/\r?\n/).slice(0, 10).join("\n");
      localStorage.setItem("sa.farm_id", String(farmId));
      status.className = "status-line";
      status.textContent = filename + " · " + blob.size + " bytes";
      output.innerHTML = `<pre class="json-panel">${preview
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")}</pre>`;
    } catch (error) {
      status.className = "status-line error";
      status.textContent = error.message;
      output.innerHTML = errorState(error);
    } finally {
      button.disabled = false;
    }
  });
}
