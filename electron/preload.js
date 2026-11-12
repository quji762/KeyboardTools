"use strict";

/**
 * 预加载脚本：在开启 contextIsolation / sandbox 的前提下，
 * 只向渲染层暴露只读的应用信息，不暴露任何 Node.js 能力。
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("keyboardToolsDesktop", {
  isDesktop: true,
  platform: process.platform,
  getInfo: () => ipcRenderer.invoke("app:info")
});