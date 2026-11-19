import { api } from "../api.js";
import {
  card,
  display,
  errorState,
  fmtDate,
  fmtNumber,
  metric,
  pageIntro,
  skeletonBlock,
} from "../components.js";

export function render() {
  return `
    <div class="grid">
      <div class="col-12">${pageIntro({
        title: "Model information",
        description: "Metadata from the training artifact. Use this to explain confidence and to keep stored recommendations interpretable after retraining.",
        index: "Endpoint 33 / 36",
      })}</div>

      <div class="col-12">
        ${card({
          title: "Trained classifier",
          meta: "GET",
          body: '<div id="modelInfoResult">' + skeletonBlock(7) + "</div>",
        })}
      </div>
    </div>`;
}

export async function init() {
  const output = document.querySelector("#modelInfoResult");
  output.innerHTML = skeletonBlock(7);

  try {
    const info = await api.get("/api/v1/model/info");
    const accuracy = Number(info.test_accuracy) || 0;
    const percent = Math.round((accuracy <= 1 ? accuracy : accuracy / 100) * 100);

    output.innerHTML = `
      <div class="grid">
        <div class="col-4">
          <div class="metric-grid" style="grid-template-columns:1fr">
            ${metric("Model version", display(info.version))}
            ${metric("Trained", fmtDate(info.trained_at))}
            ${metric("Classes", display((info.classes || []).length))}
          </div>
        </div>
        <div class="col-8">
          <div class="metric-label">Test accuracy</div>
          <div class="bar-track" style="height:10px">
            <div class="bar-fill" style="width:${Math.max(0, Math.min(100, percent))}%"></div>
          </div>
          <div class="bar-value" style="text-align:left;margin-top:8px">${fmtNumber(accuracy, 4)}</div>

          <div class="grid" style="margin-top:20px">
            <div class="col-6">
              <div class="metric-label">Model features</div>
              <ul class="alt-list">
                ${(info.features || []).map((feature) => `<li><span>${display(feature)}</span></li>`).join("") || '<li><span>No features reported</span></li>'}
              </ul>
            </div>
            <div class="col-6">
              <div class="metric-label">Supported crop classes</div>
              <ul class="alt-list">
                ${(info.classes || []).map((crop) => `<li><span>${display(crop)}</span></li>`).join("") || '<li><span>No classes reported</span></li>'}
              </ul>
            </div>
          </div>
        </div>
      </div>`;
  } catch (error) {
    output.innerHTML = errorState(error);
  }
}
