import { describe, expect, it } from "vitest";
import { scheduleLearnedOrder } from "./learned-order";
import { addDays, fromIsoDate } from "./plan-calendar";
import { type QueueUnit } from "./plan-units";
import { type PlanDay } from "./schedule-units";

const TODAY = fromIsoDate("2026-10-12");

function unit(key: string, attrs: Pick<QueueUnit, "minutes" | "skillId">): QueueUnit {
  return {
    area: "Law",
    chapterId: null,
    key,
    kind: "lesson",
    lessonId: null,
    phase: 0,
    title: key,
    ...attrs,
  };
}

/** `count` days from today with `minutes` of lesson time each. */
function listDays({ count, minutes }: { count: number; minutes: number }): PlanDay[] {
  return Array.from({ length: count }, (_, offset) => ({
    date: addDays(TODAY, offset),
    shape: { events: [], minutes, open: true, phase: null, share: 1 },
  }));
}

describe(scheduleLearnedOrder, () => {
  // The plan with every base's core was laid out from today, while a session's end leaves this
  // week as the learner saw it: with less time than that plan had, following its order cut its
  // last lessons, a Câmara topic asked often, and kept the one asked least.
  it("leaves the cut to the plan's own ranking when a core the order placed doesn't fit", () => {
    const cores = ["rights", "organization", "measures"].map((skillId) =>
      unit(`skill:${skillId}`, { minutes: 5, skillId }),
    );

    const schedule = scheduleLearnedOrder({
      days: listDays({ count: 2, minutes: 5 }),
      order: { dropped: [], placed: cores },
      quickBases: new Set(),
      rest: cores,
    });

    expect(schedule).toBeNull();
  });

  // A Câmara base studied with a quick lesson: the lesson takes its core's place under a key the
  // order never placed, so it read as kept, went after everything and didn't fit, while provisional
  // measures, asked less, kept their lessons.
  it("leaves the cut to the plan's own ranking when a base's quick lesson doesn't fit", () => {
    const measures = unit("skill:measures", { minutes: 6, skillId: "measures" });

    const schedule = scheduleLearnedOrder({
      days: listDays({ count: 2, minutes: 6 }),
      order: {
        dropped: [],
        placed: [unit("skill:procedures", { minutes: 6, skillId: "procedures" }), measures],
      },
      quickBases: new Set(["procedures"]),
      rest: [unit("lesson:procedures-quick", { minutes: 8, skillId: "procedures" }), measures],
    });

    expect(schedule).toBeNull();
  });
});
