const CATEGORY_LABELS = {
  aguardando: "Aguardando",
  em_transito: "Em trânsito",
  entregue: "Entregue",
};

const state = {
  packages: [],
  filter: "todos",
  search: "",
  connected: true,
};

const tbody = document.querySelector("#packages tbody");
const emptyState = document.querySelector("#empty-state");
const detailDialog = document.querySelector("#detail");
const refreshButton = document.querySelector("#refresh");
const searchInput = document.querySelector("#search");

async function loadPackages() {
  const result = await window.api.listPackages();
  state.connected = result.ok;
  state.packages = result.packages;
  render();
}

/** Botao "Atualizar": dispara uma consulta de verdade na API PacoteVicio (via bot), nao so uma leitura do banco. */
async function refreshPackages() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Atualizando...";
  try {
    const result = await window.api.refreshPackages();
    state.connected = result.ok;
    state.packages = result.packages;
    render();
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Atualizar";
  }
}

function createHistoryItem(event) {
  const li = document.createElement("li");
  const location = [event.city, event.uf].filter(Boolean).join("/");

  const dateSpan = document.createElement("span");
  dateSpan.className = "history-date";
  dateSpan.textContent = event.at;

  const descSpan = document.createElement("span");
  descSpan.className = "history-desc";
  descSpan.textContent = location
    ? `${event.description} (${location})`
    : event.description;

  li.append(dateSpan, descSpan);
  return li;
}

function renderHistory(events) {
  const history = document.querySelector("#detail-history");
  history.replaceChildren();

  if (events.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Sem histórico ainda.";
    history.appendChild(li);
    return;
  }
  for (const event of events) {
    history.appendChild(createHistoryItem(event));
  }
}

function openDetail(code) {
  const pkg = state.packages.find((p) => p.code === code);
  if (!pkg) return;

  document.querySelector("#detail-code").textContent = pkg.code;
  document.querySelector("#detail-type").textContent = pkg.package_type ?? "-";
  document.querySelector("#detail-eta").textContent =
    pkg.estimated_delivery ?? "-";
  document.querySelector("#detail-status").textContent =
    pkg.last_event_description ?? "-";

  renderHistory(pkg.events ?? []);

  detailDialog.showModal();
}

function createPackageRow(pkg) {
  const tr = document.createElement("tr");
  tr.className = "clickable-row";
  tr.addEventListener("click", () => openDetail(pkg.code));

  const codeCell = document.createElement("td");
  codeCell.textContent = pkg.code;

  const statusCell = document.createElement("td");
  const badge = document.createElement("span");
  badge.className = `badge badge-${pkg.category}`;
  badge.textContent = CATEGORY_LABELS[pkg.category] ?? pkg.category;
  statusCell.appendChild(badge);

  const descriptionCell = document.createElement("td");
  descriptionCell.textContent = pkg.last_event_description ?? "-";

  const dateCell = document.createElement("td");
  dateCell.textContent = pkg.last_event_at ?? "-";

  tr.append(codeCell, statusCell, descriptionCell, dateCell);
  return tr;
}

function matchesSearch(pkg, term) {
  return term === "" || pkg.code.toLowerCase().includes(term);
}

function render() {
  if (!state.connected) {
    tbody.replaceChildren();
    emptyState.textContent =
      "Não foi possível carregar os pacotes. Tente clicar em Atualizar de novo.";
    emptyState.hidden = false;
    return;
  }

  const searchTerm = state.search.trim().toLowerCase();
  const filtered = state.packages.filter(
    (pkg) =>
      (state.filter === "todos" || pkg.category === state.filter) &&
      matchesSearch(pkg, searchTerm)
  );

  tbody.replaceChildren();
  for (const pkg of filtered) {
    tbody.appendChild(createPackageRow(pkg));
  }

  emptyState.textContent =
    searchTerm !== ""
      ? "Nenhum pacote encontrado para essa busca."
      : "Nenhum pacote nessa categoria.";
  emptyState.hidden = filtered.length > 0;
}

document.querySelectorAll("#filters button").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document
      .querySelectorAll("#filters button")
      .forEach((b) => b.classList.toggle("active", b === button));
    render();
  });
});

searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  render();
});

refreshButton.addEventListener("click", refreshPackages);
document
  .querySelector("#detail-close")
  .addEventListener("click", () => detailDialog.close());

loadPackages();
