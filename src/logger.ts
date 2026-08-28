import path from "node:path";
import { appendFileSync } from "node:fs";

const logPath = path.join(
  process.env.PORTABLE_EXECUTABLE_DIR ?? process.cwd(),
  "error.log"
);

/** Como e um app grafico sem console, erros que passariam batido viram uma linha nesse arquivo. */
export function logEvent(context: string, detail: unknown): void {
  const line = `[${new Date().toISOString()}] ${context}: ${detail instanceof Error ? (detail.stack ?? detail.message) : String(detail)}\n`;
  console.error(line);
  try {
    appendFileSync(logPath, line);
  } catch {
    // se nem isso der certo, nao ha mais o que fazer alem de logar no console
  }
}
