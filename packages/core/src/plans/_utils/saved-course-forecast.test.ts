import { describe, expect, it } from "vitest";
import { getChallengeTimings } from "../../checkpoints/_utils/challenge-timing";
import { fromIsoDate } from "../planner/plan-calendar";
import { parsePlanSettings } from "../planner/plan-state";
import { buildPhaseViews } from "./plan-phase-views";
import { type PlanReadItem } from "./plan-read-projection";
import { type PlanSummary } from "./plan-summary";
import { readSavedCourseForecast } from "./saved-course-forecast";
import { type SavedItemFacts } from "./selected-item-contract";

function item(kind: "lesson" | "boss", phase = 0): PlanReadItem {
  return {
    chapterId: null,
    completedAt: null,
    id: kind,
    kind,
    lessonId: kind === "lesson" ? "lesson" : null,
    minutes: 15,
    phase,
    position: 0,
    scheduledFor: fromIsoDate("2026-11-30"),
    skillId: "skill",
    status: "todo",
    titleSnapshot: kind,
  };
}

const summary = {
  basis: { layoutStudyDay: "2026-11-27" },
  selected: { forecast: { finish: { date: "2026-11-30", precision: "month" } } },
} as PlanSummary;

function course(items: PlanReadItem[], later: boolean, endDate: string) {
  return {
    goal: { dailyMinutes: 45, kind: "learn" as const, targetDate: null },
    items,
    phases: [0, 1].map((index) => ({
      endDate: later && index === 1 ? null : endDate,
      kind: "learn" as const,
      ...(later && index === 1 && { later: true as const }),
      milestone: null,
      minutes: 15,
      name: `${index}`,
      startDate: later && index === 1 ? null : "2026-11-27",
    })),
    state: {
      settings: parsePlanSettings({
        startDate: "2026-11-27",
        weekdayMinutes: [0, 45, 45, 45, 45, 45, 0],
      }),
    },
    today: fromIsoDate("2027-01-06"),
  };
}

function forecast(items: PlanReadItem[], later = false) {
  return readSavedCourseForecast({ context: course(items, later, "2026-11-30"), summary });
}

function readPhaseWithChallenge(items: PlanReadItem[], endDate = "2027-01-08") {
  const context = course(items, false, endDate);
  const saved = readSavedCourseForecast({ context, summary });

  const timings = getChallengeTimings({
    ...context,
    ...saved,
    settings: context.state.settings,
    todayBlocks: [],
  });

  return buildPhaseViews({
    ...context,
    ...saved,
    chapterTitles: new Map(),
    currentPhase: 0,
    goalKind: context.goal.kind,
    skillAreas: new Map(),
    timings,
    upNextItemId: null,
  })[0];
}

describe(readSavedCourseForecast, () => {
  it("keeps a saved finish date when an unwritten phase stays later", () => {
    const saved = forecast([], true);

    expect(saved.finish).toStrictEqual({ date: "2026-11-30", precision: "month" });
    expect(saved.phases[1]).toMatchObject({ endDate: null, later: true, startDate: null });
  });

  it("moves the finish and phase end when only an overdue saved challenge remains", () => {
    const facts = {
      boss: {
        kind: "text",
        minutes: 15,
        questions: 10,
        testedKeys: ["lesson"],
        testedSkillIds: ["skill"],
        waiting: false,
      },
      minutes: 15,
      parts: { checkpoint: 15, practice: 0, unwritten: 0, written: 0 },
      schemaVersion: 1,
      skillIds: ["skill"],
    } satisfies SavedItemFacts;

    const saved = forecast([
      { ...item("lesson"), status: "done" },
      { ...item("boss"), facts },
    ]);

    expect(saved.finish?.date).toBe("2027-01-06");
    expect(saved.phases[0]?.endDate).toBe("2027-01-06");
  });

  it("moves the finish for an overdue legacy challenge without saved facts", () => {
    expect(forecast([item("boss")]).finish?.date).toBe("2027-01-06");
  });

  it("moves a following phase's overdue start with the work before it", () => {
    expect(forecast([item("lesson"), item("boss", 1)]).phases[1]?.startDate).toBe("2027-01-06");
  });

  it("keeps the dates of completed work", () => {
    expect(forecast([{ ...item("boss"), status: "done" }]).finish?.date).toBe("2026-11-30");
  });

  it("moves a future challenge with the lessons the learner still needs", () => {
    const challenge = { ...item("boss"), position: 1, scheduledFor: fromIsoDate("2027-01-08") };

    expect(readPhaseWithChallenge([item("lesson"), challenge])).toMatchObject({
      checkpoint: { date: "2027-01-11", state: "upcoming", when: "date" },
      endDate: "2027-01-11",
    });
  });

  it.each([
    { date: "2027-01-08", endDate: "2027-01-11", position: 0, state: "reached" },
    { date: "2026-11-30", endDate: "2027-01-12", position: 2, state: "past" },
  ])(
    "keeps the timing of a $state challenge when the phase moves",
    ({ date, endDate, position }) => {
      const challenge = { ...item("boss"), position, scheduledFor: fromIsoDate(date) };
      const missed = { ...item("lesson"), position: 1 };
      const checkpoint = { date: "2027-01-07", when: "date" };

      expect(readPhaseWithChallenge([challenge])).toMatchObject({ checkpoint });
      expect(readPhaseWithChallenge([missed, challenge])).toMatchObject({ checkpoint, endDate });

      expect(readPhaseWithChallenge([missed, challenge], "2037-01-02")).toMatchObject({
        checkpoint,
        endDate: null,
        later: true,
      });
    },
  );

  it("shows a future challenge as later when its shifted day exceeds the horizon", () => {
    const challenge = { ...item("boss"), position: 1, scheduledFor: fromIsoDate("2037-01-02") };

    expect(readPhaseWithChallenge([item("lesson"), challenge], "2037-01-01")).toMatchObject({
      checkpoint: { date: null, later: true },
      endDate: "2037-01-02",
    });
  });
});
