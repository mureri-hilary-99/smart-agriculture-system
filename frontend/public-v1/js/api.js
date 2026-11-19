// Thin API client. No framework, no ORM-style coupling — plain fetch + JSON.

const STORAGE_KEY = "sa.api.config";

const DEFAULTS = {
  baseUrl: "http://localhost:8000",
  token: "",
};

export class ApiError extends Error {
  constructor(status, detail) {
    super(toMessage(detail));
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function toMessage(detail) {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const where = Array.isArray(item.loc) ? item.loc.join(".") : "request";
        return `${where}: ${item.msg || "invalid value"}`;
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return "The request could not be completed.";
}

export function getConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(patch) {
  const next = { ...getConfig(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function currentFarmId(params = {}) {
  return params.farm_id || localStorage.getItem("sa.farm_id") || "1";
}

export function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, String(value));
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

async function request(path, { method = "GET", query, body, responseType = "json" } = {}) {
  const config = getConfig();
  const headers = {
    Accept: responseType === "blob" ? "text/csv" : "application/json",
  };

  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;

  let response;
  try {
    response = await fetch(`${config.baseUrl}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Cannot reach the API at ${config.baseUrl}. Check the connection settings.`);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      detail = payload.detail ?? payload;
    } catch {
      detail = await response.text().catch(() => detail);
    }
    throw new ApiError(response.status, detail);
  }

  if (responseType === "blob") return response.blob();
  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path, options = {}) => request(path, { ...options, method: "GET" }),
  post: (path, body, options = {}) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options = {}) => request(path, { ...options, method: "PATCH", body }),
  del: (path, options = {}) => request(path, { ...options, method: "DELETE" }),
  download: (path, options = {}) => request(path, { ...options, method: "GET", responseType: "blob" }),
};

export { request };
