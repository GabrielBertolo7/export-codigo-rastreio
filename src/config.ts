import dotenv from "dotenv";
import path from "node:path";

// Quando empacotado como .exe portatil (electron-builder), o processo roda a
// partir de uma pasta temporaria -- PORTABLE_EXECUTABLE_DIR aponta pra pasta
// real onde o .exe (e o .env do usuario) estao.
const baseDir = process.env.PORTABLE_EXECUTABLE_DIR ?? process.cwd();

dotenv.config({ path: path.join(baseDir, ".env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

export const config = {
  botToken: requireEnv("BOT_TOKEN"),
  supplierGroupChatId: requireEnv("SUPPLIER_GROUP_CHAT_ID"),
  rapidApiKey: requireEnv("RAPIDAPI_KEY"),
  dbPath: process.env.DB_PATH ?? path.join(baseDir, "data", "tracking.db"),
};
