/* ==========================================================================
   KeyLab · 连点检测（CPS）
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "keylab.cps.history.v1";
  const MAX_HISTORY = 6;

  const el = {
    pad: document.getElementById("clickPad"),
    count: document.getElementById("clickCount"),
    hint: document.getElementById("padHint"),
    overlay: document.getElementById("padOverlay"),
    overlayEyebrow: document.querySelector("#padOverlay .overlay-eyebrow"),
    overlayCps: document.getElementById("overlayCps"),
    overlayClicks: document.getElementById("overlayClicks"),
    retry: document.getElementById("retryBtn"),
    avgCps: document.getElementById("statAvgCps"),
    clicks: document.getElementById("statClicks"),
    fastest: document.getElementById("statFastest"),
    slowest: document.getElementById("statSlowest"),
    peakWindow: document.getElementById("statPeakWindow"),
    cpsHint: document.getElementById("statCpsHint"),
    durationHint: document.getElementById("statDurationHint"),
    liveCps: document.getElementById("liveCps"),
    timeLeft: document.getElementById("timeLeft"),
    timerBar: document.getElementById("padTimerBar"),
    seg: document.getElementById("durationSeg"),
    chart: document.getElementById("cpsChart"),
    chartEmpty: document.getElementById("chartEmpty"),
    bestBadge: document.getElementById("bestBadge"),
    bestCps: document.getElementById("bestCps"),
    scoreList: document.getElementById("scoreList"),
    clear: document.getElementById("clearCpsHistory")
  };

  if (!el.pad) return;

  let duration = 5;
  let running = false;
  let finished = false;
  let clicks = [];
  let startTime = 0;
  let rafId = 0;
  let buckets = null;
  let history = loadHistory();
  let resizeTimer = 0;

  /* ---------------- 本地存储 ---------------- */

  function loadHistory() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && Number.isFinite(item.cps))
        .map((item) => ({
          cps: item.cps,
          clicks: Number.isFinite(item.clicks) ? item.clicks : 0,
          duration: Number.isFinite(item.duration) ? item.duration : 5,
          time: typeof item.time === "string" ? item.time : ""
        }))
        .slice(0, MAX_HISTORY);
    } catch (err) {
      return [];
    }
  }

  function saveHistory() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
    } catch (err) {
      /* file:// 或隐私模式下可能不可用，忽略即可 */
    }
  }

  /* ---------------- 统计 ---------------- */

  function computeIntervals() {
    const gaps = [];
    for (let i = 1; i < clicks.length; i += 1) {
      gaps.push(clicks[i] - clicks[i - 1]);
    }
    return gaps;
  }

  function peakInWindow() {
    if (!clicks.length) return 0;
    let peak = 0;
    for (let i = 0; i < clicks.length; i += 1) {
      let j = i;
      while (j < clicks.length && clicks[j] - clicks[i] < 1000) j += 1;
      peak = Math.max(peak, j - i);
    }
    return peak;
  }

  function countLastSecond(now) {
    let count = 0;
    for (let i = clicks.length - 1; i >= 0; i -= 1) {
      if (now - clicks[i] <= 1000) count += 1;
      else break;
    }
    return count;
  }

  /* ---------------- 界面状态 ---------------- */

  function updateDurationLabel() {
    el.durationHint.textContent = "本轮时长 " + duration + " 秒";
    if (!running && !finished) {
      el.timeLeft.textContent = duration.toFixed(1);
      el.timerBar.style.width = "100%";
    }
  }

  function resetToIdle() {
    running = false;
    finished = false;
    clicks = [];
    buckets = null;
    window.cancelAnimationFrame(rafId);
    el.pad.classList.remove("is-running", "is-clicking");
    el.overlay.hidden = true;
    el.hint.textContent = "点击此处开始";
    el.hint.style.opacity = "1";
    el.count.textContent = "0";
    el.liveCps.textContent = "0.0";
    el.avgCps.textContent = "0.0";
    el.clicks.textContent = "0";
    el.fastest.textContent = "—";
    el.slowest.textContent = "—";
    el.peakWindow.textContent = "最高瞬时 0 次/秒";
    el.cpsHint.textContent = "完成一轮后统计";
    el.chartEmpty.hidden = false;
    el.chartEmpty.textContent = "完成一轮测试后生成图表。";
    updateDurationLabel();
    drawChart();
  }

  function startRun() {
    running = true;
    finished = false;
    clicks = [];
    buckets = null;
    startTime = performance.now();
    el.pad.classList.add("is-running");
    el.pad.classList.remove("is-clicking");
    el.hint.textContent = "尽可能快地点击";
    el.overlay.hidden = true;
    el.chartEmpty.hidden = true;
    el.avgCps.textContent = "0.0";
    el.clicks.textContent = "0";
    el.fastest.textContent = "—";
    el.slowest.textContent = "—";
    el.peakWindow.textContent = "最高瞬时 0 次/秒";
    el.cpsHint.textContent = "计时中…";
    el.liveCps.textContent = "0.0";
    el.timeLeft.textContent = duration.toFixed(1);
    el.timerBar.style.width = "100%";

    window.cancelAnimationFrame(rafId);
    rafId = window.requestAnimationFrame(tick);
  }

  function tick() {
    if (!running) return;
    const now = performance.now();
    const elapsed = now - startTime;
    const total = duration * 1000;
    const left = Math.max(0, total - elapsed);

    el.timeLeft.textContent = (left / 1000).toFixed(1);
    el.timerBar.style.width = Math.max(0, (left / total) * 100).toFixed(2) + "%";
    el.liveCps.textContent = countLastSecond(now).toFixed(1);

    if (elapsed >= total) {
      finishRun(now);
      return;
    }
    rafId = window.requestAnimationFrame(tick);
  }

  function finishRun(endTime) {
    running = false;
    finished = true;
    window.cancelAnimationFrame(rafId);

    const total = duration * 1000;
    const count = clicks.length;
    const avg = count / duration;
    const gaps = computeIntervals();
    const fastest = gaps.length ? Math.min.apply(null, gaps) : null;
    const slowest = gaps.length ? Math.max.apply(null, gaps) : null;
    const peak = peakInWindow();

    /* 分桶：每秒点击数 */
    buckets = new Array(duration).fill(0);
    clicks.forEach((ts) => {
      const idx = Math.min(duration - 1, Math.max(0, Math.floor((ts - startTime) / 1000)));
      buckets[idx] += 1;
    });

    el.count.textContent = String(count);
    el.avgCps.textContent = avg.toFixed(1);
    el.clicks.textContent = String(count);
    el.fastest.textContent = fastest === null ? "—" : Math.round(fastest).toString();
    el.slowest.textContent = slowest === null ? "—" : Math.round(slowest).toString();
    el.peakWindow.textContent = "最高瞬时 " + peak + " 次/秒";
    el.cpsHint.textContent = "共 " + count + " 次 / " + duration + " 秒";
    el.timeLeft.textContent = "0.0";
    el.timerBar.style.width = "0%";
    el.liveCps.textContent = countLastSecond(endTime).toFixed(1);
    el.pad.classList.remove("is-running");
    el.hint.style.opacity = "0";

    const previousBest = history.reduce((max, item) => Math.max(max, item.cps), 0);
    const isRecord = count > 0 && avg > previousBest;
    el.overlayEyebrow.textContent = isRecord ? "新纪录" : "本轮完成";
    el.overlayCps.textContent = avg.toFixed(1);
    el.overlayClicks.textContent = count + " 次点击 · " + duration + " 秒";
    el.overlayClicks.classList.toggle("new-record", isRecord);
    el.overlay.hidden = false;

    if (count > 0) {
      history.unshift({
        cps: Math.round(avg * 10) / 10,
        clicks: count,
        duration: duration,
        time: formatClock(new Date())
      });
      history = history.slice(0, MAX_HISTORY);
      saveHistory();
      renderHistory();
    }

    el.chartEmpty.hidden = count > 0;
    if (!count) el.chartEmpty.textContent = "本轮没有检测到点击。";
    drawChart();
  }

  function registerClick(x, y) {
    if (!running) return;
    const now = performance.now();
    if (now - startTime >= duration * 1000) {
      finishRun(now);
      return;
    }
    clicks.push(now);
    el.count.textContent = String(clicks.length);
    el.clicks.textContent = String(clicks.length);

    el.pad.classList.add("is-clicking");
    window.setTimeout(() => el.pad.classList.remove("is-clicking"), 90);

    spawnRipple(x, y);
    window.KeyLabSound && window.KeyLabSound.play("click");
  }

  function spawnRipple(x, y) {
    const rect = el.pad.getBoundingClientRect();
    const size = 140;
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.width = size + "px";
    ripple.style.height = size + "px";
    ripple.style.left = (x - rect.left) + "px";
    ripple.style.top = (y - rect.top) + "px";
    el.pad.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    window.setTimeout(() => ripple.remove(), 700);
  }

  /* ---------------- 成绩列表 ---------------- */

  function formatClock(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " +
      pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function renderHistory() {
    const best = history.reduce((max, item) => Math.max(max, item.cps), 0);
    el.bestBadge.hidden = history.length === 0;
    el.bestCps.textContent = best.toFixed(1);

    if (!history.length) {
      el.scoreList.innerHTML = '<li class="empty">还没有成绩记录。</li>';
      return;
    }

    const frag = document.createDocumentFragment();
    history.forEach((item, index) => {
      const li = document.createElement("li");
      if (item.cps === best) li.classList.add("is-best");

      const rank = document.createElement("span");
      rank.className = "rank";
      rank.textContent = String(index + 1).padStart(2, "0");

      const main = document.createElement("div");
      main.className = "score-main";
      const value = document.createElement("b");
      value.textContent = item.cps.toFixed(1);
      const unit = document.createElement("span");
      unit.textContent = "CPS";
      main.append(value, unit);

      const meta = document.createElement("span");
      meta.className = "score-meta";
      meta.textContent = item.clicks + " 次 · " + item.duration + "s";
      if (item.time) meta.textContent += " · " + item.time;

      li.append(rank, main, meta);
      frag.appendChild(li);
    });
    el.scoreList.replaceChildren(frag);
  }

  /* ---------------- 图表 ---------------- */

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name);
    return value && value.trim() ? value.trim() : fallback;
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    const radius = Math.min(r, w / 2, h);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawChart() {
    const canvas = el.chart;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(240, Math.floor(rect.width || 520));
    const height = 208;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const accent = cssVar("--accent", "#2dd4bf");
    const textColor = cssVar("--muted", "#8496ad");
    const gridColor = cssVar("--border", "rgba(148,163,184,.15)");
    const font = '10px "JetBrains Mono", Consolas, monospace';

    const padL = 10;
    const padR = 10;
    const padT = 22;
    const padB = 24;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    /* 横向网格 */
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(width - padR, y);
      ctx.stroke();
    }

    if (!buckets || !buckets.length) {
      ctx.fillStyle = textColor;
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.fillText("等待测试数据", width / 2, height / 2);
      return;
    }

    const n = buckets.length;
    const maxValue = Math.max(1, Math.max.apply(null, buckets));
    const gap = n > 12 ? 4 : 8;
    const barW = Math.min(72, Math.max(6, (innerW - gap * (n - 1)) / n));
    const groupW = barW * n + gap * (n - 1);
    const offsetX = padL + Math.max(0, (innerW - groupW) / 2);
    const avg = buckets.reduce((sum, v) => sum + v, 0) / n;

    buckets.forEach((value, index) => {
      const h = value === 0 ? 2 : Math.max(3, (value / maxValue) * innerH);
      const x = offsetX + index * (barW + gap);
      const y = padT + innerH - h;

      const gradient = ctx.createLinearGradient(0, y, 0, padT + innerH);
      gradient.addColorStop(0, accent);
      gradient.addColorStop(1, "rgba(56,189,248,0.35)");

      ctx.fillStyle = value === 0 ? gridColor : gradient;
      roundRect(ctx, x, y, barW, h, Math.min(5, barW / 2));
      ctx.fill();

      if (barW >= 18) {
        ctx.fillStyle = textColor;
        ctx.font = font;
        ctx.textAlign = "center";
        ctx.fillText(String(value), x + barW / 2, y - 6);
      }

      ctx.fillStyle = textColor;
      ctx.font = '9px "JetBrains Mono", Consolas, monospace';
      ctx.textAlign = "center";
      ctx.fillText(index + 1 + "s", x + barW / 2, padT + innerH + 15);
    });

    /* 平均线 */
    const avgY = padT + innerH - (avg / maxValue) * innerH;
    const avgColor = cssVar("--accent-2", "#38bdf8");
    ctx.save();
    ctx.strokeStyle = avgColor;
    ctx.setLineDash([5, 5]);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(padL, avgY);
    ctx.lineTo(width - padR, avgY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = textColor;
    ctx.font = font;
    ctx.textAlign = "left";
    ctx.fillText("avg " + avg.toFixed(1), padL + 2, Math.max(10, avgY - 5));
  }

  /* ---------------- 事件绑定 ---------------- */

  el.pad.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    if (!el.overlay.hidden || finished) return;
    event.preventDefault();
    if (!running) startRun();
    registerClick(event.clientX, event.clientY);
  });

  el.pad.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (event.repeat) return;
    if (!el.overlay.hidden || finished) return;
    event.preventDefault();
    if (!running) startRun();
    const rect = el.pad.getBoundingClientRect();
    registerClick(rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  el.retry.addEventListener("click", (event) => {
    event.stopPropagation();
    resetToIdle();
    el.pad.focus();
  });

  el.seg.addEventListener("click", (event) => {
    const btn = event.target.closest(".seg-btn");
    if (!btn || running) return;
    const value = Number(btn.dataset.duration);
    if (!value || value === duration) return;
    duration = value;
    Array.from(el.seg.querySelectorAll(".seg-btn")).forEach((item) => {
      item.classList.toggle("is-active", item === btn);
    });
    resetToIdle();
    btn.blur();
  });

  el.clear.addEventListener("click", () => {
    history = [];
    saveHistory();
    renderHistory();
    el.clear.blur();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && running) {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(tick);
    }
  });

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(drawChart, 160);
  });

  window.addEventListener("keylab:themechange", drawChart);

  window.addEventListener("keylab:tabchange", (event) => {
    if (event.detail && event.detail.tab === "cps") {
      window.setTimeout(drawChart, 30);
    }
  });

  el.pad.addEventListener("contextmenu", (event) => event.preventDefault());

  updateDurationLabel();
  renderHistory();
  drawChart();
})();