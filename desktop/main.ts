import { app, BrowserWindow, ipcMain, Tray, Menu, dialog } from "electron";
import path from "node:path";
import { IpcChannels } from "./ipcChannels";
import { logEvent } from "../src/logger";
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

  // DEBUG: espelha o console da janela (renderer) pro error.log -- inclui
  // promises rejeitadas nao tratadas, que o Chromium ja imprime no console
  // mas que hoje nao aparecem em lugar nenhum visivel no .exe empacotado.
  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      logEvent("DEBUG console do renderer", `[nivel ${level}] ${message} (${sourceId}:${line})`);
    }
  });

  // DEBUG: dispara se o preload.js falhar ao carregar/executar -- se isso
  // acontecer, window.api nunca e exposto e a tela fica com a tabela vazia
  // sem nenhum erro visivel, mesmo com o banco tendo dados.
  win.webContents.on("preload-error", (_event, preloadPath, error) => {
    logEvent("DEBUG erro ao carregar preload", `path=${preloadPath} erro=${error}`);
  });

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

  ipcMain.handle(IpcChannels.packagesRemove, (_event, code: string): PackagesResult => {
    try {
      packageRepository.remove(code);
      return { ok: true, packages: packageRepository.listAllForDisplay() };
    } catch (err) {
      console.error("Erro ao remover pacote:", err);
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
