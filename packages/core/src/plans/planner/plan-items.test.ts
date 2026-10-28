import { describe, expect, it } from "vitest";
import { addDays, fromIsoDate } from "./plan-calendar";
import { type PlannedItem, mergePlanItems } from "./plan-items";

const MONDAY = fromIsoDate("2026-10-19");

function lessonItem(attrs: Partial<PlannedItem> & Pick<PlannedItem, "key" | "phase">): PlannedItem {
  return {
    chapterId: null,
    completedAt: null,
    id: attrs.key,
    kind: "lesson",
    lessonId: attrs.key,
    minutes: 5,
    scheduledFor: MONDAY,
    skillId: null,
    status: "todo",
    titleSnapshot: attrs.key,
    ...attrs,
  };
}

describe(mergePlanItems, () => {
  it("files a weekly challenge under the phase the learner studies, not one done ahead", () => {
    const merged = mergePlanItems({
      events: [
        {
          date: addDays(MONDAY, 6),
          key: "checkpoint:2026-10-25",
          kind: "checkpoint",
          minutes: 10,
          phase: null,
          replacesDay: false,
          title: "Weekly challenge",
        },
      ],
      kept: [
        lessonItem({ completedAt: MONDAY, key: "basics", phase: 0, status: "done" }),
        lessonItem({
          completedAt: MONDAY,
          key: "ahead",
          phase: 3,
          scheduledFor: addDays(MONDAY, 1),
          status: "done",
        }),
      ],
      replaced: [],
      units: [
        {
          area: "",
          chapterId: null,
          date: addDays(MONDAY, 7),
          key: "lesson:next",
          kind: "lesson",
          lessonId: "next",
          minutes: 5,
          phase: 0,
          skillId: null,
          studyMinutes: 10,
          title: "Next",
        },
      ],
    });

    expect(merged.find((item) => item.kind === "checkpoint")?.phase).toBe(0);
  });
});
