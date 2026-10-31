import { describe, expect, it } from "vitest";
import { type ExamStructure } from "./blueprint-contract";
import { fitsExamChoice, getExamChoiceFormat, getExamChoiceFormats } from "./exam-choice-format";

const citation = { passage: "From the notice.", sourceId: "notice" };

function structureOf(formats: Partial<ExamStructure["formats"][number]>[]) {
  return {
    formats: formats.map((format) => ({
      citation,
      description: "",
      kind: "multipleChoice" as const,
      options: 4,
      ...format,
    })),
    pastOptions: null,
  };
}

function choiceItem(options: number) {
  return {
    content: { options: Array.from({ length: options }, () => ({ text: "" })) },
    format: "multipleChoice" as const,
  };
}

describe(getExamChoiceFormat, () => {
  it("takes the one-pick format the most parts of the exam ask, not one section's", () => {
    const exam = structureOf([
      { description: "Compare two quantities", sections: ["Quantitative"] },
      { description: "Several answers", options: 3, select: "all" },
      { description: "One answer", options: 5, sections: ["Verbal", "Quantitative"] },
    ]);

    expect(getExamChoiceFormat(exam)).toMatchObject({ description: "One answer", options: 5 });

    const asked = structureOf([
      { options: 5, share: 0.2 },
      { options: 4, share: 0.8 },
    ]);

    expect(getExamChoiceFormat(asked)).toMatchObject({ options: 4 });
  });
});

describe(fitsExamChoice, () => {
  it("fits a bank question to any format the exam answers by picking", () => {
    const choices = getExamChoiceFormats(structureOf([{ options: 4 }, { options: 5 }]));

    expect(fitsExamChoice({ choices, item: choiceItem(4) })).toBe(true);
    expect(fitsExamChoice({ choices, item: choiceItem(5) })).toBe(true);
    expect(fitsExamChoice({ choices, item: choiceItem(3) })).toBe(false);
    expect(fitsExamChoice({ choices, item: { content: {}, format: "trueFalse" } })).toBe(false);
    expect(fitsExamChoice({ choices: [], item: choiceItem(3) })).toBe(true);
  });
});
