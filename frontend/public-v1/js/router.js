// Hash router — one route per API endpoint from rows 19-36 of the API document.

import { skeletonCards, errorState, observeReveals } from "./components.js";

const routes = [
  {
    path: "/overview",
    title: "Field overview",
    endpoints: "GET /soil-readings/latest · GET /weather/current · GET /recommendations/latest",
    view: () => import("./views/overview.js"),
  },
  {
    path: "/soil-readings",
    title: "Soil readings",
    endpoints: "GET /api/v1/soil-readings",
    view: () => import("./views/soil-readings.js"),
  },
  {
    path: "/soil-readings/latest",
    title: "Latest soil",
    endpoints: "GET /api/v1/soil-readings/latest",
    view: () => import("./views/soil-latest.js"),
  },
  {
    path: "/weather/current",
    title: "Current weather",
    endpoints: "GET /api/v1/weather/current",
    view: () => import("./views/weather-current.js"),
  },
  {
    path: "/weather",
    title: "Weather history",
    endpoints: "GET /api/v1/weather",
    view: () => import("./views/weather-history.js"),
  },
  {
    path: "/weather/refresh",
    title: "Refresh weather",
    endpoints: "POST /api/v1/weather/refresh",
    view: () => import("./views/weather-refresh.js"),
  },
  {
    path: "/recommendations/new",
    title: "New recommendation",
    endpoints: "POST /api/v1/recommendations",
    view: () => import("./views/recommendations-new.js"),
  },
  {
    path: "/recommendations",
    title: "Recommendation history",
    endpoints: "GET /api/v1/recommendations",
    view: () => import("./views/recommendations-history.js"),
  },
  {
    path: "/recommendations/latest",
    title: "Latest recommendation",
    endpoints: "GET /api/v1/recommendations/latest",
    view: () => import("./views/recommendations-latest.js"),
  },
  {
    path: "/recommendations/detail",
    title: "Recommendation detail",
    endpoints: "GET /api/v1/recommendations/{id}",
    view: () => import("./views/recommendation-detail.js"),
  },
  {
    path: "/crops",
    title: "Crops",
    endpoints: "GET /api/v1/crops",
    view: () => import("./views/crops.js"),
  },
  {
    path: "/crops/detail",
    title: "Crop detail",
    endpoints: "GET /api/v1/crops/{code}",
    view: () => import("./views/crop-detail.js"),
  },
  {
    path: "/crops/manage",
    title: "Crop management",
    endpoints: "POST / PATCH / DELETE /api/v1/crops",
    view: () => import("./views/crop-admin.js"),
  },
  {
    path: "/admin/system-params",
    title: "System parameters",
    endpoints: "GET / PATCH /api/v1/admin/system-params",
    view: () => import("./views/system-params.js"),
  },
  {
    path: "/admin/datasets",
    title: "Datasets",
    endpoints: "GET / POST /api/v1/admin/datasets",
    view: () => import("./views/datasets.js"),
  },
  {
    path: "/model/info",
    title: "Model information",
    endpoints: "GET /api/v1/model/info",
    view: () => import("./views/model-info.js"),
  },
  {
    path: "/reports/summary",
    title: "Reports summary",
    endpoints: "GET /api/v1/reports/summary",
    view: () => import("./views/reports-summary.js"),
  },
  {
    path: "/reports/export",
    title: "CSV export",
    endpoints: "GET /api/v1/reports/export",
    view: () => import("./views/reports-export.js"),
  },
  {
    path: "/audit-logs",
    title: "Audit log",
    endpoints: "GET /api/v1/audit-logs",
    view: () => import("./views/audit-logs.js"),
  },
];

function parseHash() {
  const raw = window.location.hash.slice(1) || "/overview";
  const [path, search = ""] = raw.split("?");
  return {
    path: path || "/overview",
    params: Object.fromEntries(new URLSearchParams(search)),
  };
}

export function startRouter({ outlet, onRoute }) {
  let renderToken = 0;

  async function render() {
    const token = ++renderToken;
    const { path, params } = parseHash();
    const route = routes.find((item) => item.path === path) || routes[0];

    onRoute?.(route, params);
    outlet.innerHTML = skeletonCards(3);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });

    try {
      const module = await route.view();
      if (token !== renderToken) return;

      outlet.innerHTML = module.render(params);
      observeReveals(outlet);
      await module.init?.(params, outlet);
    } catch (error) {
      if (token !== renderToken) return;
      outlet.innerHTML = errorState(error);
    }
  }

  window.addEventListener("hashchange", render);
  render();
}

export { routes };
