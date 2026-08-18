import { describe, expect, it } from "vitest";
import { extractTrackingCodes } from "../src/telegram/codeExtractor.js";

describe("extractTrackingCodes", () => {
  it("extrai um codigo unico de uma mensagem simples", () => {
    expect(extractTrackingCodes("NN340059206BR")).toEqual(["NN340059206BR"]);
  });

  it("extrai o codigo mesmo cercado de texto", () => {
    expect(
      extractTrackingCodes("Segue o rastreio: NN340059206BR chegou pra postar")
    ).toEqual(["NN340059206BR"]);
  });

  it("extrai multiplos codigos da mesma mensagem", () => {
    expect(
      extractTrackingCodes("Codigos: NN340059206BR e AA123456789BR")
    ).toEqual(["NN340059206BR", "AA123456789BR"]);
  });

  it("remove duplicados", () => {
    expect(
      extractTrackingCodes("NN340059206BR ... NN340059206BR de novo")
    ).toEqual(["NN340059206BR"]);
  });

  it("ignora texto sem nenhum codigo", () => {
    expect(extractTrackingCodes("Oi, tudo bem? Sem codigo aqui hoje.")).toEqual(
      []
    );
  });

  it("ignora codigos minusculos (formato nao corresponde)", () => {
    expect(extractTrackingCodes("nn340059206br")).toEqual([]);
  });

  it("ignora numeros de telefone e CPFs que nao seguem o padrao", () => {
    expect(extractTrackingCodes("Meu CPF eh 123.456.789-00")).toEqual([]);
  });

  it("nao confunde codigo com quantidade errada de digitos", () => {
    expect(extractTrackingCodes("NN34005920BR")).toEqual([]);
    expect(extractTrackingCodes("NN3400592066BR")).toEqual([]);
  });
});
