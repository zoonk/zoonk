import { describe, expect, it } from "vitest";
import { isStatuteSource, splitStatuteArticles, toStatuteShortName } from "./statute-articles";

const LAW = `LEI Nº 8.112, DE 11 DE DEZEMBRO DE 1990
Art. 1º Esta Lei institui o Regime Jurídico dos Servidores Públicos Civis da União, das autarquias.
Art. 2º Para os efeitos desta Lei, servidor é a pessoa legalmente investida em cargo público.
Art. 3º Curto.
Art. 13. A posse dar-se-á pela assinatura do respectivo termo, no qual deverão constar as atribuições.`;

describe(splitStatuteArticles, () => {
  it("splits a statute on its article headings and leaves out tiny ones", () => {
    expect(splitStatuteArticles(LAW)).toStrictEqual([
      {
        reference: "Art. 1º",
        text: "Esta Lei institui o Regime Jurídico dos Servidores Públicos Civis da União, das autarquias.",
      },
      {
        reference: "Art. 2º",
        text: "Para os efeitos desta Lei, servidor é a pessoa legalmente investida em cargo público.",
      },
      {
        reference: "Art. 13",
        text: "A posse dar-se-á pela assinatura do respectivo termo, no qual deverão constar as atribuições.",
      },
    ]);
  });
});

describe(isStatuteSource, () => {
  it("recognizes laws by title or by the official site", () => {
    expect(isStatuteSource({ title: "Lei nº 8.112, de 1990", url: null })).toBe(true);

    expect(
      isStatuteSource({
        title: "Constituição",
        url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
      }),
    ).toBe(true);

    expect(isStatuteSource({ title: "Edital nº 1", url: "https://cebraspe.org.br/x.pdf" })).toBe(
      false,
    );
  });
});

describe(toStatuteShortName, () => {
  it("keeps the title up to its first comma", () => {
    expect(toStatuteShortName("Lei nº 8.112, de 11 de dezembro de 1990")).toBe("Lei nº 8.112");
  });
});
