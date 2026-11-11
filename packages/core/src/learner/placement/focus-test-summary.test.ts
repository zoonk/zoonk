import { describe, expect, it } from "vitest";
import { NEW_FOCUS_TEST_RECORD } from "./focus-test-state";
import { getDailyTimeFocus, readFocusSubjects, readTodayFocusTest } from "./focus-test-summary";

const SUMMARY = {
  asked: 0,
  complete: false,
  offerQuestions: 15,
  paceMs: 60_000,
  quick: 24,
  suggested: [],
  total: 24,
  unasked: 24,
};

const SUGGESTED = [
  { areas: ["Licitações", "Contratos"], name: "Direito Administrativo", shortName: "Adm" },
  { areas: ["Redação"], name: "Redação", shortName: null },
];

function examGoal(focusTest: object | null, details: object = {}) {
  return {
    createdAt: new Date("2030-03-01T12:00:00Z"),
    details: { answered: ["target", "level"], ...details, ...(focusTest && { focusTest }) },
    kind: "exam" as const,
  };
}

const DAY_THREE = { localDate: new Date("2030-03-04T00:00:00Z"), timeShort: true, timeZone: "UTC" };

describe(readTodayFocusTest, () => {
  const untouched = { ...NEW_FOCUS_TEST_RECORD, summary: SUMMARY };

  it("suggests the test in the first week of a short plan that hasn't started it", () => {
    expect(readTodayFocusTest({ ...DAY_THREE, goal: examGoal(untouched) })).toStrictEqual({
      minutes: 15,
      questions: 15,
    });
  });

  it.each([
    ["the time covers everything", { ...DAY_THREE, timeShort: false }, untouched, {}],
    ["the first week is over", { ...DAY_THREE, localDate: new Date("2030-03-08") }, untouched, {}],
    [
      "the learner dismissed it",
      DAY_THREE,
      { ...untouched, dismissedAt: "2030-03-02T10:00:00Z" },
      {},
    ],
    ["the test started", DAY_THREE, { ...untouched, startedAt: "2030-03-02T10:00:00Z" }, {}],
    ["there is one subject", DAY_THREE, { ...untouched, summary: { ...SUMMARY, total: 1 } }, {}],
    [
      "nothing can be asked",
      DAY_THREE,
      { ...untouched, summary: { ...SUMMARY, offerQuestions: null } },
      {},
    ],
    ["nothing was kept on the goal yet", DAY_THREE, null, {}],
  ])("says nothing when %s", (_, day, focusTest, details) => {
    expect(readTodayFocusTest({ ...day, goal: examGoal(focusTest, details) })).toBeNull();
  });

  it("says nothing for a goal that isn't an exam", () => {
    const goal = { ...examGoal(untouched), kind: "learn" as const };
    expect(readTodayFocusTest({ ...DAY_THREE, goal })).toBeNull();
  });
});

describe(getDailyTimeFocus, () => {
  const answered = {
    ...NEW_FOCUS_TEST_RECORD,
    summary: { ...SUMMARY, asked: 3, suggested: SUGGESTED },
  };

  const areas = ["Licitações", "Contratos", "Redação"];

  it("focuses what the test suggests when the time is short", () => {
    const goal = examGoal(answered);

    expect(getDailyTimeFocus({ focusAreas: [], goal, timeShort: true })).toStrictEqual(areas);

    expect(readFocusSubjects(goal)).toStrictEqual([
      { name: "Direito Administrativo", shortName: "Adm" },
      { name: "Redação", shortName: null },
    ]);
  });

  it("changes nothing when the time covers everything, or the learner answered nothing", () => {
    const skipped = examGoal({ ...answered, summary: { ...SUMMARY, suggested: SUGGESTED } });

    expect(
      getDailyTimeFocus({ focusAreas: [], goal: examGoal(answered), timeShort: false }),
    ).toBeNull();

    expect(getDailyTimeFocus({ focusAreas: [], goal: skipped, timeShort: true })).toBeNull();
    expect(readFocusSubjects(skipped)).toStrictEqual([]);
  });

  it("removes its own focus once more time covers everything, and leaves one the learner picked", () => {
    const set = examGoal({ ...answered, focus: areas });

    expect(getDailyTimeFocus({ focusAreas: areas, goal: set, timeShort: false })).toStrictEqual([]);
    expect(getDailyTimeFocus({ focusAreas: areas, goal: set, timeShort: true })).toBeNull();

    expect(
      getDailyTimeFocus({ focusAreas: ["Informática"], goal: set, timeShort: true }),
    ).toBeNull();
  });
});
