import { describe, expect, it } from "vitest";
import { categorize, type PackageRow } from "../src/db/packageCategory";

function makeRow(overrides: Partial<PackageRow>): PackageRow {
  return {
    code: "NN340059206BR",
    first_seen_at: "2026-08-14T00:00:00.000Z",
    status: null,
    last_event_description: null,
    last_event_at: null,
    delivered_at: null,
    active: 1,
    ...overrides,
  };
}

describe("categorize", () => {
  it("classifica como aguardando quando ainda nao tem nenhum evento", () => {
    expect(categorize(makeRow({}))).toBe("aguardando");
  });

  it("classifica como em_transito quando tem evento mas nao foi entregue", () => {
    expect(
      categorize(
        makeRow({
          status: "T",
          last_event_description: "Objeto em transferencia",
          last_event_at: "2026-08-14 06:54:20.000000",
        })
      )
    ).toBe("em_transito");
  });

  it("classifica como entregue quando delivered_at esta preenchido", () => {
    expect(
      categorize(
        makeRow({
          status: "E",
          last_event_description: "Objeto entregue",
          last_event_at: "2026-08-20 10:00:00.000000",
          delivered_at: "2026-08-20T10:05:00.000Z",
          active: 0,
        })
      )
    ).toBe("entregue");
  });

  it("prioriza entregue mesmo que os outros campos estejam inconsistentes", () => {
    expect(
      categorize(makeRow({ delivered_at: "2026-08-20T10:05:00.000Z" }))
    ).toBe("entregue");
  });
});
