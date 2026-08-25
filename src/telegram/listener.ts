import { bot } from "./bot";
import { config } from "../config";
import { extractTrackingCodes } from "./codeExtractor";
import { packageRepository } from "../db/index";
import { logEvent } from "../logger";

/** Registra o handler que escuta o grupo do fornecedor e captura novos codigos de rastreio. */
export function startListener(): void {
  bot.on("message:text", (ctx) => {
    const chatId = String(ctx.chat.id);
    if (chatId !== config.supplierGroupChatId) {
      logEvent(
        "DEBUG mensagem ignorada (chat diferente)",
        `chat recebido=${chatId} esperado=${config.supplierGroupChatId} texto="${ctx.message.text}"`
      );
      return;
    }

    try {
      const codes = extractTrackingCodes(ctx.message.text);
      logEvent(
        "DEBUG mensagem recebida no grupo correto",
        `texto="${ctx.message.text}" codigosExtraidos=${JSON.stringify(codes)}`
      );

      for (const code of codes) {
        const inserted = packageRepository.upsertCode(code);
        logEvent(
          "DEBUG upsertCode",
          `${code}: ${inserted ? "inserido (novo)" : "ja existia, ignorado"}`
        );
      }
    } catch (err) {
      logEvent("DEBUG erro ao processar mensagem", err);
    }
  });
}
