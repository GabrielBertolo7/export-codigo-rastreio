import { app, BrowserWindow, ipcMain, Tray, Menu, dialog } from "electron";
import path from "node:path";
import { appendFileSync } from "node:fs";
import { IpcChannels } from "./ipcChannels";
// Import tardio (dentro do try/catch abaixo) de proposito: config.ts valida o
// .env na primeira vez que e importado, e queremos capturar isso pra mostrar
// um dialogo amigavel em vez de deixar o Electron crashar sem explicacao.
import type * as DbModule from "../src/db/index";
import type * as PollerModule from "../src/poller";
import type * as BotModule from "../src/telegram/bot";
import type * as ListenerModule from "../src/telegram/listener";

interface PackagesResult {
  ok: boolean;
  packages: unknown[];
}

let win: BrowserWindow | null = null;
let tray: Tray | null = null;

const logPath = path.join(
  process.env.PORTABLE_EXECUTABLE_DIR ?? process.cwd(),
  "error.log"
);

/** Como e um app grafico sem console, erros que passariam batido viram uma linha nesse arquivo. */
function logEvent(context: string, err: unknown): void {
  const line = `[${new Date().toISOString()}] ${context}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`;
  console.error(line);
  try {
    appendFileSync(logPath, line);
  } catch {
    // se nem isso der certo, nao ha mais o que fazer alem de logar no console
  }
}

process.on("unhandledRejection", (reason) => logEvent("Unhandled Rejection", reason));
process.on("uncaughtException", (err) => logEvent("Uncaught Exception", err));

const assetsDir = path.join(__dirname, "..", "..", "desktop", "assets");
const rendererDir = path.join(__dirname, "..", "..", "desktop", "renderer");

function createWindow(): void {
  win = new BrowserWindow({
    width: 960,
    height: 640,
    icon: path.join(assetsDir, "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(rendererDir, "index.html"));

  // Fechar a janela (X) so esconde -- o listener do Telegram precisa continuar
  // rodando em segundo plano pra nao perder mensagens.
  win.on("close", (event) => {
    event.preventDefault();
    win?.hide();
  });
}

function createTray(): void {
  tray = new Tray(path.join(assetsDir, "tray.png"));
  tray.setToolTip("Rastreio de Encomendas");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir painel", click: () => win?.show() },
      { label: "Sair", click: () => app.exit() },
    ])
  );
  tray.on("click", () => win?.show());
}

function registerIpcHandlers(
  packageRepository: typeof DbModule.packageRepository,
  pollOnce: typeof PollerModule.pollOnce
): void {
  ipcMain.handle(IpcChannels.packagesList, (): PackagesResult => {
    try {
      return { ok: true, packages: packageRepository.listAllForDisplay() };
    } catch (err) {
      console.error("Erro ao listar pacotes:", err);
      return { ok: false, packages: [] };
    }
  });

  ipcMain.handle(IpcChannels.packagesRefresh, async (): Promise<PackagesResult> => {
    try {
      await pollOnce();
      return { ok: true, packages: packageRepository.listAllForDisplay() };
    } catch (err) {
      console.error("Erro ao atualizar pacotes:", err);
      return { ok: false, packages: [] };
    }
  });
}

function startApp(): void {
  try {
    const { packageRepository }: typeof DbModule = require("../src/db/index");
    const { pollOnce }: typeof PollerModule = require("../src/poller");
    const { bot }: typeof BotModule = require("../src/telegram/bot");
    const { startListener }: typeof ListenerModule = require("../src/telegram/listener");

    startListener();
    bot
      .start({
        onStart: (botInfo) =>
          logEvent("Bot conectado", `@${botInfo.username} escutando`),
      })
      .catch((err) => logEvent("Erro ao conectar o bot no Telegram", err));

    registerIpcHandlers(packageRepository, pollOnce);

    createTray();
    createWindow();
  } catch (err) {
    dialog.showErrorBox(
      "Erro ao iniciar",
      `Confira se o arquivo .env esta na mesma pasta do programa, preenchido corretamente.\n\n${String(err)}`
    );
    app.exit(1);
  }
}

// So permite uma instancia rodando: o bot faz long polling no Telegram com um
// unico token, e duas copias ao mesmo tempo entram em conflito na API (409).
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  // Se o usuario tentar abrir o .exe de novo com o app ja rodando (ex: na
  // bandeja), so mostra a janela existente em vez de abrir uma segunda copia.
  app.on("second-instance", () => {
    win?.show();
  });

  app.whenReady().then(() => {
    app.setLoginItemSettings({ openAtLogin: true });
    startApp();
  });

  // Nao encerra ao fechar a ultima janela -- o app fica na bandeja. So sai via
  // menu "Sair" da bandeja (app.exit()).
  app.on("window-all-closed", () => {});
}
