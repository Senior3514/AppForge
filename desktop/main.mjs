// Electron shell: starts the local agent (API + web on loopback), then shows it in a window.
import { app, BrowserWindow, dialog, shell } from "electron";
import path from "node:path";
import { startAgent } from "./launcher.mjs";

const dir = import.meta.dirname;
let agent;
let win;

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

const isWeb = (u) => /^https?:\/\//.test(u);

async function boot() {
  const splash = new BrowserWindow({ width: 360, height: 200, frame: false, resizable: false, show: true, backgroundColor: "#0f172a" });
  splash.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(
    '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#0f172a;color:#fff;font:600 18px system-ui">AppForge is starting…</body>'));
  try {
    agent = await startAgent({
      agentDir: app.isPackaged ? path.join(process.resourcesPath, "agent") : path.resolve(dir, "../dist/agent"),
      dataDir: path.join(app.getPath("userData"), "data"),
      nodeBin: process.execPath, // Electron's own runtime, so users need no separate Node install
      nodeEnv: { ELECTRON_RUN_AS_NODE: "1" },
      log: (l) => console.log(l),
    });
  } catch (e) {
    splash.destroy();
    dialog.showErrorBox("AppForge could not start", String(e?.message ?? e));
    app.quit();
    return;
  }
  const origin = new URL(agent.url).origin;
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600, title: "AppForge", backgroundColor: "#ffffff",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenuBarVisibility(false);
  // Only our own pages load in the window; every other link opens in the user's browser.
  win.webContents.setWindowOpenHandler(({ url }) => { if (isWeb(url)) void shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (new URL(url).origin !== origin) { e.preventDefault(); if (isWeb(url)) void shell.openExternal(url); } });
  await win.loadURL(agent.url);
  splash.destroy();
  win.on("closed", () => { win = undefined; });
}

app.whenReady().then(boot);
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => agent?.stop());
