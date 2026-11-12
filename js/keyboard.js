/* ==========================================================================
   KeyLab · 键位检测
   ========================================================================== */

(function () {
  "use strict";

  const layout = window.KB_LAYOUT;
  if (!layout) return;

  const keyboardEl = document.getElementById("keyboard");
  const keysPanel = document.getElementById("panel-keys");
  const keyIndex = new Map();

  const tested = new Set();
  const pressed = new Set();
  const history = [];
  let pressCount = 0;
  let peakPressed = 0;
  let totalKeys = 0;

  const el = {
    tested: document.getElementById("statTested"),
    total: document.getElementById("statTotal"),
    pressed: document.getElementById("statPressed"),
    peak: document.getElementById("statPeak"),
    presses: document.getElementById("statPresses"),
    last: document.getElementById("statLast"),
    lastTime: document.getElementById("statLastTime"),
    coverageBar: document.getElementById("coverageBar"),
    coverageText: document.getElementById("coverageText"),
    display: document.getElementById("keyDisplay"),
    displayLabel: document.getElementById("detailLabel"),
    displaySub: document.getElementById("detailSub"),
    key: document.getElementById("detailKey"),
    code: document.getElementById("detailCode"),
    keyCode: document.getElementById("detailKeyCode"),
    location: document.getElementById("detailLocation"),
    repeat: document.getElementById("detailRepeat"),
    time: document.getElementById("detailTime"),
    log: document.getElementById("keyLog"),
    reset: document.getElementById("resetKeys")
  };

  function makeKey(item) {
    const node = document.createElement("div");
    node.className = "key";
    if (item.label.length > 3) node.classList.add("is-wide-label");
    if (item.h > 1) node.classList.add("is-tall");
    node.dataset.code = item.code;

    const label = document.createElement("span");
    label.className = "k-label";
    label.textContent = item.label;

    const sub = document.createElement("span");
    sub.className = "k-sub";
    sub.textContent = item.sub || "";

    node.append(label, sub);
    keyIndex.set(item.code, node);
    return node;
  }

  function buildKeyboard() {
    const fn = document.createElement("div");
    fn.className = "kb-fn";

    layout.fn.groups.forEach((group, index) => {
      const wrap = document.createElement("div");
      wrap.className = "fn-group" + (index > 0 ? " spacer" : "");
      group.forEach((item) => wrap.appendChild(makeKey(item)));
      fn.appendChild(wrap);
    });

    const tail = document.createElement("div");
    tail.className = "fn-tail";
    layout.fn.tail.forEach((item) => tail.appendChild(makeKey(item)));
    fn.appendChild(tail);

    const body = document.createElement("div");
    body.className = "kb-body";

    const main = document.createElement("div");
    main.className = "kb-main";
    layout.main.forEach((row, rowIndex) => {
      let col = 0;
      row.forEach((item) => {
        const node = makeKey(item);
        const span = Math.round(item.w * 4);
        node.style.gridRow = String(rowIndex + 1);
        node.style.gridColumn = (col + 1) + " / span " + span;
        col += span;
        main.appendChild(node);
      });
    });

    const nav = document.createElement("div");
    nav.className = "kb-nav";
    layout.nav.forEach((item) => {
      const node = makeKey(item);
      node.style.gridRow = String(item.row);
      node.style.gridColumn = ((item.col - 1) * 4 + 1) + " / span 4";
      nav.appendChild(node);
    });

    const numpad = document.createElement("div");
    numpad.className = "kb-numpad";
    layout.numpad.forEach((item) => {
      const node = makeKey(item);
      node.style.gridRow = item.row + " / span " + (item.h || 1);
      node.style.gridColumn = ((item.col - 1) * 4 + 1) + " / span " + (item.w || 1) * 4;
      numpad.appendChild(node);
    });

    body.append(main, nav, numpad);
    keyboardEl.append(fn, body);

    totalKeys = keyIndex.size;
    el.total.textContent = String(totalKeys);
    refreshStats();
  }

  function refreshStats() {
    el.tested.textContent = String(tested.size);
    el.pressed.textContent = String(pressed.size);
    el.peak.textContent = String(peakPressed);
    el.presses.textContent = String(pressCount);
    const pct = totalKeys ? (tested.size / totalKeys) * 100 : 0;
    el.coverageBar.style.width = pct.toFixed(1) + "%";
    el.coverageText.textContent = "覆盖率 " + pct.toFixed(pct >= 10 ? 0 : 1) + "%";
  }

  function formatTime(date) {
    const pad = (n, len) => String(n).padStart(len || 2, "0");
    return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" +
      pad(date.getSeconds()) + "." + pad(date.getMilliseconds(), 3);
  }

  function displayKeyName(event, node) {
    if (node) return node.querySelector(".k-label").textContent;
    if (event.key === " ") return "Space";
    if (event.key === "Unidentified") return "?";
    if (event.key && event.key.length <= 3) return event.key;
    const code = event.code || "";
    return code.replace(/^(Key|Digit|Numpad)/, "") || "Unknown";
  }

  function locationText(value) {
    switch (value) {
      case 0: return "标准键位";
      case 1: return "左侧修饰键";
      case 2: return "右侧修饰键";
      case 3: return "数字小键盘";
      default: return "未知";
    }
  }

  function renderLog() {
    if (!history.length) {
      el.log.innerHTML = '<li class="empty">还没有按键记录，按下一个键开始检测。</li>';
      return;
    }
    const frag = document.createDocumentFragment();
    history.slice(0, 12).forEach((entry, index) => {
      const li = document.createElement("li");

      const num = document.createElement("span");
      num.className = "log-index";
      num.textContent = String(index + 1).padStart(2, "0");

      const label = document.createElement("span");
      label.className = "log-label";
      label.textContent = entry.label;

      const code = document.createElement("span");
      code.className = "log-code";
      code.textContent = entry.code + " · " + entry.time;

      li.append(num, label, code);
      frag.appendChild(li);
    });
    el.log.replaceChildren(frag);
  }

  function updateDetail(event, node) {
    const label = displayKeyName(event, node);
    el.displayLabel.textContent = label;
    el.displaySub.textContent = node ? event.code : (event.key || "未知键值");
    el.display.classList.add("is-live");
    el.key.textContent = event.key === " " ? "Space（空格）" : String(event.key);
    el.code.textContent = event.code || "—";
    el.keyCode.textContent = String(event.keyCode);
    el.location.textContent = locationText(event.location);
    el.repeat.textContent = event.repeat ? "是（长按重复）" : "否";
    el.time.textContent = formatTime(new Date());
    el.last.textContent = event.code || event.key;
    el.lastTime.textContent = "最近触发于 " + formatTime(new Date());
  }

  function setActive(code, active) {
    const node = keyIndex.get(code);
    if (!node) return;
    node.classList.toggle("active", active);
    if (!active) {
      node.classList.remove("flash");
      // 强制重排以重启动画
      void node.offsetWidth;
      node.classList.add("flash");
      window.setTimeout(() => node.classList.remove("flash"), 300);
    }
  }

  function onKeyDown(event) {
    if (keysPanel.hidden) return;

    const code = event.code || "Unidentified";
    const node = keyIndex.get(code);

    if (!event.repeat) {
      pressed.add(code);
      peakPressed = Math.max(peakPressed, pressed.size);
      pressCount += 1;

      if (!tested.has(code)) {
        tested.add(code);
        node && node.classList.add("tested");
      }

      history.unshift({
        label: displayKeyName(event, node),
        code: code,
        time: formatTime(new Date())
      });
      if (history.length > 12) history.pop();
      renderLog();

      window.KeyLabSound && window.KeyLabSound.play("key");
    } else {
      pressCount += 1;
    }

    if (node) {
      node.classList.add("active");
      if (tested.has(code)) node.classList.add("tested");
    }

    updateDetail(event, node);
    refreshStats();

    const allowDefault = event.ctrlKey || event.metaKey ||
      ["F5", "F11", "F12"].includes(code);
    if (!allowDefault) event.preventDefault();
  }

  function onKeyUp(event) {
    const code = event.code || "Unidentified";
    pressed.delete(code);
    setActive(code, false);
    refreshStats();
  }

  function clearPressed() {
    pressed.forEach((code) => {
      const node = keyIndex.get(code);
      node && node.classList.remove("active");
    });
    pressed.clear();
    el.pressed.textContent = "0";
  }

  function resetAll() {
    tested.clear();
    history.length = 0;
    pressCount = 0;
    peakPressed = 0;
    clearPressed();
    keyIndex.forEach((node) => {
      node.classList.remove("tested", "active", "flash", "unknown");
    });
    el.display.classList.remove("is-live");
    el.displayLabel.classList.remove("is-unknown");
    el.displayLabel.textContent = "—";
    el.displaySub.textContent = "等待按键";
    el.key.textContent = "—";
    el.code.textContent = "—";
    el.keyCode.textContent = "—";
    el.location.textContent = "—";
    el.repeat.textContent = "—";
    el.time.textContent = "—";
    el.last.textContent = "—";
    el.lastTime.textContent = "等待输入";
    renderLog();
    refreshStats();
  }

  document.addEventListener("keydown", onKeyDown, { passive: false });
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearPressed);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearPressed();
  });
  el.reset.addEventListener("click", resetAll);

  buildKeyboard();
})();