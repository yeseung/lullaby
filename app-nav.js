(function () {
  const apps = window.MICROREGALO_APPS || [];
  const mounts = document.querySelectorAll("[data-app-nav]");

  function getLocale() {
    const htmlLocale = document.documentElement.lang || "";
    return htmlLocale.slice(0, 3).toLowerCase() === "zht"
      ? "zht"
      : htmlLocale.slice(0, 2).toLowerCase() || "en";
  }

  function getLabel(app, locale) {
    const labels = app.shortLabels || app.labels || {};
    return labels[locale] || labels.en || app.shortLabel || app.label;
  }

  function joinHref(base, href) {
    return `${base || ""}${href}`;
  }

  function render() {
    const locale = getLocale();

    mounts.forEach(mount => {
      const currentApp = mount.dataset.currentApp || "";
      const base = mount.dataset.appBase || "";
      const label = mount.dataset.appNavLabel || "MicroRegalo apps";
      const homeOnly = mount.dataset.appNavHomeOnly === "true";
      const includeHome = mount.dataset.includeHome !== "false";

      mount.classList.add("app-nav");
      mount.setAttribute("aria-label", label);
      mount.innerHTML = "";

      apps
        .filter(app => homeOnly ? app.id === "home" : includeHome || app.id !== "home")
        .forEach(app => {
          const link = document.createElement("a");
          const isCurrent = app.id === currentApp;

          link.className = `app-nav-link${isCurrent ? " is-active" : ""}`;
          link.href = joinHref(base, app.href);
          link.textContent = getLabel(app, locale);
          link.setAttribute("data-app-id", app.id);

          if (isCurrent) {
            link.setAttribute("aria-current", "page");
          }

          mount.appendChild(link);
        });
    });
  }

  render();
  window.addEventListener("microregalo:localechange", render);
})();
