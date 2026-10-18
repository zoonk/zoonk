import { describe, expect, it } from "vitest";
import { listExamAnswerFormats } from "./exam-answer-formats";

const citation = { passage: "…", sourceId: "notice" };

const INTEGER = { kind: "integer", places: null } as const;

const SEVERAL_PICKS = {
  citation,
  description: "One or more correct options.",
  kind: "multipleChoice",
  options: 4,
  select: "all",
} as const;

describe(listExamAnswerFormats, () => {
  it("lists the formats beyond one quick pick, once each, a bare numeric one taking any number", () => {
    expect(
      listExamAnswerFormats({
        formats: [
          { citation, description: "One correct option.", kind: "multipleChoice", options: 4 },
          SEVERAL_PICKS,
          {
            citation,
            description: "Integer answer.",
            entry: INTEGER,
            kind: "numeric",
            options: null,
          },
          { citation, description: "Numeric answer.", kind: "numeric", options: null },
          { ...SEVERAL_PICKS, description: "Multiple correct options." },
          { citation, description: "Statements.", kind: "trueFalse", options: null },
        ],
      }),
    ).toStrictEqual([
      { entry: null, format: "multipleChoice", select: "all" },
      { entry: INTEGER, format: "numeric", select: null },
      { entry: { kind: "number", places: null }, format: "numeric", select: null },
    ]);
  });
});
