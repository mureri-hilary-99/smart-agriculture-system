/* Admin users — GET /admin/users (10), PATCH /admin/users/{id} (11). */

import { requireAuth, roleLabel } from "../auth.js";
import { apiRequest, errorMessage } from "../api.js";
import { qs, setAlert, formValues, escapeHtml, formatDate, skeletonRows, debounce, busy } from "../ui.js";

const gate = requireAuth("admin");

if (gate) {
  const alertBox = qs("#admin-alert");
  if (gate.unauthorized) {
    setAlert(alertBox, "warn", "Administrator access is required to manage users.");
  } else {
    const list = qs("#user-list");
    const search = qs("#user-search");
    const roleFilter = qs("#role-filter");
    const prev = qs("#users-prev");
    const next = qs("#users-next");
    const pageInfo = qs("#users-page-info");
    const editForm = qs("#user-edit");
    const editSubmit = qs("#user-edit-submit");
    let page = 1;
    const pageSize = 20;

    async function loadUsers() {
      setAlert(alertBox, "", "");
      list.innerHTML = `<tr><td colspan="5"><div class="table-wrap"><table><tbody>${skeletonRows(4, 5)}</tbody></table></div></td></tr>`;
      try {
        const data = await apiRequest("/api/v1/admin/users", {
          auth: true,
          query: {
            page,
            page_size: pageSize,
            role: roleFilter.value,
            q: search.value.trim()
          }
        });
        const items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) {
          list.innerHTML = '<tr><td colspan="5" class="table-empty">No users found.</td></tr>';
        } else {
          list.innerHTML = items.map((user) => `
            <tr>
              <td>${escapeHtml(user.full_name)}</td>
              <td class="small muted">${escapeHtml(user.email)}</td>
              <td>${escapeHtml(roleLabel(user.role))}</td>
              <td>${user.is_active ? '<span class="status status--ok">Active</span>' : '<span class="status status--error">Inactive</span>'}</td>
              <td><button class="btn btn--quiet btn--small" type="button" data-edit-user="${escapeHtml(user.id)}" data-role="${escapeHtml(user.role)}" data-active="${user.is_active ? "true" : "false"}">Edit</button></td>
            </tr>`).join("");
        }
        pageInfo.textContent = `Page ${data.page || page} · ${data.total ?? items.length} user(s)`;
        prev.disabled = page <= 1;
        next.disabled = items.length < pageSize;
      } catch (error) {
        list.innerHTML = "";
        pageInfo.textContent = "";
        setAlert(alertBox, "error", errorMessage(error));
      }
    }

    list?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-edit-user]");
      if (!button) return;
      editForm.elements.user_id.value = button.dataset.editUser;
      editForm.elements.role.value = button.dataset.role;
      editForm.elements.is_active.value = button.dataset.active;
      setAlert(alertBox, "info", `Editing user ${button.dataset.editUser}.`);
      editForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    search?.addEventListener("input", debounce(() => { page = 1; loadUsers(); }, 300));
    roleFilter?.addEventListener("change", () => { page = 1; loadUsers(); });
    prev?.addEventListener("click", () => { if (page > 1) { page -= 1; loadUsers(); } });
    next?.addEventListener("click", () => { page += 1; loadUsers(); });

    editForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      setAlert(alertBox, "", "");
      const values = formValues(editForm);
      if (!values.user_id) {
        setAlert(alertBox, "error", "Select a user from the list first.");
        return;
      }
      const payload = {
        role: values.role,
        is_active: values.is_active === "true"
      };
      busy(editSubmit, true, "Save user");
      try {
        const updated = await apiRequest(`/api/v1/admin/users/${encodeURIComponent(values.user_id)}`, {
          method: "PATCH",
          auth: true,
          body: payload
        });
        setAlert(alertBox, "info", `${updated.full_name || "User"} updated.`);
        await loadUsers();
      } catch (error) {
        setAlert(alertBox, "error", errorMessage(error));
      } finally {
        busy(editSubmit, false);
      }
    });

    loadUsers();
  }
}
