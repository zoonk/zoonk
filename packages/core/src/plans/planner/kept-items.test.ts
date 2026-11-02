import { describe, expect, it } from "vitest";
import { countKeptLessons } from "./kept-items";
import { type ExistingPlanItem } from "./plan-items";

function item(attrs: Partial<ExistingPlanItem> & Pick<ExistingPlanItem, "skillId">) {
  return {
    chapterId: null,
    completedAt: null,
    id: crypto.randomUUID(),
    kind: "lesson",
    lessonId: null,
    phase: 0,
    position: 0,
    scheduledFor: new Date("2026-10-16T00:00:00Z"),
    status: "todo",
    titleSnapshot: "Lesson",
    ...attrs,
  } satisfies ExistingPlanItem;
}

describe(countKeptLessons, () => {
  it("never counts lessons set aside for time as held", () => {
    const kept = [
      item({ lessons: 10, skillId: "punctuation", status: "skipped" }),
      item({ lessonId: "spelling-1", skillId: "spelling", status: "done" }),
    ];

    expect(countKeptLessons({ kept, lessons: [], units: new Map() })).toStrictEqual(
      new Map([["spelling", 1]]),
    );
  });
});
