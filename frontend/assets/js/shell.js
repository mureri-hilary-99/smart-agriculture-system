/* Shared header and footer. Pages provide <div id="site-header"> and
   <div id="site-footer"> mount points. */

import { session } from "./session.js";
import { roleLabel } from "./auth.js";

const LINKS = [
  { label: "Overview", href: "index.html", page: "overview" },
  { label: "Prediction", href: "predict.html", page: "predict" },
  { label: "Farms", href: "farms.html", page: "farms" },
  { label: "Devices", href: "devices.html", page: "devices" },
  { label: "System", href: "system.html", page: "system" },
  { label: "API", href: "api-reference.html", page: "api" }
];

function accountLink() {
  if (session.isAuthenticated()) {
    const user = session.getUser();
    const label = user ? roleLabel(user.role) : "Account";
    return `<a href="profile.html" data-nav="profile">${label}</a>`;
  }
  return '<a href="login.html" data-nav="auth">Sign in</a>';
}

export function mountShell() {
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  const active = document.body.dataset.page || "";

  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="container header-inner">
          <a class="brand" href="index.html" aria-label="Smart Agriculture home">
            <span class="brand-mark" aria-hidden="true"></span>
            <span class="brand-name">Smart Agriculture</span>
          </a>
          <button class="nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="main-nav">Menu</button>
          <nav class="nav" id="main-nav" aria-label="Primary">
            ${LINKS.map((link) => `<a href="${link.href}" data-nav="${link.page}"${active === link.page ? ' class="is-active" aria-current="page"' : ""}>${link.label}</a>`).join("")}
            ${accountLink()}
          </nav>
        </div>
      </header>`;
  }

  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-inner">
          <span>Smart Agriculture — crop recommendation decision support</span>
          <span>Group IV · Kibabii University · <span id="year"></span></span>
        </div>
      </footer>`;
  }

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
    });
    nav.addEventListener("click", (event) => {
      if (event.target.tagName === "A") {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Menu";
      }
    });
  }
}
