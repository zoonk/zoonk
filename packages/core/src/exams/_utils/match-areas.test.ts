import { describe, expect, it } from "vitest";
import { matchAreasToSubjects } from "./match-areas";

describe(matchAreasToSubjects, () => {
  it("gives an area to the subject it names in its own words over one it only begins like", () => {
    const subjects = [
      { name: "Linguagens, Códigos e suas Tecnologias" },
      { name: "Língua Espanhola", shortName: "Espanhol" },
      { name: "Matemática e suas Tecnologias" },
    ];

    expect(
      matchAreasToSubjects({ areas: ["Linguagens", "Língua Espanhola", "Matemática"], subjects }),
    ).toStrictEqual(
      new Map([
        ["Linguagens", 0],
        ["Língua Espanhola", 1],
        ["Matemática", 2],
      ]),
    );
  });

  it("still matches an area named with a shortened word when no subject names it in full", () => {
    expect(
      matchAreasToSubjects({
        areas: ["Math"],
        subjects: [{ name: "Languages" }, { name: "Mathematics and its Technologies" }],
      }),
    ).toStrictEqual(new Map([["Math", 1]]));
  });

  it("matches an area the graph wrote in another language's spelling of the subject", () => {
    const subjects = [
      { name: "Comprensión de lectura" },
      { name: "Comprensión auditiva" },
      { name: "Expresión e interacción escritas" },
      { name: "Expresión e interacción orales" },
    ];

    expect(
      matchAreasToSubjects({
        areas: ["Expressão e interação escritas", "Compreensão de leitura", "Comprensión auditiva"],
        subjects,
      }),
    ).toStrictEqual(
      new Map([
        ["Expressão e interação escritas", 2],
        ["Compreensão de leitura", 0],
        ["Comprensión auditiva", 1],
      ]),
    );
  });

  it("leaves out an area two subjects match as well", () => {
    expect(
      matchAreasToSubjects({
        areas: ["Direito"],
        subjects: [{ name: "Direito Civil" }, { name: "Direito Penal" }],
      }),
    ).toStrictEqual(new Map());
  });
});
