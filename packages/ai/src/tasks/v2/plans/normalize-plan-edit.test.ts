import { describe, expect, it } from "vitest";
import { normalizePlanEdit } from "./normalize-plan-edit";

const input = {
  areas: ["Mathematics", "Natural sciences", "Língua Portuguesa"],
  goalKind: "exam",
  today: "2026-09-28",
};

function change(attrs: Partial<Parameters<typeof normalizePlanEdit>[0]["raw"]["changes"][number]>) {
  return {
    activities: null,
    areas: null,
    bias: null,
    date: null,
    kind: "setDailyMinutes",
    minutes: null,
    weekdays: null,
    ...attrs,
  };
}

describe(normalizePlanEdit, () => {
  it("leaves language practice out only in a language plan", () => {
    const raw = {
      changes: [
        change({ activities: ["writing", "writing", "grammar"], kind: "skipActivities" }),
        change({ activities: ["listening"], kind: "restoreActivities" }),
      ],
      summary: "No more writing.",
      understood: true,
    };

    expect(
      normalizePlanEdit({ input: { ...input, goalKind: "language" }, raw }).operations,
    ).toStrictEqual([
      { activities: ["writing"], kind: "skipActivities" },
      { activities: ["listening"], kind: "restoreActivities" },
    ]);

    expect(normalizePlanEdit({ input, raw }).understood).toBe(false);
  });

  it("keeps valid changes and matches areas by case and accents", () => {
    const result = normalizePlanEdit({
      input,
      raw: {
        changes: [
          change({ kind: "setWeekdayMinutes", minutes: 20.4, weekdays: [6, 0, 0, 9] }),
          change({ areas: ["mathematics", "lingua portuguesa", "History"], kind: "focusAreas" }),
          change({ bias: "morePractice", kind: "setPracticeBias" }),
        ],
        summary: " Weekends go down to 20 minutes. ",
        understood: true,
      },
    });

    expect(result).toStrictEqual({
      operations: [
        { kind: "setWeekdayMinutes", minutes: 20, weekdays: [0, 6] },
        { areas: ["Mathematics", "Língua Portuguesa"], kind: "focusAreas" },
        { bias: "morePractice", kind: "setPracticeBias" },
      ],
      summary: "Weekends go down to 20 minutes.",
      understood: true,
    });
  });

  it("drops changes the planner can't apply", () => {
    const result = normalizePlanEdit({
      input,
      raw: {
        changes: [
          change({ date: "2026-09-01", kind: "setTargetDate" }),
          change({ date: "2026-02-30", kind: "addLightWeek" }),
          change({ areas: ["History"], kind: "skipAreas" }),
          change({ bias: "harder", kind: "setPracticeBias" }),
          change({ kind: "setWeekdayMinutes", minutes: 30, weekdays: [] }),
        ],
        summary: "Something changed.",
        understood: true,
      },
    });

    expect(result).toStrictEqual({ operations: [], summary: "", understood: false });
  });

  it("clamps minutes, turns a cleared date into no date and keeps a light week from today", () => {
    const result = normalizePlanEdit({
      input,
      raw: {
        changes: [
          change({ kind: "setDailyMinutes", minutes: 600 }),
          change({ kind: "clearTargetDate" }),
          change({ date: "2026-09-28", kind: "addLightWeek" }),
        ],
        summary: "Done.",
        understood: true,
      },
    });

    expect(result.operations).toStrictEqual([
      { kind: "setDailyMinutes", minutes: 240 },
      { kind: "setTargetDate", targetDate: null },
      { kind: "addLightWeek", startDate: "2026-09-28" },
    ]);
  });

  it("returns nothing when the model says the request isn't a plan change", () => {
    const result = normalizePlanEdit({
      input,
      raw: { changes: [change({ minutes: 30 })], summary: "x", understood: false },
    });

    expect(result).toStrictEqual({ operations: [], summary: "", understood: false });
  });
});
