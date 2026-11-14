"use strict";

/**
 * KeyboardTools 桌面应用主进程
 * - 独立窗口承载现有键位检测 / 连点检测界面
 * - 单实例运行、窗口尺寸记忆、禁止外部导航、生产环境屏蔽刷新与开发者工具
 * - 支持 --smoke-test 无界面自检模式，供自动化验证与 exe 产物验收
 */

const { app, BrowserWindow, Menu, ipcMain, screen } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const APP_ID = "com.keyboardtools.app";
const APP_TITLE = "KeyboardTools · 键盘检测工具";
const isDev = !app.isPackaged;
const isSmoke = process.argv.includes("--smoke-test");

if (isSmoke) {
  /* 自检窗口从不被用户聚焦，关闭 Windows 原生遮挡计算，
     避免无头虚拟机上渲染节流导致 computed style 滞后 */
  app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
}

app.setName("KeyboardTools");
app.setAppUserModelId(APP_ID);

let mainWindow = null;
let saveTimer = null;

function getArgValue(prefix) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix + "="));
  return hit ? hit.slice(prefix.length + 1) : null;
}

function getWindowStateFile() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isVisibleOnDisplays(bounds) {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    const overlapX = Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
    const overlapY = Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y);
    return overlapX >= 120 && overlapY >= 80;
  });
}

function loadWindowState() {
  const fallback = { width: 1200, height: 860 };
  try {
    const raw = fs.readFileSync(getWindowStateFile(), "utf8");
    const saved = JSON.parse(raw);
    if (!saved || !Number.isFinite(saved.width) || !Number.isFinite(saved.height)) return fallback;

    const state = {
      width: clamp(Math.round(saved.width), 960, 1800),
      height: clamp(Math.round(saved.height), 680, 1200)
    };
    if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      const candidate = { x: Math.round(saved.x), y: Math.round(saved.y), width: state.width, height: state.height };
      if (isVisibleOnDisplays(candidate)) {
        state.x = candidate.x;
        state.y = candidate.y;
      }
    }
    return state;
  } catch (error) {
    return fallback;
  }
}

function writeWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const bounds = win.getNormalBounds();
    fs.mkdirSync(path.dirname(getWindowStateFile()), { recursive: true });
    fs.writeFileSync(getWindowStateFile(), JSON.stringify(bounds, null, 2), "utf8");
  } catch (error) {
    console.error("[KeyboardTools] 无法保存窗口状态:", error.message);
  }
}

function scheduleWindowStateSave(win) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeWindowState(win), 400);
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  const state = loadWindowState();
  const options = {
    width: state.width,
    height: state.height,
    minWidth: 960,
    minHeight: 680,
    show: false,
    center: !Number.isFinite(state.x),
    backgroundColor: "#0a0f16",
    title: APP_TITLE,
    icon: path.join(__dirname, "..", "build", "icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
      devTools: isDev
    }
  };

  if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
    options.x = state.x;
    options.y = state.y;
  }

  mainWindow = new BrowserWindow(options);

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "..", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("resize", () => scheduleWindowStateSave(mainWindow));
  mainWindow.on("move", () => scheduleWindowStateSave(mainWindow));
  mainWindow.on("close", () => writeWindowState(mainWindow));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const contents = mainWindow.webContents;

  contents.setWindowOpenHandler(() => ({ action: "deny" }));

  contents.on("will-navigate", (event, url) => {
    try {
      const next = new URL(url);
      const current = new URL(contents.getURL());
      // 只允许同文件内的锚点跳转，阻止任何外部页面导航
      if (next.protocol !== "file:" || next.pathname !== current.pathname) {
        event.preventDefault();
      }
    } catch (error) {
      event.preventDefault();
    }
  });

  contents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    if (input.key === "F11") {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      return;
    }

    if (input.key === "Escape" && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
      return;
    }

    if (isDev) return;

    const ctrl = input.control || input.meta;
    const key = (input.key || "").toLowerCase();
    const blockReload = input.key === "F5" || (ctrl && key === "r");
    const blockDevTools = input.key === "F12" || (ctrl && input.shift && (key === "i" || key === "j" || key === "c"));
    if (blockReload || blockDevTools) event.preventDefault();
  });

  contents.on("did-fail-load", (event, code, description, validatedURL) => {
    console.error("[KeyboardTools] 页面加载失败:", code, description, validatedURL);
  });

  contents.on("render-process-gone", (event, details) => {
    console.error("[KeyboardTools] 渲染进程异常退出:", details.reason, details.exitCode);
  });

  if (isSmoke) {
    require("./smoke")({
      app,
      win: mainWindow,
      reportPath: getArgValue("--smoke-report")
    });
  }
}

const hasSingleInstanceLock = isSmoke || app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", focusMainWindow);

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);

    ipcMain.handle("app:info", () => ({
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      platform: process.platform
    }));

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else focusMainWindow();
    });
  }).catch((error) => {
    console.error("[KeyboardTools] 启动失败:", error);
    app.exit(1);
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin" || isSmoke) app.quit();
  });
}