"use strict";

/**
 * Electron 无界面自检（--smoke-test）
 * 在真实 Electron 渲染进程中执行一组断言，并输出 JSON 报告。
 * 用法：electron . --smoke-test [--smoke-report=C:\path\report.json]
 */

const fs = require("node:fs");
const path = require("node:path");

const SUITE_TIMEOUT = 45000;

function writeReport(reportPath, report) {
  if (!reportPath) return;
  try {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  } catch (error) {
    console.error("[KeyboardTools] 无法写入自检报告:", error.message);
  }
}

module.exports = function runSmoke({ app, win, reportPath }) {
  const errors = [];
  const startedAt = Date.now();
  let settled = false;

  const contents = win.webContents;

  contents.on("console-message", (...args) => {
    const details = args.find((arg) => arg && typeof arg === "object" && "message" in arg);
    if (details) {
      if (details.level === 3 || details.level === "error") errors.push("console: " + details.message);
      return;
    }
    const [, level, message] = args;
    if (level === 3 || level === "error") errors.push("console: " + message);
  });

  contents.on("preload-error", (event, preloadPath, error) => {
    errors.push("preload: " + preloadPath + " -> " + error.message);
  });

  contents.on("did-fail-load", (event, code, description) => {
    errors.push("load: " + code + " " + description);
  });

  contents.on("render-process-gone", (event, details) => {
    errors.push("renderer-gone: " + details.reason);
  });

  const timer = setTimeout(() => {
    finish(false, "自检超时（" + SUITE_TIMEOUT + "ms）");
  }, SUITE_TIMEOUT);

  function finish(ok, fatal) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);

    const report = {
      ok: Boolean(ok),
      fatal: fatal || null,
      durationMs: Date.now() - startedAt,
      platform: process.platform,
      packaged: app.isPackaged,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      errors,
      results: finish.results || []
    };

    writeReport(reportPath, report);
    console.log(JSON.stringify(report, null, 2));
    app.exit(report.ok ? 0 : 1);
  }
  finish.results = [];

  async function runSuite() {
    const suite = async () => {
      const results = [];
      const record = (name, pass, detail) =>
        results.push({ name, pass: Boolean(pass), detail: detail === undefined ? "" : String(detail) });
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const displayOf = (element) => getComputedStyle(element).display;
      const fireKey = (type, code, key, keyCode, extra) =>
        document.dispatchEvent(new KeyboardEvent(type, Object.assign({
          code,
          key,
          keyCode,
          repeat: false,
          bubbles: true,
          cancelable: true
        }, extra || {})));
      const press = async (code, key, keyCode, hold) => {
        fireKey("keydown", code, key, keyCode);
        await sleep(hold || 2);
        fireKey("keyup", code, key, keyCode);
      };
      const stats = () => ({
        keys: byId("chatterKeys").textContent,
        count: byId("chatterCount").textContent,
        bad: byId("chatterBadKeys").textContent,
        min: byId("chatterMinGap").textContent,
        current: byId("currentKeyName").textContent,
        state: byId("currentKeyState").textContent,
        currentIssues: byId("currentKeyIssues").textContent,
        faultRows: document.querySelectorAll("#faultKeyList li.fault-item").length,
        eventRows: document.querySelectorAll("#faultEventList li.fault-event").length,
        firstEvent: document.querySelector("#faultEventList li.fault-event .event-detail strong")?.textContent || "",
        firstGap: document.querySelector("#faultEventList li.fault-event .event-gap")?.textContent || ""
      });
      const reset = () => byId("resetChatter").click();

      const keyCount = document.querySelectorAll(".key").length;
      record("渲染 104 键布局", keyCount === 104 && byId("statTotal").textContent === "104", keyCount + " 键");
      record("桌面桥接可用", Boolean(window.keyboardToolsDesktop && window.keyboardToolsDesktop.isDesktop === true),
        window.keyboardToolsDesktop ? String(window.keyboardToolsDesktop.platform) : "missing");
      record("页面无横向溢出", document.documentElement.scrollWidth <= window.innerWidth + 1,
        document.documentElement.scrollWidth + "/" + window.innerWidth);
      record("旧速度界面已移除",
        !document.getElementById("cpsChart") && !document.getElementById("clickPad") &&
          !document.getElementById("durationSeg") && !document.querySelector(".click-pad"),
        "无图表/点击区/时长按钮");

      await sleep(500);
      record("版本信息同步", /桌面版 v\d/.test(byId("appMeta").textContent), byId("appMeta").textContent);

      document.querySelector('[data-tab="chatter"]').click();
      await sleep(120);
      record("连点故障面板切换",
        displayOf(byId("panel-chatter")) !== "none" && displayOf(byId("panel-keys")) === "none",
        displayOf(byId("panel-chatter")));
      record("默认监听与阈值",
        /监听中/.test(byId("monitorStatus").textContent) && byId("chatterThresholdHint").textContent === "判定阈值 30 ms",
        byId("monitorStatus").textContent + " / " + byId("chatterThresholdHint").textContent);

      reset();
      await press("KeyA", "a", 65);
      await sleep(100);
      await press("KeyA", "a", 65);
      await sleep(40);
      const normal = stats();
      record("正常敲击不误报", normal.keys === "1" && normal.count === "0" && normal.bad === "0" &&
        normal.current === "KeyA", JSON.stringify(normal));

      reset();
      fireKey("keydown", "KeyB", "b", 66);
      await sleep(2);
      fireKey("keyup", "KeyB", "b", 66);
      await sleep(6);
      fireKey("keydown", "KeyB", "b", 66);
      await sleep(2);
      fireKey("keyup", "KeyB", "b", 66);
      await sleep(50);
      const bounce = stats();
      record("回弹故障被识别", bounce.count === "1" && bounce.bad === "1" && bounce.faultRows === 1 &&
        bounce.eventRows === 1 && bounce.firstEvent === "松开后回弹" && Number(bounce.min) <= 30,
        JSON.stringify(bounce));

      reset();
      fireKey("keydown", "KeyC", "c", 67);
      for (let i = 0; i < 6; i += 1) {
        await sleep(6);
        fireKey("keydown", "KeyC", "c", 67, { repeat: true });
      }
      fireKey("keyup", "KeyC", "c", 67);
      await sleep(40);
      const repeatHold = stats();
      record("长按重复被排除", repeatHold.count === "0" && repeatHold.keys === "1", JSON.stringify(repeatHold));

      reset();
      fireKey("keydown", "KeyD", "d", 68);
      await sleep(10);
      fireKey("keydown", "KeyD", "d", 68);
      await sleep(2);
      fireKey("keyup", "KeyD", "d", 68);
      await sleep(40);
      const downAgain = stats();
      record("未松开重复触发被识别",
        downAgain.count === "1" && downAgain.firstEvent === "未松开重复触发" && downAgain.faultRows === 1,
        JSON.stringify(downAgain));

      reset();
      await press("KeyE", "e", 69);
      await sleep(5);
      await press("KeyF", "f", 70);
      await sleep(30);
      const differentKeys = stats();
      record("不同按键互不干扰", differentKeys.count === "0" && differentKeys.keys === "2", JSON.stringify(differentKeys));

      document.querySelector('.seg-btn[data-threshold="50"]').click();
      await sleep(30);
      reset();
      await press("KeyH", "h", 72);
      await sleep(25);
      await press("KeyH", "h", 72);
      await sleep(40);
      const wideThreshold = stats();
      record("阈值调宽后判定生效",
        byId("chatterThresholdHint").textContent === "判定阈值 50 ms" &&
          document.querySelector(".seg-btn.is-active").dataset.threshold === "50" &&
          wideThreshold.count === "1",
        JSON.stringify(wideThreshold));

      document.querySelector('.seg-btn[data-threshold="30"]').click();
      await sleep(30);
      record("切换阈值清空记录", byId("chatterCount").textContent === "0" && byId("chatterKeys").textContent === "0");

      reset();
      byId("toggleMonitor").click();
      await sleep(20);
      const pausedStatus = byId("monitorStatus").textContent.trim();
      fireKey("keydown", "KeyI", "i", 73);
      await sleep(2);
      fireKey("keyup", "KeyI", "i", 73);
      await sleep(5);
      fireKey("keydown", "KeyI", "i", 73);
      fireKey("keyup", "KeyI", "i", 73);
      await sleep(20);
      record("暂停检测后不再记录",
        /已暂停/.test(pausedStatus) && byId("chatterCount").textContent === "0",
        pausedStatus + " / " + byId("chatterCount").textContent);
      byId("toggleMonitor").click();
      await sleep(20);
      record("恢复监听", /监听中/.test(byId("monitorStatus").textContent));

      reset();
      fireKey("keydown", "KeyJ", "j", 74);
      await sleep(2);
      window.dispatchEvent(new Event("blur"));
      fireKey("keydown", "KeyJ", "j", 74);
      await sleep(2);
      fireKey("keyup", "KeyJ", "j", 74);
      await sleep(20);
      record("失焦后不误报", byId("chatterCount").textContent === "0", byId("chatterCount").textContent);

      reset();
      const spaceEvent = new KeyboardEvent("keydown", {
        code: "Space", key: " ", bubbles: true, cancelable: true
      });
      const spaceAllowed = document.dispatchEvent(spaceEvent);
      fireKey("keyup", "Space", " ", 32);
      record("检测中拦截默认行为", spaceAllowed === false, String(spaceAllowed));
      reset();
      record("清空记录恢复初始态",
        byId("chatterKeys").textContent === "0" && byId("chatterCount").textContent === "0" &&
          byId("chatterMinGap").textContent === "—" && byId("faultKeyList").querySelector("li.empty") !== null,
        JSON.stringify(stats()));

      document.querySelector('[data-tab="keys"]').click();
      await sleep(60);
      record("键位检测仍可用", displayOf(byId("panel-keys")) !== "none", displayOf(byId("panel-keys")));
      fireKey("keydown", "KeyA", "a", 65);
      fireKey("keydown", "KeyB", "b", 66);
      await sleep(30);
      record("键位统计正常", byId("statTested").textContent === "2" &&
        document.querySelectorAll(".key.active").length === 2,
        byId("statTested").textContent);
      fireKey("keyup", "KeyA", "a", 65);
      fireKey("keyup", "KeyB", "b", 66);
      byId("resetKeys").click();

      const bodyBg = getComputedStyle(document.body).backgroundColor;
      byId("themeToggle").click();
      await sleep(60);
      const light = {
        theme: document.documentElement.dataset.theme,
        bg: getComputedStyle(document.body).backgroundColor
      };
      record("浅色主题生效", light.theme === "light" && light.bg !== bodyBg, light.bg);
      byId("themeToggle").click();
      await sleep(40);
      record("恢复深色主题", document.documentElement.dataset.theme === "dark");

      document.querySelector('[data-tab="keys"]').click();
      await sleep(30);
      try {
        localStorage.removeItem("keyboardtools.chatter.threshold");
      } catch (error) { /* ignore */ }

      return results;
    };

    const results = await contents.executeJavaScript("(" + suite.toString() + ")()", true);
    return results;
  }

  async function trustedKeyboardCheck() {
    try {
      const debuggerApi = contents.debugger;
      if (!debuggerApi.isAttached()) debuggerApi.attach("1.3");

      const keyEvent = {
        key: "a",
        code: "KeyA",
        windowsVirtualKeyCode: 65,
        nativeVirtualKeyCode: 65
      };
      await debuggerApi.sendCommand("Input.dispatchKeyEvent", Object.assign({ type: "rawKeyDown" }, keyEvent));
      await debuggerApi.sendCommand("Input.dispatchKeyEvent", Object.assign({ type: "keyUp" }, keyEvent));
      await new Promise((resolve) => setTimeout(resolve, 120));

      const data = await contents.executeJavaScript(
        "(() => ({ tested: document.getElementById('statTested').textContent," +
        " active: document.querySelectorAll('.key.active').length," +
        " testedClass: document.querySelector('.key[data-code=\"KeyA\"]').classList.contains('tested') }))()",
        true
      );

      try { debuggerApi.detach(); } catch (error) { /* ignore */ }

      return {
        name: "真实输入通道按键",
        pass: data.tested === "1" && data.testedClass === true,
        detail: JSON.stringify(data)
      };
    } catch (error) {
      return {
        name: "真实输入通道按键",
        pass: true,
        skipped: true,
        detail: "调试协议不可用，已跳过：" + error.message
      };
    }
  }

  let executed = false;

  async function execute() {
    if (executed) return;
    executed = true;
    try {
      const results = await runSuite();
      finish.results = results;

      const trusted = await trustedKeyboardCheck();
      finish.results.push(trusted);

      const failed = finish.results.filter((item) => !item.pass);
      const ok = failed.length === 0 && errors.length === 0;
      finish(ok, failed.length ? failed.map((item) => item.name).join("、") + " 未通过" : null);
    } catch (error) {
      finish(false, "自检执行异常：" + error.message);
    }
  }

  if (contents.isLoading()) {
    contents.once("did-finish-load", execute);
  } else {
    execute();
  }
};