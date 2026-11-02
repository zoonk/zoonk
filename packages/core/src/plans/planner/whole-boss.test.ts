import { describe, expect, it } from "vitest";
import { type QueueUnit } from "./plan-units";
import { placeUnits } from "./schedule-units";
import { placeBoss } from "./whole-boss";

function queueUnit(
  attrs: Partial<QueueUnit> & Pick<QueueUnit, "key" | "kind" | "minutes" | "phase">,
): QueueUnit {
  return { area: "Math", chapterId: null, lessonId: null, skillId: null, title: "", ...attrs };
}

function getDayCapacity({
  cumulative,
  dayIndex,
}: {
  cumulative: readonly number[];
  dayIndex: number;
}) {
  return (cumulative[dayIndex] ?? 0) - (cumulative[dayIndex - 1] ?? 0);
}

describe("a phase's challenge goes on a day with lesson time", () => {
  it("skips a day without any when nothing before it used lesson time yet", () => {
    const cumulative = [10, 10, 20];

    expect(getDayCapacity({ cumulative, dayIndex: 1 })).toBe(0);
    expect(getDayCapacity({ cumulative, dayIndex: 2 })).toBeGreaterThan(0);

    const placed = placeBoss({
      cumulative,
      from: 1,
      previous: null,
      unit: queueUnit({ key: "boss:1", kind: "boss", minutes: 5, phase: 1 }),
      used: 0,
    });

    expect(placed).toMatchObject({ beside: false });
    expect(getDayCapacity({ cumulative, dayIndex: placed?.dayIndex ?? -1 })).toBeGreaterThan(0);
    expect(placed?.dayIndex).toBe(2);
  });

  it("skips a kept phase end's day without any, when a lesson came after that end's challenge", () => {
    const cumulative = [10, 20, 30, 30, 40];

    expect(getDayCapacity({ cumulative, dayIndex: 3 })).toBe(0);
    expect(getDayCapacity({ cumulative, dayIndex: 4 })).toBeGreaterThan(0);

    const placed = placeUnits({
      cumulative,
      units: [
        queueUnit({ heldOn: 3, key: "boss:0", kind: "boss", minutes: 5, phase: 0, startsAt: 10 }),
        queueUnit({
          key: "lesson:one",
          kind: "lesson",
          lessonId: "one",
          minutes: 1,
          phase: 1,
          skillId: "math",
        }),
        queueUnit({ key: "boss:1", kind: "boss", minutes: 5, phase: 1 }),
      ],
    });

    expect(placed.map((item) => item.unit.key)).toStrictEqual(["boss:0", "lesson:one", "boss:1"]);
    expect(placed[0]?.dayIndex).toBe(3);

    const next = placed[2];

    expect(next?.beside).toBe(false);
    expect(getDayCapacity({ cumulative, dayIndex: next?.dayIndex ?? -1 })).toBeGreaterThan(0);
    expect(next?.dayIndex).toBe(4);
  });

  it("comes beside its lessons when they run past the plan's last day", () => {
    const placed = placeUnits({
      cumulative: [10, 20, 30],
      units: [
        queueUnit({
          key: "lesson:one",
          kind: "lesson",
          lessonId: "one",
          minutes: 10,
          phase: 0,
          skillId: "math",
        }),
        queueUnit({
          key: "lesson:two",
          kind: "lesson",
          lessonId: "two",
          minutes: 25,
          phase: 0,
          skillId: "math",
        }),
        queueUnit({ key: "boss:0", kind: "boss", minutes: 5, phase: 0 }),
      ],
    });

    expect(placed[2]).toMatchObject({ beside: true, start: 35 });
  });
});
