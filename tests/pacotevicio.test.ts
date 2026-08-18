import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTrackingStatus } from "../src/tracking/pacotevicio.js";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchTrackingStatus", () => {
  it("retorna o evento mais recente com base na data, nao na ordem do array, com o historico completo", async () => {
    mockFetchOnce({
      carrier: "correios",
      tracking_code: "NN340059206BR",
      correios_object: {
        situacao: "T",
        temEventoEntrega: false,
        dtPrevista: "03/09/2026",
        tipoPostal: { descricao: "ETQ LOG PACKET STANDARD" },
        eventos: [
          {
            descricaoFrontEnd: "Objeto expedido",
            dtHrCriado: { date: "2026-08-14 06:54:20.000000" },
            finalizador: "N",
            unidade: { endereco: { cidade: "Curitiba", uf: "PR" } },
          },
          {
            descricaoFrontEnd: "Postado",
            dtHrCriado: { date: "2026-08-10 18:01:00.000000" },
            finalizador: "N",
            unidade: { endereco: { cidade: null, uf: null } },
          },
        ],
      },
    });

    const result = await fetchTrackingStatus("NN340059206BR");

    expect(result).toEqual({
      status: "T",
      description: "Objeto expedido",
      eventAt: "2026-08-14 06:54:20.000000",
      delivered: false,
      estimatedDelivery: "03/09/2026",
      packageType: "ETQ LOG PACKET STANDARD",
      events: [
        {
          description: "Objeto expedido",
          at: "2026-08-14 06:54:20.000000",
          city: "Curitiba",
          uf: "PR",
        },
        {
          description: "Postado",
          at: "2026-08-10 18:01:00.000000",
          city: null,
          uf: null,
        },
      ],
    });
  });

  it("marca como entregue quando temEventoEntrega e true", async () => {
    mockFetchOnce({
      correios_object: {
        situacao: "E",
        temEventoEntrega: true,
        eventos: [
          {
            descricaoFrontEnd: "Objeto entregue ao destinatario",
            dtHrCriado: { date: "2026-08-20 10:00:00.000000" },
            finalizador: "S",
          },
        ],
      },
    });

    const result = await fetchTrackingStatus("NN340059206BR");
    expect(result?.delivered).toBe(true);
  });

  it("marca como entregue por palavra-chave na descricao, mesmo sem temEventoEntrega", async () => {
    mockFetchOnce({
      correios_object: {
        situacao: "T",
        eventos: [
          {
            descricaoFrontEnd: "Objeto entregue ao destinatario",
            dtHrCriado: { date: "2026-08-20 10:00:00.000000" },
          },
        ],
      },
    });

    const result = await fetchTrackingStatus("NN340059206BR");
    expect(result?.delivered).toBe(true);
  });

  it("retorna null quando a API responde com erro (ex: periodo invalido)", async () => {
    mockFetchOnce({
      carrier: "correios",
      tracking_code: "AM101610575BR",
      erro: true,
      mensagem: "Período inválido",
    });

    const result = await fetchTrackingStatus("AM101610575BR");
    expect(result).toBeNull();
  });

  it("retorna null quando nao ha eventos", async () => {
    mockFetchOnce({
      correios_object: { situacao: "PO", eventos: [] },
    });
    const result = await fetchTrackingStatus("NN340059206BR");
    expect(result).toBeNull();
  });

  it("lanca erro quando a resposta HTTP nao eh ok", async () => {
    mockFetchOnce({}, false, 404);
    await expect(fetchTrackingStatus("NN000000000BR")).rejects.toThrow();
  });
});
