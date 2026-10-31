import { describe, expect, it } from "vitest";
import { compareBoards, mentionsName } from "./exam-boards";

describe(compareBoards, () => {
  it("knows one board under its acronym, full name and former name", () => {
    expect(compareBoards("FGV", "Fundação Getúlio Vargas")).toBe("same");
    expect(compareBoards("FGV Conhecimento", "FGV")).toBe("same");
    expect(compareBoards("CESPE/UnB", "Cebraspe")).toBe("same");

    expect(
      compareBoards(
        "Centro Brasileiro de Pesquisa em Avaliação e Seleção e de Promoção de Eventos",
        "Cebraspe",
      ),
    ).toBe("same");

    expect(compareBoards("IDEPI", "Idepi")).toBe("same");
  });

  it("tells boards apart only when it knows both, and can't tell a name it doesn't know", () => {
    expect(compareBoards("FGV", "Cebraspe")).toBe("different");
    expect(compareBoards("Cespe", "Fundação Carlos Chagas")).toBe("different");
    expect(compareBoards("IDEPI", "Instituto Consulplan")).toBe("unknown");

    expect(
      compareBoards(
        "IDECAN",
        "Instituto de Desenvolvimento Educacional, Cultural e Assistencial Nacional",
      ),
    ).toBe("unknown");

    expect(
      compareBoards("IDEPI", "Instituto para o Desenvolvimento do Ensino, Pesquisa e Inovação"),
    ).toBe("unknown");
  });
});

describe(mentionsName, () => {
  it("matches whole words, ignoring case, accents and punctuation", () => {
    expect(mentionsName({ name: "fgv", text: "Fundação Getulio Vargas (FGV)" })).toBe(true);
    expect(mentionsName({ name: "fcc", text: "FCCx Seleções" })).toBe(false);
  });
});
