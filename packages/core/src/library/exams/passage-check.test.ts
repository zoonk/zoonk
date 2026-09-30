import { describe, expect, it } from "vitest";
import { findNamesInDocument, isPassageInDocument } from "./passage-check";

const NOTICE = `4.1 As provas objetivas serão aplicadas em 8 e 15 de novembro de 2026.
4.2 A prova de Linguagens, Códigos e suas Tecnologias terá 45 (quarenta e cinco) ques-
tões de múltipla escolha, com 5 alternativas cada.`;

describe(isPassageInDocument, () => {
  it("finds a passage quoted exactly, whatever its spacing and case", () => {
    expect(
      isPassageInDocument({
        passage: "as provas  objetivas serão aplicadas em 8 e 15 de novembro de 2026",
        text: NOTICE,
      }),
    ).toBe(true);
  });

  it("finds a passage across a hyphenated line break from PDF text", () => {
    expect(
      isPassageInDocument({
        passage: "terá 45 (quarenta e cinco) questões de múltipla escolha",
        text: NOTICE,
      }),
    ).toBe(true);
  });

  it("rejects a passage with a number the document doesn't state", () => {
    expect(
      isPassageInDocument({
        passage: "A prova de Linguagens, Códigos e suas Tecnologias terá 60 questões",
        text: NOTICE,
      }),
    ).toBe(false);
  });

  it("rejects a passage the document doesn't contain", () => {
    expect(
      isPassageInDocument({
        passage: "A redação vale 1.000 pontos e é eliminatória.",
        text: NOTICE,
      }),
    ).toBe(false);
  });

  it("rejects quotes too short to identify anything", () => {
    expect(isPassageInDocument({ passage: "2026", text: NOTICE })).toBe(false);
  });
});

describe(findNamesInDocument, () => {
  it("finds names stated word for word, whatever their case, punctuation and line breaks", () => {
    const found = findNamesInDocument({
      names: ["Linguagens, códigos e suas tecnologias", "questões de múltipla escolha", "provas"],
      text: NOTICE,
    });

    expect([...found]).toStrictEqual([
      "Linguagens, códigos e suas tecnologias",
      "questões de múltipla escolha",
      "provas",
    ]);
  });

  it("skips names the document doesn't state as whole words in that order", () => {
    const found = findNamesInDocument({
      names: ["Matemática", "alternativa", "múltipla escolha de questões", " "],
      text: NOTICE,
    });

    expect(found.size).toBe(0);
  });
});
