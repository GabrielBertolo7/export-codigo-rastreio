const TRACKING_CODE_PATTERN = /\b[A-Z]{2}\d{9}BR\b/g;

/** Extrai todos os codigos de rastreio dos Correios (formato NN000000000BR) de um texto. */
export function extractTrackingCodes(text: string): string[] {
  const matches = text.match(TRACKING_CODE_PATTERN) ?? [];
  return [...new Set(matches)];
}
