import { packageRepository } from "./db/index";
import { trackingProvider } from "./tracking/pacotevicio";
import { logEvent } from "./logger";

// Pausa entre consultas pra nao estourar limite de requisicoes por segundo
// da API em lotes grandes de pacotes.
const DELAY_BETWEEN_REQUESTS_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Consulta o provedor de rastreio pra cada pacote ativo e grava o resultado. Chamado sob demanda (painel) ou via scripts/poll-once.ts. */
export async function pollOnce(): Promise<void> {
  const packages = packageRepository.listActive();

  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    try {
      const update = await trackingProvider.fetchTrackingStatus(pkg.code);
      if (!update) continue;

      packageRepository.updateTracking(pkg.code, {
        status: update.status,
        lastEventDescription: update.description,
        lastEventAt: update.eventAt,
        events: update.events,
        estimatedDelivery: update.estimatedDelivery,
        packageType: update.packageType,
      });

      if (update.delivered) {
        packageRepository.markDelivered(pkg.code);
      }
    } catch (err) {
      logEvent(`Erro ao consultar rastreio de ${pkg.code}`, err);
    }

    if (i < packages.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
  }
}
