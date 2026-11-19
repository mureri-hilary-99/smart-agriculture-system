import { getConfig, saveConfig } from "./api.js";
import { startRouter } from "./router.js";

const view = document.getElementById("view");
const pageTitle = document.getElementById("pageTitle");
const pageEndpoint = document.getElementById("pageEndpoint");
const nav = document.getElementById("nav");
const menuToggle = document.getElementById("menuToggle");
const connectionToggle = document.getElementById("connectionToggle");
const connectionPanel = document.getElementById("connectionPanel");
const connectionClose = document.getElementById("connectionClose");
const connectionForm = document.getElementById("connectionForm");
const baseUrlInput = document.getElementById("baseUrlInput");
const tokenInput = document.getElementById("tokenInput");
const envNote = document.getElementById("envNote");

function loadConnection() {
  const config = getConfig();
  baseUrlInput.value = config.baseUrl;
  tokenInput.value = config.token;
  envNote.textContent = config.baseUrl.includes("localhost") ? "LOCAL API" : "REMOTE API";
}

function setConnectionPanel(open) {
  connectionPanel.classList.toggle("open", open);
  connectionPanel.setAttribute("aria-hidden", String(!open));
  connectionToggle.setAttribute("aria-expanded", String(open));
}

connectionToggle.addEventListener("click", () => {
  setConnectionPanel(!connectionPanel.classList.contains("open"));
});

connectionClose.addEventListener("click", () => setConnectionPanel(false));

connectionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveConfig({
    baseUrl: baseUrlInput.value.trim().replace(/\/$/, ""),
    token: tokenInput.value.trim(),
  });
  loadConnection();
  setConnectionPanel(false);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
});

menuToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

nav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    nav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }
});

loadConnection();

if (!window.location.hash) {
  window.location.replace("#/overview");
}

startRouter({
  outlet: view,
  onRoute(route) {
    pageTitle.textContent = route.title;
    pageEndpoint.textContent = route.endpoints;
    document.querySelectorAll("[data-route]").forEach((link) => {
      link.classList.toggle("active", link.dataset.route === route.path);
    });
  },
});
