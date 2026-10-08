import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { getExamFormat } from "./exam-format";

const citation = { passage: "…", sourceId: "00000000-0000-4000-8000-000000000000" };

function structureWith(sections: NonNullable<ExamStructure["mock"]>["sections"]): ExamStructure {
  return {
    formats: [{ citation, description: "Redação", kind: "essay", options: null }],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "TRI", method: "itemResponseTheory" },
      sections,
      timeLimitMinutes: null,
      totalQuestions: null,
    },
    rules: [],
    subjects: [],
  };
}

const days = [
  { date: "2026-11-08", label: "1º dia", startTime: "13:30" },
  { date: "2026-11-15", label: "2º dia", startTime: "13:30" },
];

describe(getExamFormat, () => {
  it("groups the notice's sections by day with each day's date and time", () => {
    const format = getExamFormat({
      days,
      structure: structureWith([
        { day: 2, minutes: 300, name: "Ciências da Natureza e Matemática", questions: 90 },
        { day: 1, minutes: 330, name: "Linguagens, Ciências Humanas e redação", questions: 90 },
      ]),
    });

    expect(format).toStrictEqual([
      {
        date: "2026-11-08",
        day: 1,
        minutes: 330,
        parts: [{ name: "Linguagens, Ciências Humanas e redação", questions: 90, written: false }],
      },
      {
        date: "2026-11-15",
        day: 2,
        minutes: 300,
        parts: [{ name: "Ciências da Natureza e Matemática", questions: 90, written: false }],
      },
    ]);
  });

  it("puts unplaced sections on the first day and leaves the time out when a part has none", () => {
    const format = getExamFormat({
      days: days.slice(0, 1),
      structure: structureWith([
        { day: null, kind: "objective", minutes: 240, name: "Prova objetiva", questions: 80 },
        { day: null, kind: "written", minutes: null, name: "Redação", questions: null },
      ]),
    });

    expect(format).toStrictEqual([
      {
        date: "2026-11-08",
        day: 1,
        minutes: null,
        parts: [
          { name: "Prova objetiva", questions: 80, written: false },
          { name: "Redação", questions: null, written: true },
        ],
      },
    ]);
  });

  it("says nothing when the notice doesn't state its sections", () => {
    expect(getExamFormat({ days, structure: null })).toStrictEqual([]);
    expect(getExamFormat({ days, structure: structureWith([]) })).toStrictEqual([]);
  });
});
