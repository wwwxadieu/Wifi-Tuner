const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wifituner", {
  platform: process.platform,
  isElectron: true,
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
