import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import { applyPlanOperations } from "./plan-operations";
import { type PlanState, parsePlanSettings } from "./plan-state";

const TODAY = fromIsoDate("2026-09-28");

function state(attrs: Partial<PlanState["settings"]> = {}): PlanState {
  return {
    goal: { dailyMinutes: 45, targetDate: "2026-11-08" },
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: [
        { area: "Math", lessons: 3, name: "Percentages", phase: 0, skillId: "math", weight: 5 },
        { area: "Biology", lessons: 2, name: "Cells", phase: 0, skillId: "bio", weight: 2 },
      ],
    },
    settings: parsePlanSettings(attrs),
  };
}

function apply(
  operations: Parameters<typeof applyPlanOperations>[0]["operations"],
  from = state(),
) {
  return applyPlanOperations({ operations, state: from, today: TODAY });
}

describe(applyPlanOperations, () => {
  it("makes weekends lighter and keeps the typical day", () => {
    const result = apply([{ kind: "setWeekdayMinutes", minutes: 20, weekdays: [0, 6] }]);

    expect(result).toStrictEqual({
      state: {
        ...state(),
        settings: { ...state().settings, weekdayMinutes: [20, 45, 45, 45, 45, 45, 20] },
      },
    });
  });

  it("turns a day into a rest day, and refuses to rest every day", () => {
    const rest = apply([{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }]);

    expect("state" in rest && rest.state.settings.weekdayMinutes).toStrictEqual([
      0, 45, 45, 45, 45, 45, 45,
    ]);

    expect(
      apply([{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0, 1, 2, 3, 4, 5, 6] }]),
    ).toStrictEqual({ error: "noStudyDays" });
  });

  it("scales the week when the daily time changes, and drops the shape when every day is equal", () => {
    const lighter = state({ weekdayMinutes: [0, 45, 45, 45, 45, 45, 45] });
    const result = apply([{ kind: "setDailyMinutes", minutes: 90 }], lighter);

    expect("state" in result && result.state.goal.dailyMinutes).toBe(90);

    expect("state" in result && result.state.settings.weekdayMinutes).toStrictEqual([
      0, 90, 90, 90, 90, 90, 90,
    ]);

    const even = apply([{ kind: "setWeekdayMinutes", minutes: 45, weekdays: [0] }], lighter);
    expect("state" in even && even.state.settings.weekdayMinutes).toBeNull();
  });

  it("adds a light week of seven days and replaces one it overlaps", () => {
    const first = apply([{ kind: "addLightWeek", startDate: "2026-10-05" }]);

    const second =
      "state" in first
        ? apply([{ kind: "addLightWeek", startDate: "2026-10-08" }], first.state)
        : first;

    expect("state" in second && second.state.settings.lightWeeks).toStrictEqual([
      { endDate: "2026-10-14", startDate: "2026-10-08" },
    ]);

    expect(apply([{ kind: "addLightWeek", startDate: "2026-09-01" }])).toStrictEqual({
      error: "pastDate",
    });
  });

  it("focuses, skips and restores known areas, but never skips everything", () => {
    const focused = apply([{ areas: ["Math"], kind: "focusAreas" }]);
    expect("state" in focused && focused.state.settings.focusAreas).toStrictEqual(["Math"]);

    expect(apply([{ areas: ["History"], kind: "focusAreas" }])).toStrictEqual({
      error: "unknownArea",
    });

    expect(apply([{ areas: ["Math", "Biology"], kind: "skipAreas" }])).toStrictEqual({
      error: "nothingLeft",
    });

    const skipped = apply(
      [{ areas: ["Math"], kind: "skipAreas" }],
      state({ focusAreas: ["Math"] }),
    );

    expect("state" in skipped && skipped.state.settings).toMatchObject({
      focusAreas: [],
      skippedAreas: ["Math"],
    });

    const restored =
      "state" in skipped
        ? apply([{ areas: ["Math"], kind: "restoreAreas" }], skipped.state)
        : skipped;

    expect("state" in restored && restored.state.settings.skippedAreas).toStrictEqual([]);
  });

  it("refuses a target date that isn't in the future", () => {
    expect(apply([{ kind: "setTargetDate", targetDate: "2026-09-28" }])).toStrictEqual({
      error: "pastDate",
    });

    const cleared = apply([{ kind: "setTargetDate", targetDate: null }]);
    expect("state" in cleared && cleared.state.goal.targetDate).toBeNull();
  });

  it("adds a missing skill right before the skill that needs it", () => {
    const result = apply([
      {
        kind: "addSkills",
        skills: [
          { area: null, beforeSkillId: "bio", lessons: 1, name: "Fractions", skillId: "fractions" },
        ],
      },
    ]);

    expect(
      "state" in result && result.state.graph.skills.map((skill) => skill.skillId),
    ).toStrictEqual(["math", "fractions", "bio"]);

    expect("state" in result && result.state.graph.skills[1]).toMatchObject({
      area: "Biology",
      phase: 0,
    });
  });

  it("applies nothing when one operation fails", () => {
    expect(
      apply([
        { kind: "setDailyMinutes", minutes: 30 },
        { areas: ["History"], kind: "skipAreas" },
      ]),
    ).toStrictEqual({ error: "unknownArea" });
  });

  it("moves the week's checkpoint to a later day within a week, replacing an earlier move", () => {
    const moved = apply([{ from: "2026-10-04", kind: "moveWeeklyEvent", to: "2026-10-05" }]);

    expect("state" in moved && moved.state.settings.movedEvents).toStrictEqual([
      { from: "2026-10-04", to: "2026-10-05" },
    ]);

    const again =
      "state" in moved
        ? apply([{ from: "2026-10-04", kind: "moveWeeklyEvent", to: "2026-10-06" }], moved.state)
        : null;

    expect(again && "state" in again && again.state.settings.movedEvents).toStrictEqual([
      { from: "2026-10-04", to: "2026-10-06" },
    ]);
  });

  it("refuses to move a past day, backwards or past the next week", () => {
    expect(
      apply([{ from: "2026-09-27", kind: "moveWeeklyEvent", to: "2026-09-28" }]),
    ).toStrictEqual({ error: "pastDate" });

    expect(
      apply([{ from: "2026-10-04", kind: "moveWeeklyEvent", to: "2026-10-03" }]),
    ).toStrictEqual({ error: "badMove" });

    expect(
      apply([{ from: "2026-10-04", kind: "moveWeeklyEvent", to: "2026-10-12" }]),
    ).toStrictEqual({ error: "badMove" });
  });
});
