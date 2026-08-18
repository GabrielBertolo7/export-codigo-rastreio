import { bot } from "./bot";
import { config } from "../config";
import { extractTrackingCodes } from "./codeExtractor";
import { packageRepository } from "../db/index";

/** Registra o handler que escuta o grupo do fornecedor e captura novos codigos de rastreio. */
export function startListener(): void {
  bot.on("message:text", (ctx) => {
    if (String(ctx.chat.id) !== config.supplierGroupChatId) {
      console.log(
        `Mensagem ignorada (chat ${ctx.chat.id}, esperado ${config.supplierGroupChatId}): "${ctx.message.text}"`
      );
      return;
    }

    const codes = extractTrackingCodes(ctx.message.text);
    for (const code of codes) {
      if (packageRepository.upsertCode(code)) {
        console.log(`Novo codigo capturado: ${code}`);
      }
    }
  });
}
