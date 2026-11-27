import { describe, expect, it, vi } from "vitest";
import { CASE, TASK, reading } from "./_test-utils/written-reading";
import { applyWrittenGrading, listWrittenGradingInputs } from "./read-written-grading";

vi.mock("server-only", () => ({}));
vi.mock("./read-written-grading.prompt.md", () => ({ default: "Read how answers are marked." }));

const RULE = "A questão valerá 30,00 pontos.";

const GRADING = {
  combination: null,
  conventions: [],
  criteria: [
    {
      awards: [],
      document: 1,
      id: "content",
      parts: [],
      passage: RULE,
      points: 30,
      text: "conteúdo",
      weight: null,
    },
  ],
  deductions: [],
  language: null,
  limits: [],
  rounding: null,
  zeroing: [],
};

describe(listWrittenGradingInputs, () => {
  it("asks about each written task by its position, with what the reading knows of its size", () => {
    expect(listWrittenGradingInputs(reading())).toStrictEqual([
      { description: TASK, id: "2.1", lines: null, points: null, section: "Prova discursiva" },
      { description: CASE, id: "2.2", lines: null, points: null, section: "Prova discursiva" },
    ]);
  });
});

describe(applyWrittenGrading, () => {
  it("gives a task the marking read for it and leaves the others as read", () => {
    const extraction = reading();
    const applied = applyWrittenGrading({ extraction, found: [{ grading: GRADING, task: "2.2" }] });
    const [question, studyCase] = applied.mock?.sections[1]?.tasks ?? [];

    expect(question).toBe(extraction.mock?.sections[1]?.tasks[0]);
    expect(studyCase?.grading).toStrictEqual(GRADING);
  });

  it("keeps the first marking when a task comes back twice", () => {
    const second = { ...GRADING, criteria: [] };

    const applied = applyWrittenGrading({
      extraction: reading(),
      found: [
        { grading: GRADING, task: "2.1" },
        { grading: second, task: "2.1" },
      ],
    });

    expect(applied.mock?.sections[1]?.tasks[0]?.grading).toStrictEqual(GRADING);
  });
});
