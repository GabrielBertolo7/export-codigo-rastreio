import { config } from "../config";

interface PacoteVicioEvento {
  codigo?: string;
  descricao?: string;
  descricaoFrontEnd?: string;
  finalizador?: string;
  dtHrCriado?: { date?: string };
  unidade?: { endereco?: { cidade?: string | null; uf?: string | null } };
}

interface PacoteVicioCorreiosObject {
  situacao?: string;
  temEventoEntrega?: boolean;
  eventos?: PacoteVicioEvento[];
  dtPrevista?: string;
  tipoPostal?: { descricao?: string };
}

interface PacoteVicioApiResponse {
  erro?: boolean;
  mensagem?: string;
  correios_object?: PacoteVicioCorreiosObject;
}

export interface TrackingEvent {
  description: string;
  at: string;
  city: string | null;
  uf: string | null;
}

export interface TrackingUpdate {
  status: string;
  description: string;
  eventAt: string;
  delivered: boolean;
  events: TrackingEvent[];
  estimatedDelivery: string | null;
  packageType: string | null;
}

const DELIVERED_PATTERN = /entregue/i;

const RAPIDAPI_HOST = "correios-rastreamento-de-encomendas.p.rapidapi.com";

/** Converte os eventos crus da API pro formato interno, do mais recente pro mais antigo (a API nao garante ordem). */
function parseEvents(eventos: PacoteVicioEvento[]): TrackingEvent[] {
  const sortedEventos = [...eventos].sort((a, b) =>
    (b.dtHrCriado?.date ?? "").localeCompare(a.dtHrCriado?.date ?? "")
  );

  return sortedEventos.map((evento) => ({
    description: evento.descricaoFrontEnd ?? evento.descricao ?? "Sem descricao",
    at: evento.dtHrCriado?.date ?? "",
    city: evento.unidade?.endereco?.cidade ?? null,
    uf: evento.unidade?.endereco?.uf ?? null,
  }));
}

/** Consulta o status atual de um codigo de rastreio na API PacoteVicio (via RapidAPI). */
export async function fetchTrackingStatus(
  trackingCode: string
): Promise<TrackingUpdate | null> {
  const url = `https://${RAPIDAPI_HOST}/track?tracking_code=${encodeURIComponent(trackingCode)}&confidence_level=high`;

  const response = await fetch(url, {
    headers: {
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": config.rapidApiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `PacoteVicio respondeu ${response.status} para ${trackingCode}`
    );
  }

  const data = (await response.json()) as PacoteVicioApiResponse;

  // Ex: codigo ainda nao encontrado, ou fora do periodo de consulta dos Correios.
  if (data.erro || !data.correios_object) {
    return null;
  }

  const eventos = data.correios_object.eventos ?? [];
  if (eventos.length === 0) {
    return null;
  }

  const events = parseEvents(eventos);
  const latest = events[0];

  return {
    status: data.correios_object.situacao ?? latest.description,
    description: latest.description,
    eventAt: latest.at || new Date().toISOString(),
    delivered:
      data.correios_object.temEventoEntrega === true ||
      DELIVERED_PATTERN.test(latest.description),
    events,
    estimatedDelivery: data.correios_object.dtPrevista ?? null,
    packageType: data.correios_object.tipoPostal?.descricao ?? null,
  };
}

/** Fonte de status de rastreio, independente de qual API/transportadora está por trás. */
export interface TrackingProvider {
  fetchTrackingStatus(trackingCode: string): Promise<TrackingUpdate | null>;
}

/** Adapta a API do PacoteVicio (RapidAPI) pra interface genérica TrackingProvider, isolando quem consome rastreio do formato de resposta específico dessa API. */
class PacoteVicioTrackingProvider implements TrackingProvider {
  fetchTrackingStatus(trackingCode: string): Promise<TrackingUpdate | null> {
    return fetchTrackingStatus(trackingCode);
  }
}

export const trackingProvider: TrackingProvider = new PacoteVicioTrackingProvider();
