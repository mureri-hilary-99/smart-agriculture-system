/* Authentication helpers. Endpoints 5-9 of the API documentation. */

import { apiRequest } from "./api.js";
import { session } from "./session.js";

export async function login(credentials) {
  const data = await apiRequest("/api/v1/auth/login", {
    method: "POST",
    body: credentials
  });
  session.saveSession(data);
  return data;
}

export async function register(payload) {
  return apiRequest("/api/v1/auth/register", {
    method: "POST",
    body: payload
  });
}

export async function loadCurrentUser() {
  const user = await apiRequest("/api/v1/auth/me", { auth: true });
  session.setUser(user);
  return user;
}

export async function refreshSession() {
  const data = await apiRequest("/api/v1/auth/refresh", {
    method: "POST",
    body: { refresh_token: session.getRefreshToken() }
  });
  session.setTokens(data);
  return data;
}

export function requireAuth(requiredRole = null) {
  if (!session.isAuthenticated()) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`login.html?next=${next}`);
    return null;
  }
  const user = session.getUser();
  if (requiredRole && user && user.role !== requiredRole) {
    return { user, unauthorized: true };
  }
  return { user, unauthorized: false };
}

export function logout() {
  session.clear();
  location.href = "index.html";
}

export const ROLE_LABELS = {
  farmer: "Farmer",
  extension_officer: "Extension officer",
  admin: "Administrator"
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || "—";
}
