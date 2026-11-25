"use strict";

/**
 * 预加载脚本：在开启 contextIsolation / sandbox 的前提下，
 * 只向渲染层暴露只读的应用信息，以及主进程拦截快捷键后的单向按键通知，
 * 不暴露任何 Node.js 能力。
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("keyboardToolsDesktop", {
  isDesktop: true,
  platform: process.platform,
  getInfo: () => ipcRenderer.invoke("app:info"),
  onInterceptedKey: (callback) => {
    if (typeof callback !== "function") return;
    ipcRenderer.on("app:intercepted-key", (_event, payload) => {
      try {
        callback(payload);
      } catch (error) {
        /* 渲染层回调失败不影响主进程快捷键处理 */
      }
    });
  }
});
