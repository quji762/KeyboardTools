/* ==========================================================================
   KeyboardTools · 键位连点故障检测（Chatter）
   检测一次按压产生多次触发的按键抖动问题：
   1. 同一按键松开后，在阈值时间内再次按下（回弹）；
   2. 按键尚未松开时，又收到非 repeat 的按下事件（重复触发）。
   系统长按产生的 event.repeat 不计入，避免误报。
   ========================================================================== */

(function () {
  "use strict";

  const THRESHOLD_KEY = "keyboardtools.chatter.threshold";
  const THRESHOLDS = [20, 30, 50];
  const DEFAULT_HINT = "敲击任意按键开始监测；长按产生的系统重复不会误报。";
  const PAUSED_HINT = "检测已暂停，点击“继续检测”后恢复监听。";
  const TYPE_TEXT = {
    bounce: "松开后回弹",
    "down-again": "未松开重复触发"
  };

  const el = {
    panel: document.getElementById("panel-chatter"),
    thresholdSeg: document.getElementById("thresholdSeg"),
    monitorStatus: document.getElementById("monitorStatus"),
    monitorHint: document.getElementById("monitorHint"),
    toggle: document.getElementById("toggleMonitor"),
    reset: document.getElementById("resetChatter"),
    keys: document.getElementById("chatterKeys"),
    total: document.getElementById("chatterTotal"),
    coverage: document.getElementById("chatterCoverage"),
    count: document.getElementById("chatterCount"),
    badKeys: document.getElementById("chatterBadKeys"),
    minGap: document.getElementById("chatterMinGap"),
    thresholdHint: document.getElementById("chatterThresholdHint"),
    currentKeyCap: document.getElementById("currentKeyCap"),
    currentKeyName: document.getElementById("currentKeyName"),
    currentKeyState: document.getElementById("currentKeyState"),
    currentGap: document.getElementById("currentGap"),
    currentKeyIssues: document.getElementById("currentKeyIssues"),
    sessionIssues: document.getElementById("sessionIssues"),
    faultKeys: document.getElementById("faultKeyList"),
    faultEvents: document.getElementById("faultEventList")
  };

  if (!el.panel) return;

  /* 布局键位元数据（104 键），未知按键不参与故障判定 */
  const keyMeta = new Map();
  document.querySelectorAll(".key").forEach((node) => {
    const code = node.dataset.code;
    const label = node.querySelector(".k-label");
    if (code) keyMeta.set(code, { code, label: label ? label.textContent : code });
  });
  const totalKeys = keyMeta.size;

  let threshold = loadThreshold();
  let monitoring = true;
  let records = new Map();
  let events = [];
  let totalIssues = 0;
  let minGap = null;
  let currentCode = null;
  let hintTimer = 0;
  let faultTimer = 0;

  /* ---------------- 设置读取 ---------------- */

  function loadThreshold() {
    try {
      const saved = Number(window.localStorage.getItem(THRESHOLD_KEY));
      if (THRESHOLDS.includes(saved)) return saved;
    } catch (err) { /* ignore */ }
    return 30;
  }

  function saveThreshold() {
    try {
      window.localStorage.setItem(THRESHOLD_KEY, String(threshold));
    } catch (err) { /* ignore */ }
  }

  /* ---------------- 统计与界面 ---------------- */

  function percent(value, total) {
    return total ? Math.round((value / total) * 100) + "%" : "0%";
  }

  function refreshStats() {
    el.keys.textContent = String(records.size);
    el.total.textContent = String(totalKeys);
    el.coverage.textContent = percent(records.size, totalKeys);
    el.count.textContent = String(totalIssues);
    el.sessionIssues.textContent = String(totalIssues);
    el.badKeys.textContent = String(Array.from(records.values()).filter((rec) => rec.issues > 0).length);
    el.minGap.textContent = minGap === null ? "—" : String(Math.round(minGap));
    el.thresholdHint.textContent = "判定阈值 " + threshold + " ms";
  }

  function setHint(text) {
    window.clearTimeout(hintTimer);
    el.monitorHint.textContent = text;
  }

  function flashHint(text) {
    setHint(text);
    hintTimer = window.setTimeout(() => {
      setHint(monitoring ? DEFAULT_HINT : PAUSED_HINT);
    }, 1600);
  }

  function pulseFault() {
    el.currentKeyCap.classList.add("is-fault");
    el.currentGap.classList.add("is-fault");
    window.clearTimeout(faultTimer);
    faultTimer = window.setTimeout(() => {
      el.currentKeyCap.classList.remove("is-fault");
      el.currentGap.classList.remove("is-fault");
    }, 700);
  }

  function showCurrent(rec, state, gap, keepGap) {
    currentCode = rec.code;
    el.currentKeyCap.textContent = rec.label;
    el.currentKeyName.textContent = rec.code;
    el.currentKeyState.textContent = state;
    el.currentKeyState.classList.toggle("is-down", state === "按下");
    el.currentKeyCap.classList.toggle("is-down", state === "按下");
    if (gap !== null && gap !== undefined) {
      el.currentGap.textContent = String(Math.max(0, Math.round(gap)));
    } else if (!keepGap) {
      el.currentGap.textContent = "—";
    }
    el.currentKeyIssues.textContent = String(rec.issues);
  }

  function resetCurrentDisplay() {
    currentCode = null;
    el.currentKeyCap.textContent = "—";
    el.currentKeyCap.classList.remove("is-down", "is-fault");
    el.currentKeyName.textContent = "等待按键";
    el.currentKeyState.textContent = "空闲";
    el.currentKeyState.classList.remove("is-down");
    el.currentGap.textContent = "—";
    el.currentGap.classList.remove("is-fault");
    el.currentKeyIssues.textContent = "0";
  }

  /* ---------------- 故障记录 ---------------- */

  function registerIssue(rec, now, gap, type) {
    const gapMs = Math.max(0, Math.round(gap));
    rec.issues += 1;
    rec.minGap = Math.min(rec.minGap, gapMs);
    rec.lastIssueAt = Date.now();
    totalIssues += 1;
    minGap = minGap === null ? gapMs : Math.min(minGap, gapMs);

    events.unshift({
      code: rec.code,
      label: rec.label,
      gap: gapMs,
      type: type,
      time: formatTime(new Date(rec.lastIssueAt))
    });
    if (events.length > 12) events.pop();

    pulseFault();
    refreshStats();
    renderFaultKeys();
    renderEvents();
    flashHint("检测到 " + rec.label + " 连点故障：" + gapMs + " ms");
    window.KeyboardToolsSound && window.KeyboardToolsSound.play("key");
  }

  function formatTime(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" +
      pad(date.getSeconds()) + "." + pad(date.getMilliseconds(), 3);
  }

  function renderFaultKeys() {
    const faulty = Array.from(records.values())
      .filter((rec) => rec.issues > 0)
      .sort((a, b) => b.issues - a.issues || a.minGap - b.minGap);

    if (!faulty.length) {
      el.faultKeys.innerHTML = '<li class="empty">尚未发现异常，继续正常敲击即可。</li>';
      return;
    }

    const frag = document.createDocumentFragment();
    faulty.forEach((rec) => {
      const li = document.createElement("li");
      li.className = "fault-item";

      const cap = document.createElement("span");
      cap.className = "fault-keycap";
      cap.textContent = rec.label;
      cap.title = rec.code;

      const info = document.createElement("div");
      info.className = "fault-info";
      const name = document.createElement("strong");
      name.textContent = rec.code;
      const detail = document.createElement("span");
      detail.textContent = "最短间隔 " + Math.round(rec.minGap) + " ms · 最后 " +
        formatTime(new Date(rec.lastIssueAt));
      info.append(name, detail);

      const count = document.createElement("span");
      count.className = "fault-count";
      count.textContent = String(rec.issues);
      const unit = document.createElement("small");
      unit.textContent = "次";
      count.appendChild(unit);

      li.append(cap, info, count);
      frag.appendChild(li);
    });
    el.faultKeys.replaceChildren(frag);
  }

  function renderEvents() {
    if (!events.length) {
      el.faultEvents.innerHTML = '<li class="empty">还没有异常记录。</li>';
      return;
    }

    const frag = document.createDocumentFragment();
    events.forEach((item) => {
      const li = document.createElement("li");
      li.className = "fault-event";

      const key = document.createElement("span");
      key.className = "event-key";
      key.textContent = item.label;

      const detail = document.createElement("div");
      detail.className = "event-detail";
      const type = document.createElement("strong");
      type.textContent = TYPE_TEXT[item.type] || "重复触发";
      const meta = document.createElement("span");
      meta.textContent = item.code + " · " + item.time;
      detail.append(type, meta);

      const gap = document.createElement("span");
      gap.className = "event-gap";
      gap.textContent = item.gap + " ms";

      li.append(key, detail, gap);
      frag.appendChild(li);
    });
    el.faultEvents.replaceChildren(frag);
  }

  /* ---------------- 按键状态 ---------------- */

  function clearPressedStates() {
    records.forEach((rec) => {
      rec.down = false;
      rec.lastUp = 0;
      rec.lastDown = 0;
    });
    if (currentCode) {
      el.currentKeyState.textContent = "已释放";
      el.currentKeyState.classList.remove("is-down");
      el.currentKeyCap.classList.remove("is-down");
    }
  }

  function onKeyDown(event) {
    if (el.panel.hidden || !monitoring) return;

    const code = event.code;
    if (!code || !keyMeta.has(code)) return;
    if (code === "F11" || code === "F12") return;

    /* 阻止页面滚动、按钮激活与快捷键，保证检测区域只接收按键输入 */
    event.preventDefault();

    if (event.repeat) return;

    const now = performance.now();
    let rec = records.get(code);
    if (!rec) {
      rec = {
        code: code,
        label: keyMeta.get(code).label,
        down: false,
        lastDown: 0,
        lastUp: 0,
        issues: 0,
        minGap: Infinity,
        lastIssueAt: 0
      };
      records.set(code, rec);
    }

    if (rec.down) {
      registerIssue(rec, now, now - rec.lastDown, "down-again");
    } else if (rec.lastUp && now - rec.lastUp <= threshold) {
      registerIssue(rec, now, now - rec.lastUp, "bounce");
    }

    const gap = rec.lastUp ? now - rec.lastUp : null;
    rec.down = true;
    rec.lastDown = now;

    showCurrent(rec, "按下", gap);
    refreshStats();
  }

  function onKeyUp(event) {
    const code = event.code;
    const rec = records.get(code);
    if (!rec) return;

    const now = performance.now();
    rec.down = false;
    rec.lastUp = now;

    if (currentCode === code) {
      showCurrent(rec, "已释放", null, true);
    }
  }

  /* ---------------- 控制 ---------------- */

  function resetRecords() {
    window.clearTimeout(faultTimer);
    records = new Map();
    events = [];
    totalIssues = 0;
    minGap = null;
    resetCurrentDisplay();
    renderFaultKeys();
    renderEvents();
    refreshStats();
    setHint(monitoring ? DEFAULT_HINT : PAUSED_HINT);
  }

  function setMonitoring(value) {
    monitoring = Boolean(value);
    clearPressedStates();
    el.toggle.textContent = monitoring ? "暂停检测" : "继续检测";
    el.monitorStatus.classList.toggle("is-paused", !monitoring);
    el.monitorStatus.innerHTML = '<i aria-hidden="true"></i>' + (monitoring ? "监听中" : "已暂停");
    setHint(monitoring ? DEFAULT_HINT : PAUSED_HINT);
  }

  function applyThreshold(value) {
    if (!THRESHOLDS.includes(value)) return;
    threshold = value;
    saveThreshold();
    Array.from(el.thresholdSeg.querySelectorAll(".seg-btn")).forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.threshold) === threshold);
    });
    resetRecords();
    flashHint("判定阈值已调整为 " + threshold + " ms，记录已清空");
  }

  /* ---------------- 事件绑定 ---------------- */

  el.thresholdSeg.addEventListener("click", (event) => {
    const btn = event.target.closest(".seg-btn");
    if (!btn) return;
    applyThreshold(Number(btn.dataset.threshold));
    btn.blur();
  });

  el.toggle.addEventListener("click", () => {
    setMonitoring(!monitoring);
    el.toggle.blur();
  });

  el.reset.addEventListener("click", () => {
    resetRecords();
    flashHint("检测记录已清空");
    el.reset.blur();
  });

  document.addEventListener("keydown", onKeyDown, { passive: false });
  document.addEventListener("keyup", onKeyUp);

  window.addEventListener("blur", clearPressedStates);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearPressedStates();
  });

  window.addEventListener("keyboardtools:tabchange", (event) => {
    if (!event.detail || event.detail.tab !== "chatter") clearPressedStates();
  });

  /* ---------------- 初始化 ---------------- */

  try {
  } catch (err) { /* ignore */ }

  el.total.textContent = String(totalKeys);
  Array.from(el.thresholdSeg.querySelectorAll(".seg-btn")).forEach((btn) => {
    btn.classList.toggle("is-active", Number(btn.dataset.threshold) === threshold);
  });
  el.thresholdHint.textContent = "判定阈值 " + threshold + " ms";
  renderFaultKeys();
  renderEvents();
  refreshStats();
  setMonitoring(true);
})();