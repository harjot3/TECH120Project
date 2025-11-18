(() => {
  // Prevent double-injection
  if (window.__sfmInitialized) return;
  window.__sfmInitialized = true;

  // --- CONFIG (PROTOTYPE: fixed daily time limit) ---

  // Single fixed time limit: 10 minutes (prototype)
  // For quick testing you can change this to e.g. 60 (60 seconds)
  const METER_LIMIT_SECONDS = 10 * 60;

  // How long the pop-up stays visible (should match CSS animation time)
  const POPUP_DURATION_MS = 10000;

  // How often we check whether we're on Shorts / Reels / TikTok (ms)
  const SHORTFORM_CHECK_INTERVAL_MS = 500;

  // Storage keys for global daily timer
  const STORAGE_TIME_KEY = "sfm_global_time_seconds";
  const STORAGE_DATE_KEY = "sfm_global_date";

  // --- STATE ---

  let elapsedSeconds = 0;       // global daily time across all sites
  let scrollCount = 0;          // per "session" in short-form, based on URL changes
  let timerId = null;
  let isActive = !document.hidden;
  let shortFormActive = false;  // whether THIS tab is currently in a short-form view
  let currentDateStr = getTodayDateString();
  let lastShortFormUrl = null;  // last URL while in short-form, used to detect "scrolls"

  // --- UTILITIES ---

  function getTodayDateString() {
    // Simple YYYY-MM-DD; uses local time via Date()
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function loadGlobalTimeAndInit() {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      // Fallback: no storage, just run per-tab
      initAfterLoad();
      return;
    }

    chrome.storage.local.get(
      { [STORAGE_TIME_KEY]: 0, [STORAGE_DATE_KEY]: null },
      (data) => {
        const storedDate = data[STORAGE_DATE_KEY];
        const storedTime = data[STORAGE_TIME_KEY];

        currentDateStr = getTodayDateString();

        if (storedDate === currentDateStr && typeof storedTime === "number") {
          // Same day: continue counting from stored time
          elapsedSeconds = storedTime;
        } else {
          // New day or no data: reset
          elapsedSeconds = 0;
          saveGlobalTime(); // write fresh reset
        }

        initAfterLoad();
      }
    );
  }

  function saveGlobalTime() {
    try {
      if (!chrome || !chrome.storage || !chrome.storage.local) return;
      chrome.storage.local.set({
        [STORAGE_TIME_KEY]: elapsedSeconds,
        [STORAGE_DATE_KEY]: currentDateStr
      });
    } catch (e) {
      // ignore in prototype
    }
  }

  function maybeResetForNewDay() {
    const today = getTodayDateString();
    if (today !== currentDateStr) {
      currentDateStr = today;
      elapsedSeconds = 0;
      scrollCount = 0;
      saveGlobalTime();
      updateMeterUI();
      removeFunFactPopup();
    }
  }

  // --- SHORT-FORM DETECTION ---

  function isOnShortFormNow() {
    const hostname = window.location.hostname || "";
    const path = window.location.pathname || "";
    const href = window.location.href || "";

    const onYouTube = hostname.includes("youtube.com");
    const onTikTok = hostname.includes("tiktok.com");
    const onInstagram = hostname.includes("instagram.com");

    // YouTube Shorts: any URL that has /shorts
    const isYouTubeShorts =
      onYouTube && (path.includes("/shorts") || href.includes("/shorts"));

    // TikTok: treat whole site as short-form
    const isTikTokShortForm = onTikTok;

    // Instagram Reels: /reels/ or /reel/ anywhere in path/href
    const isInstagramReels =
      onInstagram &&
      (path.includes("/reels") ||
        path.includes("/reel") ||
        href.includes("/reels/") ||
        href.includes("/reel/"));

    return isYouTubeShorts || isTikTokShortForm || isInstagramReels;
  }

  // --- DOM CREATION ---

  function createMeter() {
    if (document.getElementById("sfm-meter-container")) return;

    const container = document.createElement("div");
    container.id = "sfm-meter-container";

    // Header row
    const header = document.createElement("div");
    header.id = "sfm-meter-header";

    const title = document.createElement("div");
    title.id = "sfm-meter-title";
    title.textContent = "Time-Spent Meter";

    const setting = document.createElement("div");
    setting.id = "sfm-meter-setting";
    setting.textContent = formatMeterSetting();

    header.appendChild(title);
    header.appendChild(setting);

    // Progress bar
    const bar = document.createElement("div");
    bar.id = "sfm-meter-bar";

    const fill = document.createElement("div");
    fill.id = "sfm-meter-fill";
    bar.appendChild(fill);

    // Stats row
    const stats = document.createElement("div");
    stats.id = "sfm-meter-stats";

    const timeLabel = document.createElement("span");
    timeLabel.id = "sfm-meter-time-label";
    timeLabel.textContent = "Time: 0:00";

    const scrollLabel = document.createElement("span");
    scrollLabel.id = "sfm-meter-scroll-label";
    scrollLabel.textContent = "Scrolls: 0";

    stats.appendChild(timeLabel);
    stats.appendChild(scrollLabel);

    // Hint row
    const hint = document.createElement("div");
    hint.id = "sfm-meter-hint";
    hint.textContent =
      "Prototype: daily short-form time. POP-UP every 10 Shorts/Reels.";

    container.appendChild(header);
    container.appendChild(bar);
    container.appendChild(stats);
    container.appendChild(hint);

    document.documentElement.appendChild(container);
  }

  function destroyMeter() {
    const container = document.getElementById("sfm-meter-container");
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    removeFunFactPopup();
  }

  function createFunFactPopup() {
    removeFunFactPopup(); // remove existing if any

    const popup = document.createElement("div");
    popup.id = "sfm-funfact-popup";

    const text = document.createElement("div");
    text.id = "sfm-funfact-text";
    // PROTOTYPE TEXT ONLY
    text.textContent = "POP-UP: FUN FACT";

    const progress = document.createElement("div");
    progress.id = "sfm-funfact-progress";

    const progressInner = document.createElement("div");
    progressInner.id = "sfm-funfact-progress-inner";

    progress.appendChild(progressInner);
    popup.appendChild(text);
    popup.appendChild(progress);

    document.documentElement.appendChild(popup);

    // Remove after duration
    setTimeout(removeFunFactPopup, POPUP_DURATION_MS);
  }

  function removeFunFactPopup() {
    const existing = document.getElementById("sfm-funfact-popup");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  // --- UI HELPERS ---

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const paddedSecs = secs < 10 ? "0" + secs : secs.toString();
    return `${mins}:${paddedSecs}`;
  }

  function formatMeterSetting() {
    const mins = Math.round(METER_LIMIT_SECONDS / 60);
    return `${mins} min limit (fixed, per day)`;
  }

  function updateMeterUI() {
    const fill = document.getElementById("sfm-meter-fill");
    const timeLabel = document.getElementById("sfm-meter-time-label");
    const scrollLabel = document.getElementById("sfm-meter-scroll-label");

    if (!fill || !timeLabel || !scrollLabel) return;

    // Update labels
    timeLabel.textContent = `Time: ${formatTime(elapsedSeconds)}`;
    scrollLabel.textContent = `Scrolls: ${scrollCount}`;

    // Update bar based on global daily time
    const ratio = Math.min(elapsedSeconds / METER_LIMIT_SECONDS, 1);
    fill.style.width = (ratio * 100).toFixed(1) + "%";

    // Color: green -> yellow -> red
    if (ratio < 0.5) {
      fill.style.backgroundColor = "#3cd37f"; // green
    } else if (ratio < 0.85) {
      fill.style.backgroundColor = "#f2b94e"; // yellow
    } else {
      fill.style.backgroundColor = "#f25f4c"; // red
    }
  }

  // --- SCROLL / "NEXT SHORT" LOGIC (URL-based, POPUP EVERY 10) ---

  function recordScrollLikeAction() {
    if (!shortFormActive) return;

    scrollCount += 1;
    updateMeterUI();

    // Every 10 shorts/reels/tiktoks, show the prototype popup
    if (scrollCount > 0 && scrollCount % 10 === 0) {
      createFunFactPopup();
    }
  }

  // --- TIMER / DAILY TIME LOGIC ---

  function tick() {
    if (!isActive || !shortFormActive) return;

    maybeResetForNewDay();

    elapsedSeconds += 1;
    updateMeterUI();
    saveGlobalTime(); // persist shared daily time
  }

  function startTimer() {
    if (timerId !== null) return;
    timerId = setInterval(tick, 1000);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  // --- ACTIVITY & VISIBILITY ---

  document.addEventListener("visibilitychange", () => {
    isActive = !document.hidden;
  });

  // --- SHORT-FORM WATCHER ---
  // Meter shows IMMEDIATELY when you enter Shorts/Reels/TikTok,
  // disappears when you leave, keeps a shared daily timer,
  // and counts "scrolls" as URL changes while in short-form.

  function enterShortForm() {
    shortFormActive = true;
    scrollCount = 0; // reset per entry; you can make this global later if you want
    lastShortFormUrl = window.location.href;
    destroyMeter();
    createMeter();
    updateMeterUI();
    startTimer();
  }

  function leaveShortForm() {
    shortFormActive = false;
    stopTimer();
    destroyMeter();
    lastShortFormUrl = null;
  }

  function startShortFormWatcher() {
    let lastWasShortForm = isOnShortFormNow();

    if (lastWasShortForm) {
      enterShortForm(); // show meter immediately if we loaded directly into Shorts/Reels
    }

    setInterval(() => {
      const nowShortForm = isOnShortFormNow();
      const currentUrl = window.location.href;

      // If we are in short-form, watch for URL changes as "scrolls"
      if (nowShortForm) {
        if (
          lastShortFormUrl &&
          currentUrl !== lastShortFormUrl &&
          lastWasShortForm
        ) {
          // User swiped to a new short / reel / tiktok
          recordScrollLikeAction();
        }
        lastShortFormUrl = currentUrl;
      } else {
        lastShortFormUrl = null;
      }

      if (nowShortForm && !lastWasShortForm) {
        // Just entered Shorts/Reels/TikTok view
        enterShortForm();
      } else if (!nowShortForm && lastWasShortForm) {
        // Just left Shorts/Reels/TikTok view
        leaveShortForm();
      }

      lastWasShortForm = nowShortForm;
    }, SHORTFORM_CHECK_INTERVAL_MS);
  }

  // --- INIT ---

  function initAfterLoad() {
    startShortFormWatcher();
  }

  loadGlobalTimeAndInit();
})();
