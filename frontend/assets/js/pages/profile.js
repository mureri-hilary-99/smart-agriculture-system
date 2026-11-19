/* Profile page — GET /auth/me (8), PATCH /users/me (9), POST /auth/refresh (7). */

import { requireAuth, loadCurrentUser, refreshSession, logout, roleLabel } from "../auth.js";
import { apiRequest, errorMessage } from "../api.js";
import { session } from "../session.js";
import { qs, setAlert, formValues, escapeHtml, formatDate, skeletonLines, busy } from "../ui.js";

const gate = requireAuth();
if (gate) {
  const alertBox = qs("#profile-alert");
  const readTarget = qs("#profile-read");
  const form = qs("#profile-form");
  const submit = qs("#profile-submit");
  const sessionInfo = qs("#session-info");

  if (gate.unauthorized) {
    setAlert(alertBox, "warn", "Your account does not have permission to view this page.");
  } else {
    function renderProfile(user) {
      readTarget.innerHTML = `
        <div class="data-grid" style="display:block">
          <div class="data-cell" style="border-right:0"><div class="data-label">Name</div><div class="data-value small">${escapeHtml(user.full_name || "—")}</div></div>
          <div class="data-cell" style="border-right:0"><div class="data-label">Email</div><div class="data-value small">${escapeHtml(user.email || "—")}</div></div>
          <div class="data-cell" style="border-right:0"><div class="data-label">Role</div><div class="data-value small">${escapeHtml(roleLabel(user.role))}</div></div>
          <div class="data-cell" style="border-right:0"><div class="data-label">Phone</div><div class="data-value small">${escapeHtml(user.phone || "—")}</div></div>
          <div class="data-cell" style="border-right:0"><div class="data-label">Location</div><div class="data-value small">${escapeHtml(user.location || "—")}</div></div>
          <div class="data-cell" style="border-right:0"><div class="data-label">County</div><div class="data-value small">${escapeHtml(user.county || "—")}</div></div>
          <div class="data-cell" style="border-right:0"><div class="data-label">Joined</div><div class="data-value small">${escapeHtml(formatDate(user.created_at))}</div></div>
        </div>`;
      ["full_name", "phone", "location", "county"].forEach((key) => {
        if (form.elements[key]) form.elements[key].value = user[key] || "";
      });
    }

    function renderSession() {
      const user = session.getUser();
      const token = session.getAccessToken() || "";
      sessionInfo.innerHTML = `
        <div>Signed in as ${escapeHtml(user?.email || "unknown")}</div>
        <div>Access token: ${token ? `${escapeHtml(token.slice(0, 12))}…${escapeHtml(token.slice(-6))}` : "none"}</div>
        <div>Refresh token: ${session.getRefreshToken() ? "present" : "none"}</div>`;
    }

    async function loadProfile() {
      readTarget.innerHTML = skeletonLines(5);
      try {
        const user = await loadCurrentUser();
        renderProfile(user);
      } catch (error) {
        readTarget.innerHTML = "";
        setAlert(alertBox, "error", errorMessage(error));
      }
      renderSession();
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      setAlert(alertBox, "", "");
      const values = formValues(form);
      const payload = Object.fromEntries(
        ["full_name", "phone", "location", "county"].map((key) => [key, (values[key] || "").trim()])
      );
      busy(submit, true, "Save changes");
      try {
        const updated = await apiRequest("/api/v1/users/me", { method: "PATCH", auth: true, body: payload });
        session.setUser(updated);
        renderProfile(updated);
        setAlert(alertBox, "info", "Profile updated.");
      } catch (error) {
        setAlert(alertBox, "error", errorMessage(error));
      } finally {
        busy(submit, false);
      }
    });

    qs("#refresh-token")?.addEventListener("click", async (event) => {
      setAlert(alertBox, "", "");
      busy(event.currentTarget, true, "Refreshing…");
      try {
        await refreshSession();
        renderSession();
        setAlert(alertBox, "info", "Access token refreshed.");
      } catch (error) {
        setAlert(alertBox, "error", errorMessage(error));
      } finally {
        busy(event.currentTarget, false, "Refresh access token");
      }
    });

    qs("#logout")?.addEventListener("click", logout);
    loadProfile();
  }
}
