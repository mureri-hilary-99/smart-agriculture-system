import { api } from "../api.js";
import {
  card,
  display,
  errorState,
  fmtDate,
  pageIntro,
  skeletonRows,
  statusLine,
  table,
  textField,
} from "../components.js";

export function render() {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Dataset registry",
        description: "Tracks the agricultural datasets available for model training. Registration validates the file; it does not retrain automatically.",
        index: "Endpoint 32 / 36",
      })}</div>

      <div class="col-8">
        ${card({
          title: "Registered datasets",
          meta: "GET",
          body: '<div id="datasetResult">' + skeletonRows(6) + "</div>",
        })}
      </div>

      <div class="col-4">
        ${card({
          title: "Register dataset",
          meta: "POST",
          body: `<form id="datasetForm" class="form-stack">
            ${textField("name", "Dataset name", { required: true, placeholder: "Crop_recommendation.csv" })}
            ${textField("file_uri", "File URI", { required: true, placeholder: "backend/data/Crop_recommendation.csv" })}
            <div class="actions"><button class="btn" type="submit" id="datasetButton">Register</button></div>
            <div id="datasetStatus" class="status-line hidden"></div>
          </form>`,
        })}
      </div>
    </div>`;
}

export async function init() {
  const output = document.querySelector("#datasetResult");
  const form = document.querySelector("#datasetForm");
  const button = document.querySelector("#datasetButton");
  const status = document.querySelector("#datasetStatus");

  async function load() {
    output.innerHTML = skeletonRows(6);
    try {
      const data = await api.get("/api/v1/admin/datasets");
      const rows = (data.items || []).map((item) => [
        display(item.id),
        display(item.name),
        display(item.file_uri),
        display(item.rows_count),
        display(item.status),
        display(item.uploaded_by),
        fmtDate(item.created_at),
      ]);
      output.innerHTML = table(["ID", "Name", "File URI", "Rows", "Status", "Uploaded by", "Created"], rows);
    } catch (error) {
      output.innerHTML = errorState(error);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    button.disabled = true;
    status.className = "status-line";
    status.textContent = "Registering dataset...";
    try {
      const created = await api.post("/api/v1/admin/datasets", {
        name: data.get("name"),
        file_uri: data.get("file_uri"),
      });
      status.className = "status-line";
      status.textContent = "Dataset " + display(created.id) + " registered with status " + display(created.status) + ".";
      form.reset();
      await load();
    } catch (error) {
      status.className = "status-line error";
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  await load();
}
