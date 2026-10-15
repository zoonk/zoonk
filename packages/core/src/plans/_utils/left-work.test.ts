import { describe, expect, it } from "vitest";
import { type ExistingPlanItem } from "../planner/plan-items";
import { listGivenLessonIds, selectLeftWork } from "./left-work";

const day = (date: string) => new Date(`${date}T00:00:00Z`);
const TODAY = day("2026-10-15");

function item(
  id: string,
  {
    kind = "lesson",
    phase = 0,
    scheduledFor = "2026-10-15",
    status = "todo",
  }: Partial<Pick<ExistingPlanItem, "kind" | "phase" | "status">> & { scheduledFor?: string } = {},
): ExistingPlanItem {
  return {
    chapterId: "chapter",
    completedAt: null,
    id,
    kind,
    lessonId: kind === "boss" ? null : id,
    phase,
    position: 0,
    scheduledFor: day(scheduledFor),
    skillId: "skill",
    status,
    titleSnapshot: id,
  };
}

const select = (items: ExistingPlanItem[], given: string[] = []) =>
  selectLeftWork({ givenLessonIds: new Set(given), items, today: TODAY }).map((left) => left.id);

describe(selectLeftWork, () => {
  it("takes lessons and challenges due before today and still to do, in the plan's order", () => {
    const items = [
      item("late", { scheduledFor: "2026-10-13" }),
      item("done", { scheduledFor: "2026-10-13", status: "done" }),
      item("boss", { kind: "boss", scheduledFor: "2026-10-14" }),
      item("review", { kind: "review", scheduledFor: "2026-10-14" }),
      item("mock", { kind: "mock", scheduledFor: "2026-10-14" }),
      item("today"),
      item("later", { scheduledFor: "2026-10-18" }),
    ];

    expect(select(items)).toStrictEqual(["late", "boss"]);
  });

  it("takes a lesson the last study day gave that the plan has after today, not today", () => {
    const items = [item("today"), item("later", { scheduledFor: "2026-10-18" })];
    expect(select(items, ["today", "later"])).toStrictEqual(["later"]);
  });

  it("leaves a given lesson of a phase the learner hasn't reached where its phase has it", () => {
    const items = [
      item("now", { scheduledFor: "2026-10-16" }),
      item("far", { phase: 3, scheduledFor: "2026-12-01" }),
    ];

    expect(select(items, ["far"])).toStrictEqual([]);
  });
});

describe(listGivenLessonIds, () => {
  it("counts the last study day's lessons as given until today settles them", () => {
    const previous = { lessonIds: ["a", "b"] };

    expect(listGivenLessonIds({ previous, settle: null })).toStrictEqual(new Set(["a", "b"]));

    expect(
      listGivenLessonIds({ previous, settle: { createdAt: TODAY, itemIds: ["a"] } }),
    ).toStrictEqual(new Set());
  });
});
