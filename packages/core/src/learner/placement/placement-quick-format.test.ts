import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getPlacementQuickFormat } from "./placement-quick-format";

const CITATION = { passage: "Conforme o edital.", sourceId: "notice" };

type Format = ExamStructure["formats"][number];

function formatOf(kind: Format["kind"], options: number | null = null): Format {
  return { citation: CITATION, description: kind, kind, options };
}

describe(getPlacementQuickFormat, () => {
  it("asks true or false for an exam that judges assertions, like Cebraspe's Certo ou Errado", () => {
    expect(getPlacementQuickFormat({ formats: [formatOf("trueFalse"), formatOf("essay")] })).toBe(
      "trueFalse",
    );
  });

  it("asks multiple choice for an exam with options, whatever else it has", () => {
    expect(
      getPlacementQuickFormat({ formats: [formatOf("essay"), formatOf("multipleChoice", 5)] }),
    ).toBe("multipleChoice");
  });

  it("follows the choice format the notice lists first when it lists both", () => {
    expect(
      getPlacementQuickFormat({ formats: [formatOf("multipleChoice", 4), formatOf("trueFalse")] }),
    ).toBe("multipleChoice");

    expect(
      getPlacementQuickFormat({ formats: [formatOf("trueFalse"), formatOf("multipleChoice", 4)] }),
    ).toBe("trueFalse");
  });

  it("asks multiple choice before the exam's blueprint is known, or when it lists no choice format", () => {
    expect(getPlacementQuickFormat(null)).toBe("multipleChoice");
    expect(getPlacementQuickFormat({ formats: [] })).toBe("multipleChoice");

    expect(getPlacementQuickFormat({ formats: [formatOf("essay"), formatOf("oral")] })).toBe(
      "multipleChoice",
    );
  });
});
