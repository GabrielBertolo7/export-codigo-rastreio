import { packageRepository } from "./db/index";
import { trackingProvider } from "./tracking/pacotevicio";

/** Consulta o provedor de rastreio pra cada pacote ativo e grava o resultado. Chamado sob demanda (painel) ou via scripts/poll-once.ts. */
export async function pollOnce(): Promise<void> {
  for (const pkg of packageRepository.listActive()) {
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
      console.error(`Erro ao consultar rastreio de ${pkg.code}:`, err);
    }
  }
}
