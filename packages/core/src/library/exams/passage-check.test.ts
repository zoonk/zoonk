import { describe, expect, it } from "vitest";
import { findNamesInDocument, findQuotedEntries, isPassageInDocument } from "./passage-check";

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
  it("finds a numbered syllabus item whose hyphen the PDF text lost", () => {
    const found = findNamesInDocument({
      names: [
        "3 Organização do Estado: organização político-administrativa, União, estados",
        "3 Organização do Estado: organização político administrativa",
      ],
      text: "2 Princípios fundamentais. 3 Organização do Estado: organização políticoadministrativa, União, estados, municípios.",
    });

    expect([...found]).toStrictEqual([
      "3 Organização do Estado: organização político-administrativa, União, estados",
    ]);
  });

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

describe(findQuotedEntries, () => {
  const TABLE = [
    "| Algebra | linear equations | 35% |",
    "| Advanced Algebra | 15% |",
    "Problem-",
    "Solving 50%",
  ].join("\n");

  const names = ["Algebra", "Advanced Algebra", "Problem-Solving"];
  const entries = (passage: string) => findQuotedEntries({ names, passage, text: TABLE });

  it("reads each name's entry from the page where it holds the quote, skipped cells included", () => {
    expect(entries("Algebra … 35%")).toStrictEqual([
      { entry: "algebra | linear equations | 35", name: "Algebra" },
    ]);
  });

  it("cuts at the next name, even a longer one holding this one", () => {
    expect(
      findQuotedEntries({
        names,
        passage: "Algebra 15%",
        text: "Algebra 35%, Advanced Algebra 15%",
      }),
    ).toStrictEqual([
      { entry: "algebra 35%, ", name: "Algebra" },
      { entry: "advanced algebra 15", name: "Advanced Algebra" },
    ]);
  });

  it("skips words only within a line, so a quote can't join two rows", () => {
    expect(entries("Algebra 15%")).toStrictEqual([]);
  });

  it("reads across a hyphenated line break the quote doesn't have", () => {
    expect(entries("Problem-Solving 50%")).toStrictEqual([
      { entry: "problemsolving 50", name: "Problem-Solving" },
    ]);
  });

  it("finds nothing when a word is missing or out of order", () => {
    expect(entries("Algebra … 20%")).toStrictEqual([]);
    expect(entries("50% … Problem-Solving")).toStrictEqual([]);
  });
});
