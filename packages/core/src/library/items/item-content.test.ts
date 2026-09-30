import { describe, expect, it } from "vitest";
import { parseItemContent } from "./item-content";

function storedOption(text: string, isCorrect = false) {
  return { isCorrect, misconception: isCorrect ? null : "A trap", reason: "Because.", text };
}

describe(parseItemContent, () => {
  it("reads options stored with printed letters without them, in their stored order", () => {
    const content = {
      context: null,
      options: [
        storedOption("D) A perda da função econômica."),
        storedOption("A) A separação entre moradia e trabalho.", true),
        storedOption("C) A distribuição equilibrada dos empregos."),
        storedOption("E) A concentração das moradias."),
        storedOption("B) A substituição dos deslocamentos."),
      ],
      question: "Qual processo o texto descreve?",
    };

    const parsed = parseItemContent({ content, format: "multipleChoice" });

    expect(parsed.format === "multipleChoice" && parsed.content.options).toStrictEqual([
      storedOption("A perda da função econômica."),
      storedOption("A separação entre moradia e trabalho.", true),
      storedOption("A distribuição equilibrada dos empregos."),
      storedOption("A concentração das moradias."),
      storedOption("A substituição dos deslocamentos."),
    ]);
  });
});
