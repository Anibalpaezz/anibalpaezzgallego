/// <reference types="astro/client" />

// ── Theme ──
(function () {
  const key = "theme";
  const stored = localStorage.getItem(key) || "dark";
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(stored);

  window.__toggleTheme = function () {
    const html = document.documentElement;
    const next = html.classList.contains("dark") ? "light" : "dark";
    html.classList.remove("light", "dark");
    html.classList.add(next);
    localStorage.setItem(key, next);
  };
})();

// ── Language (always matches the current route, not localStorage) ──
(function () {
  const m = window.location.pathname.match(/^\/(en|fr|de|zh)\b/);
  const lang = m ? m[1] : "es";
  document.documentElement.lang = lang;
  window.__lang = lang;

  window.__setLang = function (next: string) {
    localStorage.setItem("language", next);
    window.location.reload();
  };
})();

// ── Mobile menu ──
(function () {
  function updateMenuIcons(open: boolean) {
    const openIcon = document.getElementById("menu-icon-open");
    const closeIcon = document.getElementById("menu-icon-close");
    if (openIcon) openIcon.classList.toggle("hidden", open);
    if (closeIcon) closeIcon.classList.toggle("hidden", !open);
  }

  window.__toggleMenu = function () {
    const btn = document.getElementById("menu-btn");
    const menu = document.getElementById("mobile-menu");
    if (!btn || !menu) return;
    const open = !menu.classList.toggle("hidden");
    btn.setAttribute("aria-expanded", String(open));
    updateMenuIcons(open);
  };

  document.addEventListener("click", function (e) {
    const menu = document.getElementById("mobile-menu");
    const btn = document.getElementById("menu-btn");
    if (!menu || !btn) return;
    if (!menu.classList.contains("hidden") &&
      !menu.contains(e.target as Node) &&
      !btn.contains(e.target as Node)) {
      menu.classList.add("hidden");
      btn.setAttribute("aria-expanded", "false");
      updateMenuIcons(false);
    }
  });
})();

// ── Scroll to top ──
(function () {
  const btn = document.getElementById("scroll-top");
  if (!btn) return;

  let visible = false;
  window.addEventListener("scroll", function () {
    const shouldShow = window.scrollY > 400;
    if (shouldShow !== visible) {
      visible = shouldShow;
      btn.classList.toggle("hidden", !visible);
      btn.classList.toggle("flex", visible);
    }
  }, { passive: true });

  btn.addEventListener("click", function () {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });
})();

// ── Cookie banner ──
(function () {
  const COOKIE_KEY = "cookiesAccepted";
  const banner = document.getElementById("cookie-banner");
  if (!banner) return;

  if (localStorage.getItem(COOKIE_KEY)) {
    banner.remove();
  } else {
    banner.classList.remove("hidden");
    document.getElementById("cookie-accept")?.addEventListener("click", function () {
      localStorage.setItem(COOKIE_KEY, "true");
      banner.remove();
    });
    document.getElementById("cookie-decline")?.addEventListener("click", function () {
      localStorage.setItem(COOKIE_KEY, "false");
      banner.remove();
    });
  }
})();

// ── Scroll reveal (Intersection Observer) ──
(function () {
  if (!("IntersectionObserver" in window)) return;
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;
  const obs = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.08 }
  );
  els.forEach((el) => obs.observe(el));
})();
