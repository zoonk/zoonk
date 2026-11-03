import { describe, expect, it } from "vitest";
import { type CourseOutlineChapter } from "../../goals/_utils/course-plan-graph";
import { buildPlan } from "../planner/build-plan";
import { addDays, fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { parsePlanSettings } from "../planner/plan-state";
import { type PlannerLesson } from "../planner/plan-units";
import { withCourseLessonOrder } from "./course-lesson-order";

const TODAY = fromIsoDate("2026-11-02");
const TAG = { id: "shared-skill", name: "Shared skill" };

function outlineChapter(
  chapterId: string,
  position: number,
  lessonIds: string[],
): CourseOutlineChapter {
  return {
    chapterId,
    lessonIds,
    lessons: lessonIds.map(() => [TAG]),
    level: "beginner",
    position,
    tags: [TAG],
  };
}

function lesson(lessonId: string, chapterId: string): PlannerLesson {
  return { chapterId, lessonId, minutes: 3, skillIds: [TAG.id], title: lessonId };
}

describe(withCourseLessonOrder, () => {
  it("plans a shared lesson in its place in the chapter the course starts at", () => {
    const lessons = withCourseLessonOrder({
      chapters: [
        outlineChapter("home", 0, ["shared"]),
        outlineChapter("start", 1, ["start-0", "shared", "start-2"]),
      ],
      lessons: [lesson("shared", "home"), lesson("start-0", "start"), lesson("start-2", "start")],
      startChapterId: "start",
    });

    const plan = buildPlan({
      goal: { dailyMinutes: 6, kind: "learn", targetDate: addDays(TODAY, 30) },
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: [
          { area: null, lessons: 3, name: TAG.name, phase: 0, skillId: TAG.id, weight: null },
        ],
      },
      items: [],
      lessons,
      mockMinutes: 150,
      mode: "forced",
      paceFactor: 1,
      prerequisites: new Map(),
      readiness: new Map(),
      settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
      today: TODAY,
    });

    expect(
      plan.items.flatMap((item) =>
        item.kind === "lesson" && item.lessonId
          ? [[item.lessonId, item.chapterId, toIsoDate(item.scheduledFor ?? TODAY)]]
          : [],
      ),
    ).toStrictEqual([
      ["start-0", "start", "2026-11-02"],
      ["shared", "start", "2026-11-02"],
      ["start-2", "start", "2026-11-03"],
    ]);
  });
});
