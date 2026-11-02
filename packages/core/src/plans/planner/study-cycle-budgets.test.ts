import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import { type QueueUnit } from "./plan-units";
import { getBudgets, getReserves, isDue } from "./study-cycle-budgets";
import { toLanes } from "./study-cycle-lanes";

const TODAY = fromIsoDate("2026-10-13");

function lesson(key: string, dueBy?: Date): QueueUnit {
  return {
    area: "Math",
    chapterId: "chapter",
    dueBy,
    key,
    kind: "lesson",
    lessonId: key,
    minutes: 3,
    phase: 0,
    skillId: key,
    title: key,
  };
}

function laneFor(units: QueueUnit[]) {
  return toLanes({ joinWindow: 0, prerequisites: new Map(), rates: new Map(), units })[0]!;
}

describe("a chapter's due lesson through scheduling", () => {
  it("uses the earliest pending due lesson after prerequisites reorder the subject", () => {
    const first = lesson("first", TODAY);
    const later = lesson("later", TODAY);
    const lane = laneFor([first, lesson("middle"), later]);
    lane.units = [later, lesson("before-first"), first];

    expect(getBudgets({ chosen: [lane], date: TODAY, left: 0 }).get(lane)).toBe(3);
  });

  it("ignores a due lesson already placed, while reserving time for the next one", () => {
    const placed = lesson("placed", TODAY);
    const next = lesson("next", TODAY);
    const lane = laneFor([placed, lesson("before-next"), next]);
    const other = laneFor([lesson("other")]);
    lane.units.shift();

    expect(getBudgets({ chosen: [lane], date: TODAY, left: 0 }).get(lane)).toBe(6);
    expect(getReserves({ chosen: [other, lane], date: TODAY }).get(other)).toBe(6);

    lane.units = [];
    expect(isDue({ date: TODAY, lane })).toBe(false);
  });

  it("gives no due priority before the shown day or without a dated lesson", () => {
    const lane = laneFor([lesson("next", fromIsoDate("2026-10-14"))]);
    expect(isDue({ date: TODAY, lane })).toBe(false);
    expect(isDue({ date: undefined, lane })).toBe(false);
    expect(isDue({ date: TODAY, lane: laneFor([lesson("undated")]) })).toBe(false);
  });
});
