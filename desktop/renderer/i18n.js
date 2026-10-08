// UI texts. Portuguese is the default; English exists for portfolio screenshots
// (start the app with APP_LANG=en, or open index.html?lang=en).
const MESSAGES = {
  pt: {
    appTitle: "Rastreio de Encomendas",
    refresh: "Atualizar",
    refreshing: "Atualizando...",
    cat_aguardando: "Aguardando",
    cat_em_transito: "Em trânsito",
    cat_entregue: "Entregue",
    filterAll: "Todos",
    searchPlaceholder: "Buscar por código de rastreio...",
    colCode: "Código",
    colStatus: "Status",
    colLastEvent: "Último evento",
    colDate: "Data",
    removeRecord: "Remover registro",
    trackingCode: "Código de rastreio",
    type: "Tipo",
    eta: "Previsão de entrega",
    currentStatus: "Status atual",
    history: "Histórico",
    close: "Fechar",
    noHistory: "Sem histórico ainda.",
    emptyCategory: "Nenhum pacote nessa categoria.",
    emptySearch: "Nenhum pacote encontrado para essa busca.",
    loadError: "Não foi possível carregar os pacotes. Tente clicar em Atualizar de novo.",
    confirmRemove: (code) => `Remover o registro do pacote ${code}? Essa ação não pode ser desfeita.`,
    subtitle: (n) => (n === 1 ? "1 encomenda acompanhada" : `${n} encomendas acompanhadas`),
  },
  en: {
    appTitle: "Package Tracking",
    refresh: "Refresh",
    refreshing: "Refreshing...",
    cat_aguardando: "Waiting",
    cat_em_transito: "In transit",
    cat_entregue: "Delivered",
    filterAll: "All",
    searchPlaceholder: "Search by tracking code...",
    colCode: "Code",
    colStatus: "Status",
    colLastEvent: "Last event",
    colDate: "Date",
    removeRecord: "Remove record",
    trackingCode: "Tracking code",
    type: "Type",
    eta: "Estimated delivery",
    currentStatus: "Current status",
    history: "History",
    close: "Close",
    noHistory: "No history yet.",
    emptyCategory: "No packages in this category.",
    emptySearch: "No packages match this search.",
    loadError: "Could not load the packages. Try Refresh again.",
    confirmRemove: (code) => `Remove the record for package ${code}? This cannot be undone.`,
    subtitle: (n) => (n === 1 ? "1 package tracked" : `${n} packages tracked`),
  },
};

const LANG = new URLSearchParams(location.search).get("lang") === "en" ? "en" : "pt";
const LOCALE = LANG === "en" ? "en-US" : "pt-BR";

function t(key, ...args) {
  const value = MESSAGES[LANG][key] ?? MESSAGES.pt[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

function applyStaticTexts() {
  document.documentElement.lang = LANG === "en" ? "en" : "pt-BR";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

/** Formats ISO timestamps for people; anything else (already formatted) is returned as is. */
function formatDate(value) {
  if (!value) return "-";
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "short", timeStyle: "short" }).format(date);
}

applyStaticTexts();
