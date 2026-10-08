import { describe, expect, it } from "vitest";
import { groupTopics } from "./topic-number";

function outline(names: string[]) {
  return groupTopics(names.map((name) => ({ name }))).map((group) => [
    group.text,
    group.children.map((child) => [child.depth, child.text]),
  ]);
}

describe(groupTopics, () => {
  it("reads the notice's own numbers, with or without a trailing dot, and leaves the rest", () => {
    expect(
      outline(["5 Pontuação", "5.7. Emprego da crase", "Ortografia oficial", "2026 em números"]),
    ).toStrictEqual([
      ["Pontuação", [[1, "Emprego da crase"]]],
      ["Ortografia oficial", []],
      ["2026 em números", []],
    ]);
  });

  it("nests the notice's sub-items under their item and drops the numbers", () => {
    const groups = groupTopics(
      ["1 Estado", "1.1 Princípios", "1.1.1 Legalidade", "2 Ato administrativo", "Licitações"].map(
        (name) => ({ name }),
      ),
    );

    expect(
      groups.map((group) => [group.text, group.children.map((child) => [child.depth, child.text])]),
    ).toStrictEqual([
      [
        "Estado",
        [
          [1, "Princípios"],
          [2, "Legalidade"],
        ],
      ],
      ["Ato administrativo", []],
      ["Licitações", []],
    ]);
  });

  it("nests the codes a notice writes under a named item, as ENEM's skills under an area", () => {
    const groups = groupTopics(
      [
        "Competência de área 1 - Aplicar as tecnologias da comunicação",
        "H1 - Identificar as diferentes linguagens",
        "H2 – Recorrer aos conhecimentos",
        "Competência de área 2 - Conhecer e usar língua estrangeira",
      ].map((name) => ({ name })),
    );

    expect(
      groups.map((group) => [group.text, group.children.map((child) => child.text)]),
    ).toStrictEqual([
      [
        "Competência de área 1 - Aplicar as tecnologias da comunicação",
        ["Identificar as diferentes linguagens", "Recorrer aos conhecimentos"],
      ],
      ["Competência de área 2 - Conhecer e usar língua estrangeira", []],
    ]);
  });

  it("keeps each item's own number or code, for checking the outline against the notice", () => {
    const groups = groupTopics(
      ["5 Pontuação", "5.7. Emprego da crase", "H18 - Relacionar", "Ortografia"].map((name) => ({
        name,
      })),
    );

    expect(
      groups.map((group) => [group.number, group.children.map((child) => child.number)]),
    ).toStrictEqual([
      ["5", ["5.7", "H18"]],
      [null, []],
    ]);
  });

  it("takes a list that starts below the top as its own top level", () => {
    const groups = groupTopics(["1.1 Coesão", "1.2 Coerência"].map((name) => ({ name })));

    expect(groups.map((group) => [group.text, group.children.length])).toStrictEqual([
      ["Coesão", 0],
      ["Coerência", 0],
    ]);
  });
});
