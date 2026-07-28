(function () {
  // Static player state only lives in localStorage; audio files are loaded on demand.
  const tracks = window.LULLABY_TRACKS || [];
  const categories = window.LULLABY_CATEGORIES || [];
  const i18n = window.LULLABY_I18N || { defaultLocale: "en", locales: {} };
  const audio = document.getElementById("audio-player");
  const languageSelect = document.getElementById("language-select");
  const appTitle = document.getElementById("app-title");
  const pageEyebrow = document.getElementById("page-eyebrow");
  const playerPanel = document.getElementById("player-panel");
  const timerPanel = document.getElementById("timer-panel");
  const timerLabel = document.getElementById("timer-label");
  const libraryPanel = document.getElementById("library-panel");
  const licenseNotice = document.getElementById("license-notice");
  const trackList = document.getElementById("track-list");
  const timerOptions = document.getElementById("timer-options");
  const currentTitle = document.getElementById("current-title");
  const currentMeta = document.getElementById("current-meta");
  const ringButton = document.getElementById("ring-button");
  const ringIcon = document.getElementById("ring-icon");
  const ringTime = document.getElementById("ring-time");
  const ringProgress = document.getElementById("ring-progress");
  const toggleButton = document.getElementById("toggle-button");
  const stopButton = document.getElementById("stop-button");
  const filterTabs = Array.from(document.querySelectorAll(".filter-tab"));

  const storageKeys = {
    track: "microregalo_lullaby_track",
    timer: "microregalo_lullaby_timer",
    favorites: "microregalo_lullaby_favorites",
    locale: "microregalo_lullaby_locale"
  };

  const iconText = {
    moon: "🌙",
    flower: "🌸",
    leaf: "🍃",
    star: "⭐",
    carousel: "🎠",
    forest: "🌲",
    rain: "🌧️",
    sleep: "💤",
    hourglass: "⏳",
    musicbox: "🎵",
    note: "♪",
    harp: "🎼",
    petal: "🌺",
    violin: "🎻",
    wave: "🌊",
    bird: "🐦"
  };

  let currentTrack = null;
  let isPlaying = false;
  let activeFilter = "all";
  let currentLocale = getInitialLocale();
  let playbackMessageKey = "";
  let timerMinutes = Number(localStorage.getItem(storageKeys.timer) || "0");
  let timerTotalSeconds = 0;
  let timerRemainingSeconds = 0;
  let timerId = null;
  let favorites = new Set(readJson(storageKeys.favorites, []));

  const circumference = 2 * Math.PI * 42;
  ringProgress.style.strokeDasharray = circumference.toFixed(2);
  ringProgress.style.strokeDashoffset = "0";
  audio.preload = "none";
  audio.loop = true;
  audio.volume = 0.6;

  function getInitialLocale() {
    const saved = localStorage.getItem(storageKeys.locale);
    if (saved && i18n.locales[saved]) return saved;

    const browserLocales = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || ""];
    const matchedLocale = browserLocales
      .map(locale => {
        const normalized = locale.toLowerCase();
        if (normalized === "zh-tw" || normalized === "zh-hk" || normalized === "zh-mo" || normalized === "zh-hant") {
          return "zht";
        }
        return normalized.slice(0, 2);
      })
      .find(locale => i18n.locales[locale]);

    return matchedLocale || i18n.defaultLocale;
  }

  function getLocaleData() {
    return i18n.locales[currentLocale] || i18n.locales[i18n.defaultLocale] || { ui: {}, categories: {}, tracks: {} };
  }

  function t(key, values = {}) {
    const text = getLocaleData().ui[key] || key;
    return Object.entries(values).reduce(
      (result, [name, value]) => result.replace(`{${name}}`, value),
      text
    );
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function persistFavorites() {
    localStorage.setItem(storageKeys.favorites, JSON.stringify(Array.from(favorites)));
  }

  function getTrackTitle(track) {
    return getLocaleData().tracks[track.key] || track.title;
  }

  function getCategoryLabel(category) {
    return getLocaleData().categories[category] || category;
  }

  function formatTrackTitle(track) {
    return track.category === "클래식 자장가"
      ? `${track.composer} - ${getTrackTitle(track)}`
      : getTrackTitle(track);
  }

  function formatTimer(seconds) {
    if (timerMinutes === 0) return "∞";
    const safe = Math.max(0, seconds);
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    return h > 0
      ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function setTimer(minutes) {
    timerMinutes = minutes;
    localStorage.setItem(storageKeys.timer, String(minutes));
    if (isPlaying) startCountdown();
    renderTimerOptions();
    renderPlayer();
  }

  function startCountdown() {
    clearCountdown();
    if (timerMinutes <= 0) return;

    timerTotalSeconds = timerMinutes * 60;
    timerRemainingSeconds = timerTotalSeconds;
    timerId = window.setInterval(() => {
      timerRemainingSeconds -= 1;
      if (timerRemainingSeconds <= 0) {
        stopTrack();
        return;
      }
      renderPlayer();
    }, 1000);
  }

  function clearCountdown() {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
    timerTotalSeconds = 0;
    timerRemainingSeconds = 0;
  }

  async function playTrack(track) {
    const isNewTrack = !currentTrack || currentTrack.key !== track.key;
    const needsSource = audio.getAttribute("src") !== track.url;
    currentTrack = track;

    if (isNewTrack || needsSource) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      // Keep the first page load light: assign the MP3 URL only after the user chooses a track.
      audio.src = track.url;
      localStorage.setItem(storageKeys.track, track.key);
    }

    try {
      await audio.play();
      isPlaying = true;
      playbackMessageKey = "";
      if (isNewTrack || timerId === null) startCountdown();
    } catch {
      isPlaying = false;
      playbackMessageKey = "blocked";
    }

    renderAll();
  }

  function toggleCurrentTrack() {
    if (!currentTrack) {
      const firstVisible = getVisibleTracks()[0] || tracks[0];
      if (firstVisible) playTrack(firstVisible);
      return;
    }

    if (isPlaying) {
      audio.pause();
      isPlaying = false;
      if (timerId) window.clearInterval(timerId);
      timerId = null;
    } else {
      return playTrack(currentTrack);
    }

    renderAll();
  }

  function stopTrack() {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    isPlaying = false;
    currentTrack = null;
    playbackMessageKey = "";
    clearCountdown();
    renderAll();
  }

  function toggleFavorite(key) {
    if (favorites.has(key)) favorites.delete(key);
    else favorites.add(key);
    persistFavorites();
    renderTrackList();
  }

  function getVisibleTracks() {
    return activeFilter === "favorites"
      ? tracks.filter(track => favorites.has(track.key))
      : tracks;
  }

  function renderPlayer() {
    if (!currentTrack) {
      currentTitle.textContent = t("emptyTitle");
      currentMeta.textContent = t("emptyMeta");
      ringIcon.textContent = "♪";
      ringTime.textContent = timerMinutes === 0 ? "∞" : formatTimer(timerMinutes * 60);
      toggleButton.textContent = t("play");
      ringButton.classList.remove("is-playing");
      ringProgress.style.strokeDashoffset = "0";
      return;
    }

    currentTitle.textContent = getTrackTitle(currentTrack);
    currentMeta.textContent = playbackMessageKey
      ? t(playbackMessageKey)
      : `${currentTrack.originalTitle} · ${currentTrack.composer} · ${currentTrack.attribution}`;
    ringIcon.textContent = iconText[currentTrack.icon] || "♪";
    ringTime.textContent = timerMinutes === 0 ? "∞" : formatTimer(timerRemainingSeconds || timerMinutes * 60);
    toggleButton.textContent = isPlaying ? t("pause") : t("play");
    ringButton.classList.toggle("is-playing", isPlaying);

    if (timerTotalSeconds > 0 && timerRemainingSeconds > 0) {
      const fraction = timerRemainingSeconds / timerTotalSeconds;
      ringProgress.style.strokeDashoffset = (circumference * (1 - fraction)).toFixed(2);
    } else {
      ringProgress.style.strokeDashoffset = "0";
    }
  }

  function renderTimerOptions() {
    timerOptions.innerHTML = "";
    [10, 30, 60, 120, 0].forEach(minutes => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `timer-btn${timerMinutes === minutes ? " active" : ""}`;
      button.textContent = minutes === 0 ? "∞" : t("timerMinutes", { minutes });
      button.addEventListener("click", () => setTimer(minutes));
      timerOptions.appendChild(button);
    });
  }

  function renderTrackList() {
    trackList.innerHTML = "";

    if (activeFilter === "favorites" && favorites.size === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = t("emptyFavorites");
      trackList.appendChild(empty);
      return;
    }

    categories.forEach(category => {
      const categoryTracks = getVisibleTracks().filter(track => track.category === category);
      if (categoryTracks.length === 0) return;

      const header = document.createElement("h2");
      header.className = "category-title";
      header.textContent = getCategoryLabel(category);
      trackList.appendChild(header);

      categoryTracks.forEach(track => {
        const item = document.createElement("article");
        const selected = currentTrack && currentTrack.key === track.key;
        item.className = `track-item${selected ? " selected" : ""}`;

        const playButton = document.createElement("button");
        playButton.type = "button";
        playButton.className = "track-main";
        playButton.addEventListener("click", () => playTrack(track));

        const icon = document.createElement("span");
        icon.className = "track-icon";
        icon.textContent = iconText[track.icon] || "♪";

        const info = document.createElement("span");
        info.className = "track-info";

        const name = document.createElement("span");
        name.className = "track-name";
        name.textContent = formatTrackTitle(track);

        const meta = document.createElement("span");
        meta.className = "track-meta";
        meta.textContent = selected
          ? `${track.originalTitle} · ${track.attribution}`
          : track.originalTitle;

        info.append(name, meta);

        const state = document.createElement("span");
        state.className = "track-state";
        state.textContent = selected ? (isPlaying ? t("playing") : t("selected")) : "";

        playButton.append(icon, info, state);

        const fav = document.createElement("button");
        fav.type = "button";
        fav.className = `favorite-btn${favorites.has(track.key) ? " active" : ""}`;
        fav.setAttribute("aria-label", t("favoriteLabel", { title: getTrackTitle(track) }));
        fav.textContent = "★";
        fav.addEventListener("click", () => toggleFavorite(track.key));

        item.append(playButton, fav);
        trackList.appendChild(item);
      });
    });
  }

  function renderFilters() {
    filterTabs.forEach(tab => {
      tab.textContent = tab.dataset.filter === "favorites" ? t("filterFavorites") : t("filterAll");
      tab.classList.toggle("active", tab.dataset.filter === activeFilter);
    });
  }

  function renderLanguageOptions() {
    languageSelect.innerHTML = "";
    Object.entries(i18n.locales).forEach(([locale, data]) => {
      const option = document.createElement("option");
      option.value = locale;
      option.textContent = data.label || locale;
      option.selected = locale === currentLocale;
      languageSelect.appendChild(option);
    });
  }

  function renderStaticText(updateDocumentMetadata = false) {
    const localeData = getLocaleData();
    document.documentElement.lang = currentLocale;
    if (updateDocumentMetadata) {
      document.title = localeData.title || document.title;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription && localeData.description) {
        metaDescription.setAttribute("content", localeData.description);
      }
    }

    languageSelect.setAttribute("aria-label", t("languageLabel"));
    appTitle.textContent = t("appTitle");
    pageEyebrow.textContent = t("pageEyebrow");
    playerPanel.setAttribute("aria-label", t("playerLabel"));
    timerPanel.setAttribute("aria-label", t("timerLabel"));
    timerLabel.textContent = t("timerLabel");
    libraryPanel.setAttribute("aria-label", t("libraryLabel"));
    toggleButton.textContent = isPlaying ? t("pause") : t("play");
    stopButton.textContent = t("stop");
    licenseNotice.textContent = t("licenseNotice");
  }

  function renderAll(updateDocumentMetadata = false) {
    renderStaticText(updateDocumentMetadata);
    renderLanguageOptions();
    renderPlayer();
    renderTimerOptions();
    renderFilters();
    renderTrackList();
  }

  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      activeFilter = tab.dataset.filter || "all";
      renderAll();
    });
  });

  languageSelect.addEventListener("change", () => {
    currentLocale = languageSelect.value;
    localStorage.setItem(storageKeys.locale, currentLocale);
    renderAll(true);
    window.dispatchEvent(new CustomEvent("microregalo:localechange", { detail: { locale: currentLocale } }));
  });

  ringButton.addEventListener("click", toggleCurrentTrack);
  toggleButton.addEventListener("click", toggleCurrentTrack);
  stopButton.addEventListener("click", stopTrack);

  const savedKey = localStorage.getItem(storageKeys.track);
  if (savedKey) {
    currentTrack = tracks.find(track => track.key === savedKey) || null;
  }

  renderAll();
})();
