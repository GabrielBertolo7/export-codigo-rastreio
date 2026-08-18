export interface PackageRow {
  code: string;
  first_seen_at: string;
  status: string | null;
  last_event_description: string | null;
  last_event_at: string | null;
  delivered_at: string | null;
  active: 0 | 1;
  events_json: string | null;
  estimated_delivery: string | null;
  package_type: string | null;
}

export type PackageCategory = "aguardando" | "em_transito" | "entregue";

/** Classifica um pacote pra exibicao no painel, com base nos campos ja salvos. */
export function categorize(pkg: PackageRow): PackageCategory {
  if (pkg.delivered_at !== null) return "entregue";
  if (pkg.last_event_at === null) return "aguardando";
  return "em_transito";
}
