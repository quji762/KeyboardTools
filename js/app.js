/* ==========================================================================
   KeyLab · 页面外壳：主题、按键音、标签页
   ========================================================================== */

(function () {
  "use strict";

  const THEME_KEY = "keylab.theme";
  const SOUND_KEY = "keylab.sound";

  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const themeLabel = themeToggle.querySelector(".theme-label");
  const soundToggle = document.getElementById("soundToggle");
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panels = {
    keys: document.getElementById("panel-keys"),
    cps: document.getElementById("panel-cps")
  };

  /* ---------------- 主题 ---------------- */

  function readTheme() {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch (err) { /* ignore */ }
    return "dark";
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeToggle.setAttribute("aria-pressed", String(theme === "light"));
    themeLabel.textContent = theme === "dark" ? "浅色" : "深色";
    themeToggle.title = theme === "dark" ? "切换到浅色主题" : "切换到深色主题";
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch (err) { /* ignore */ }
    window.dispatchEvent(new CustomEvent("keylab:themechange", { detail: { theme } }));
  }

  themeToggle.addEventListener("click", () => {
    applyTheme(root.dataset.theme === "light" ? "dark" : "light");
    themeToggle.blur();
  });

  /* ---------------- 按键音 ---------------- */

  const Sound = (function () {
    let ctx = null;
    let enabled = false;

    function ensureContext() {
      if (ctx) return ctx;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      return ctx;
    }

    function play(type) {
      if (!enabled) return;
      const audio = ensureContext();
      if (!audio) return;
      if (audio.state === "suspended") audio.resume();

      const now = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const isClick = type === "click";

      osc.type = isClick ? "square" : "triangle";
      osc.frequency.setValueAtTime(isClick ? 920 : 560, now);
      if (!isClick) osc.frequency.exponentialRampToValueAtTime(420, now + 0.035);

      gain.gain.setValueAtTime(isClick ? 0.035 : 0.028, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (isClick ? 0.045 : 0.06));

      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    function setEnabled(value, silent) {
      enabled = Boolean(value);
      soundToggle.setAttribute("aria-pressed", String(enabled));
      soundToggle.title = enabled ? "关闭按键音" : "开启按键音";
      try {
        window.localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
      } catch (err) { /* ignore */ }
      if (enabled && !silent) {
        ensureContext();
        play("click");
      }
    }

    return {
      play: play,
      setEnabled: setEnabled,
      isEnabled: function () { return enabled; }
    };
  })();

  window.KeyLabSound = Sound;

  try {
    Sound.setEnabled(window.localStorage.getItem(SOUND_KEY) === "on", true);
  } catch (err) {
    Sound.setEnabled(false, true);
  }

  soundToggle.addEventListener("click", () => {
    Sound.setEnabled(!Sound.isEnabled());
    soundToggle.blur();
  });

  /* ---------------- 标签页 ---------------- */

  function setTab(name) {
    if (!panels[name]) name = "keys";
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    Object.keys(panels).forEach((key) => {
      panels[key].hidden = key !== name;
    });
    try {
      window.history.replaceState(null, "", "#" + name);
    } catch (err) { /* ignore */ }
    window.dispatchEvent(new CustomEvent("keylab:tabchange", { detail: { tab: name } }));
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setTab(tab.dataset.tab);
      tab.blur();
    });
  });

  const initialTab = window.location.hash.replace("#", "") === "cps" ? "cps" : "keys";
  applyTheme(readTheme());
  setTab(initialTab);

  window.addEventListener("hashchange", () => {
    setTab(window.location.hash.replace("#", "") === "cps" ? "cps" : "keys");
  });
})();