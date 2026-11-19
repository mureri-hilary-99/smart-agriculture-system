/* Global behaviour: shell, scroll progress, reveal animations, parallax.
   All motion is disabled when the visitor prefers reduced motion. */

import { mountShell } from "./shell.js";

function initProgress() {
  const bar = document.createElement("div");
  bar.className = "scroll-progress";
  document.body.prepend(bar);

  const update = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    bar.style.width = `${max > 0 ? (doc.scrollTop / max) * 100 : 0}%`;
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}

function initReveal() {
  const targets = document.querySelectorAll("[data-reveal]");
  if (!targets.length) return;
  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const delay = Number(entry.target.dataset.delay || 0);
        if (delay) entry.target.style.transitionDelay = `${delay}ms`;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  targets.forEach((el) => observer.observe(el));
}

function initParallax() {
  const targets = document.querySelectorAll("[data-parallax]");
  if (!targets.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    targets.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        const offset = Math.min(Math.max(y * 0.05, -18), 18);
        el.style.transform = `translateY(${offset}px)`;
      }
    });
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
}

function init() {
  mountShell();
  initProgress();
  initReveal();
  initParallax();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
