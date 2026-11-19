/* Token + profile storage. Kept dependency-free so both api.js and auth.js
   can use it without a circular import. */

const KEYS = {
  access: "agri_access_token",
  refresh: "agri_refresh_token",
  user: "agri_user"
};

export const session = {
  getAccessToken() {
    return localStorage.getItem(KEYS.access);
  },
  setAccessToken(token) {
    localStorage.setItem(KEYS.access, token);
  },
  getRefreshToken() {
    return localStorage.getItem(KEYS.refresh);
  },
  setRefreshToken(token) {
    localStorage.setItem(KEYS.refresh, token);
  },
  getUser() {
    try {
      const raw = localStorage.getItem(KEYS.user);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser(user) {
    localStorage.setItem(KEYS.user, JSON.stringify(user));
  },
  saveSession(data) {
    if (data && data.access_token) this.setAccessToken(data.access_token);
    if (data && data.refresh_token) this.setRefreshToken(data.refresh_token);
    if (data && data.user) this.setUser(data.user);
  },
  setTokens({ access_token, refresh_token }) {
    if (access_token) this.setAccessToken(access_token);
    if (refresh_token) this.setRefreshToken(refresh_token);
  },
  clear() {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  },
  isAuthenticated() {
    return Boolean(this.getAccessToken());
  }
};
