/* API client. Every path, method and payload below follows
   docs/API_DOCUMENTATION.md (endpoints 1-18). */

import { session } from "./session.js";

/* Re-exported for pages that import all display helpers from this module. */
export { errorMessage } from "./ui.js";

export class ApiError extends Error {
  constructor(status, detail, payload) {
    super(ApiError.messageFrom(detail));
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.payload = payload;
  }

  static messageFrom(detail) {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => `${item.loc?.join(".") || "field"}: ${item.msg}`).join("; ");
    }
    if (detail && typeof detail === "object") return detail.msg || "Request failed";
    return "Request failed";
  }
}

function buildUrl(path, query) {
  const base = window.AGRI_CONFIG.getApiBaseUrl();
  const url = new URL(path.startsWith("http") ? path : base + path);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }
  return url;
}

async function send(url, options) {
  return fetch(url, options);
}

async function refreshAccessToken() {
  const refreshToken = session.getRefreshToken();
  if (!refreshToken) return null;
  try {
    const response = await send(buildUrl("/api/v1/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!response.ok) throw new Error("refresh failed");
    const data = await response.json();
    session.setAccessToken(data.access_token);
    return data.access_token;
  } catch {
    session.clear();
    return null;
  }
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    query,
    auth = false,
    deviceKey = null,
    raw = false
  } = options;

  const url = buildUrl(path, query);
  const headers = { "Accept": "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = session.getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  if (deviceKey) headers["X-Device-Key"] = deviceKey;

  const fetchOptions = {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  };

  let response = await send(url, fetchOptions);

  if (response.status === 401 && auth && session.getRefreshToken()) {
    const token = await refreshAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      response = await send(url, { ...fetchOptions, headers });
    }
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    const detail = data && (data.detail !== undefined ? data.detail : data);
    throw new ApiError(response.status, detail, data);
  }

  return raw ? { data, response } : data;
}

export const api = {
  get: (path, options = {}) => apiRequest(path, { ...options, method: "GET" }),
  post: (path, body, options = {}) => apiRequest(path, { ...options, method: "POST", body }),
  patch: (path, body, options = {}) => apiRequest(path, { ...options, method: "PATCH", body })
};
