import { describe, expect, it } from "vitest";
import { namesMatchAcrossSpellings, toNameWords } from "./name-words";

describe(toNameWords, () => {
  it("keeps the meaningful words of a name, normalized", () => {
    expect(toNameWords("Matemática e suas Tecnologias")).toStrictEqual([
      "matematica",
      "tecnologias",
    ]);
  });
});

describe(namesMatchAcrossSpellings, () => {
  it("matches one word spelled in two languages", () => {
    expect(namesMatchAcrossSpellings("expressão", "expresión")).toBe(true);
    expect(namesMatchAcrossSpellings("interação", "interacción")).toBe(true);
    expect(namesMatchAcrossSpellings("leitura", "lectura")).toBe(true);
    expect(namesMatchAcrossSpellings("orais", "orales")).toBe(true);
  });

  it("keeps different words apart, and short words exact", () => {
    expect(namesMatchAcrossSpellings("Física", "Química")).toBe(false);
    expect(namesMatchAcrossSpellings("escritas", "orales")).toBe(false);
    expect(namesMatchAcrossSpellings("oral", "moral")).toBe(false);
  });

  it("matches a subject named in another language's spelling", () => {
    expect(
      namesMatchAcrossSpellings(
        "Expressão e interação escritas",
        "Expresión e interacción escritas",
      ),
    ).toBe(true);

    expect(namesMatchAcrossSpellings("Compreensão de leitura", "Comprensión de lectura")).toBe(
      true,
    );
  });

  it("needs every word of the shorter name", () => {
    expect(
      namesMatchAcrossSpellings("Expressão e interação escritas", "Expresión e interacción orales"),
    ).toBe(false);

    expect(namesMatchAcrossSpellings("Compreensão de leitura", "Comprensión auditiva")).toBe(false);
  });
});
