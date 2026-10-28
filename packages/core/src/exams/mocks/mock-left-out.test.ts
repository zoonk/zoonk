import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listMockLeftOut } from "./mock-left-out";
import { listMockOptions } from "./mock-options";

const CITATION = { passage: "From the notice.", sourceId: "notice" };

function format(kind: ExamStructure["formats"][number]["kind"]) {
  return { citation: CITATION, description: kind, kind, options: null };
}

const CERTIFICATE: ExamStructure = {
  formats: [format("multipleChoice"), format("essay"), format("oral")],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "scaled" },
    sections: [
      { day: null, kind: "objective", minutes: 60, name: "Reading", questions: 40 },
      { day: null, kind: "listening", minutes: 30, name: "Listening", questions: 40 },
      { day: null, kind: "written", minutes: 60, name: "Writing", questions: null },
      { day: null, kind: "speaking", minutes: 14, name: "Speaking", questions: null },
    ],
    timeLimitMinutes: null,
    totalQuestions: null,
  },
  rules: [],
  subjects: [{ citation: CITATION, name: "English", questions: null, topics: [], weight: null }],
};

describe(listMockLeftOut, () => {
  it("says each part of the exam day a full mock can't ask yet, and the bank's essays it can", () => {
    const [full] = listMockOptions({
      dayInTurn: null,
      essays: [{ area: null, itemId: "essay" }],
      goalAreas: ["English"],
      structure: CERTIFICATE,
    });

    expect(full?.leftOut).toStrictEqual([
      { name: "Listening", part: "listening" },
      { name: "Speaking", part: "speaking" },
    ]);

    expect(full).toMatchObject({ questions: 40, written: ["Writing"] });
  });

  it("says a written part with no essay yet is practiced apart, and formats asked as choice", () => {
    const structure: ExamStructure = {
      ...CERTIFICATE,
      formats: [
        format("multipleChoice"),
        format("numeric"),
        format("shortAnswer"),
        format("practical"),
      ],
      mock: CERTIFICATE.mock && {
        ...CERTIFICATE.mock,
        sections: CERTIFICATE.mock.sections.filter((section) => section.kind !== "listening"),
      },
    };

    expect(
      listMockLeftOut({ asked: [], day: null, kind: "full", structure, typed: [] }).map(
        (part) => part.part,
      ),
    ).toStrictEqual(["speaking", "written", "numeric", "shortAnswer", "practical"]);

    expect(
      listMockLeftOut({ asked: [], day: null, kind: "area", structure, typed: [] }).map(
        (part) => part.part,
      ),
    ).toStrictEqual(["numeric", "shortAnswer", "practical"]);

    expect(
      listMockLeftOut({ asked: [], day: null, kind: "area", structure, typed: ["numeric"] }).map(
        (part) => part.part,
      ),
    ).toStrictEqual(["shortAnswer", "practical"]);
  });

  it("says half of a day leaves its written part to full mocks, even with essays in the bank", () => {
    const [, half] = listMockOptions({
      dayInTurn: null,
      essays: [{ area: null, itemId: "essay" }],
      goalAreas: ["English"],
      structure: CERTIFICATE,
    });

    expect(half?.leftOut).toStrictEqual([
      { name: "Listening", part: "listening" },
      { name: "Speaking", part: "speaking" },
      { name: "Writing", part: "writtenInFull" },
    ]);
  });

  it("says nothing for an exam a mock copies whole", () => {
    const objective: ExamStructure = {
      ...CERTIFICATE,
      formats: [format("multipleChoice")],
      mock: CERTIFICATE.mock && { ...CERTIFICATE.mock, sections: [CERTIFICATE.mock.sections[0]!] },
    };

    expect(
      listMockLeftOut({ asked: [], day: null, kind: "full", structure: objective, typed: [] }),
    ).toStrictEqual([]);
  });
});
