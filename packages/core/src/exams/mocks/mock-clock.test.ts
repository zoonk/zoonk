import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type MockCandidate, getMockClock, getPlannedItemIds, planMock } from "./mock-plan";

const ENEM: ExamStructure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "itemResponseTheory" },
    sections: [
      { day: 1, minutes: 330, name: "Languages, Humanities and essay", questions: 90 },
      { day: 2, minutes: 300, name: "Natural Sciences and Math", questions: 90 },
    ],
    timeLimitMinutes: null,
    totalQuestions: 180,
  },
  rules: [],
  subjects: [],
};

/** A bank with only `count` questions for day two's areas, fewer than its half day asks. */
function thinBank(count: number): MockCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    answered: false,
    area: "Natural Sciences",
    difficulty: 0,
    itemId: `science-${index}`,
    skillId: `science-skill-${index % 3}`,
  }));
}

// A scheduled mock runs the time its plan funded and shows: a thin bank asks fewer questions in
// that time, and the learner may finish early, but the clock is the exam day's.
describe("a scheduled mock's clock", () => {
  it("is its exam day's real time limit, however few questions the bank has", () => {
    const clock = getMockClock({ day: 2, fullLength: false, structure: ENEM });

    const plan = planMock({
      adaptive: false,
      candidates: thinBank(8),
      clock,
      fullLength: false,
      mockNumber: 1,
      structure: ENEM,
    });

    expect(clock).toBe(150);
    expect(plan.minutes).toBe(150);
    expect(plan.sections.map((section) => section.minutes)).toStrictEqual([150]);

    // It asks the questions it has, no more.
    expect(getPlannedItemIds(plan)).toHaveLength(8);
    expect(plan.sections.map((section) => section.questions)).toStrictEqual([8]);
  });

  it("leaves an anytime mock sized by the questions it asks", () => {
    const plan = planMock({
      adaptive: false,
      candidates: thinBank(8),
      fullLength: false,
      mockNumber: 1,
      structure: ENEM,
    });

    expect(plan.minutes).toBeLessThan(150);
  });
});

/** An exam day of a reading section and a listening one, as English proficiency tests sit them. */
const LISTENING_EXAM: ExamStructure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: [
      { day: 1, minutes: 60, name: "Reading", questions: 40 },
      { day: 1, kind: "listening", minutes: 30, name: "Listening", questions: 40 },
    ],
    timeLimitMinutes: null,
    totalQuestions: 80,
  },
  rules: [],
  subjects: [],
};

function bank(area: string, count: number): MockCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    answered: false,
    area,
    difficulty: 0,
    itemId: `${area}-${index}`,
    skillId: `${area}-skill-${index % 3}`,
  }));
}

describe("a scheduled mock's listening", () => {
  // The bank has recordings for only 5 of its 40 questions: they're what it plays, in its time.
  const recordings = new Map([["Listening", bank("Listening", 5)]]);

  it("runs its section's share of the real exam day, whatever recordings the bank has", () => {
    const clock = getMockClock({ day: 1, fullLength: true, structure: LISTENING_EXAM });

    const plan = planMock({
      adaptive: false,
      candidates: bank("Reading", 40),
      clock,
      fullLength: true,
      listening: recordings,
      mockNumber: 0,
      structure: LISTENING_EXAM,
    });

    expect(clock).toBe(90);
    expect(plan.minutes).toBe(90);

    expect(
      plan.sections.map((section) => [section.name, section.minutes, section.questions]),
    ).toStrictEqual([
      ["Reading", 60, 40],
      ["Listening", 30, 5],
    ]);
  });

  it("leaves an anytime mock's listening sized by its recordings", () => {
    const plan = planMock({
      adaptive: false,
      candidates: bank("Reading", 40),
      fullLength: true,
      listening: recordings,
      mockNumber: 0,
      structure: LISTENING_EXAM,
    });

    expect(plan.sections.find((section) => section.name === "Listening")?.minutes).toBeLessThan(30);
  });
});

/** The minutes a mock's sections add up to: what its sitting stores and its timers run. */
function sumSections(plan: ReturnType<typeof planMock>): number {
  return plan.sections.reduce((total, section) => total + section.minutes, 0);
}

/** An exam day of two objective sections and a written test with a time of its own. */
const TWO_SECTIONS: ExamStructure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: [
      { day: 1, minutes: 60, name: "Mathematics", questions: 40 },
      { day: 1, minutes: 60, name: "Sciences", questions: 40 },
      { day: 1, kind: "written", minutes: 60, name: "Essay", questions: null },
    ],
    timeLimitMinutes: null,
    totalQuestions: 80,
  },
  rules: [],
  subjects: [],
};

// The sections a scheduled mock plays hold its whole clock between them, however the bank and the
// exam's essays fill them: an empty section's time and a written test with no essay to ask go to
// the sections it plays, so the sitting runs the time the plan funded and the learner saw.
describe("a scheduled mock's sections", () => {
  it("hold its whole clock when the bank fills only one of them", () => {
    const clock = getMockClock({ day: 1, fullLength: false, structure: TWO_SECTIONS });

    const plan = planMock({
      adaptive: false,
      candidates: bank("Mathematics", 6),
      clock,
      fullLength: false,
      mockNumber: 0,
      structure: TWO_SECTIONS,
    });

    expect(plan.sections.map((section) => section.questions)).toStrictEqual([6]);
    expect(sumSections(plan)).toBe(clock);
  });

  it("hold the time of a written test it has no essay for", () => {
    const clock = getMockClock({ day: 1, fullLength: true, structure: TWO_SECTIONS });

    const plan = planMock({
      adaptive: false,
      candidates: [...bank("Mathematics", 40), ...bank("Sciences", 40)],
      clock,
      fullLength: true,
      mockNumber: 0,
      structure: TWO_SECTIONS,
    });

    expect(plan.sections.map((section) => section.questions)).toStrictEqual([40, 40]);
    expect(sumSections(plan)).toBe(clock);
  });

  it("hold the listening's time when the bank has no recording for it", () => {
    const clock = getMockClock({ day: 1, fullLength: true, structure: LISTENING_EXAM });

    const plan = planMock({
      adaptive: false,
      candidates: bank("Reading", 40),
      clock,
      fullLength: true,
      mockNumber: 0,
      structure: LISTENING_EXAM,
    });

    expect(plan.sections.map((section) => section.name)).toStrictEqual(["Reading"]);
    expect(sumSections(plan)).toBe(90);
  });

  it("leaves an anytime mock's sections sized by what they ask", () => {
    const plan = planMock({
      adaptive: false,
      candidates: bank("Mathematics", 6),
      fullLength: false,
      mockNumber: 0,
      structure: TWO_SECTIONS,
    });

    expect(sumSections(plan)).toBeLessThan(
      getMockClock({ day: 1, fullLength: false, structure: TWO_SECTIONS }),
    );
  });
});
