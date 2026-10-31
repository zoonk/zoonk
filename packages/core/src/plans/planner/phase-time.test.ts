import { describe, expect, it } from "vitest";
import { placeItemsInPhaseTime } from "./phase-time";
import { fromIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";

function item({
  day,
  kind = "lesson",
  phase,
  status = "todo",
}: {
  day: string;
  kind?: PlannedItem["kind"];
  phase: number;
  status?: PlannedItem["status"];
}): PlannedItem {
  return {
    chapterId: null,
    completedAt: status === "todo" ? null : fromIsoDate(day),
    id: null,
    key: `${kind}:${phase}:${day}`,
    kind,
    lessonId: kind === "lesson" ? `${phase}-${day}` : null,
    minutes: 10,
    phase,
    scheduledFor: fromIsoDate(day),
    skillId: null,
    status,
    titleSnapshot: `${kind} ${phase} ${day}`,
  };
}

describe(placeItemsInPhaseTime, () => {
  it("gives a phase whose work is finished none of the lessons an earlier phase leaves late", () => {
    const items = [
      item({ day: "2026-10-14", phase: 1, status: "testedOut" }),
      item({ day: "2026-12-30", phase: 0 }),
      item({ day: "2026-12-31", kind: "boss", phase: 0 }),
      item({ day: "2027-01-02", phase: 0 }),
      item({ day: "2027-01-03", kind: "checkpoint", phase: 0 }),
      item({ day: "2027-01-04", phase: 2 }),
      item({ day: "2027-01-20", kind: "boss", phase: 2 }),
    ];

    expect(placeItemsInPhaseTime({ items }).map((placed) => placed.phase)).toStrictEqual([
      1, 0, 0, 2, 2, 2, 2,
    ]);
  });

  it("gives a phase still to study the lessons an earlier phase leaves in its time", () => {
    const items = [
      item({ day: "2026-12-30", phase: 0 }),
      item({ day: "2026-12-31", kind: "boss", phase: 0 }),
      item({ day: "2027-01-02", phase: 0 }),
      item({ day: "2027-01-03", phase: 1 }),
      item({ day: "2027-01-04", kind: "boss", phase: 1 }),
      item({ day: "2027-01-05", phase: 0 }),
      item({ day: "2027-01-06", phase: 2 }),
    ];

    expect(placeItemsInPhaseTime({ items }).map((placed) => placed.phase)).toStrictEqual([
      0, 0, 1, 1, 1, 2, 2,
    ]);
  });
});
