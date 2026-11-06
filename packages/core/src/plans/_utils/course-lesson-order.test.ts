import { describe, expect, it } from "vitest";
import { type CourseOutlineChapter, toCoursePlanGraph } from "../../goals/_utils/course-plan-graph";
import { buildPlan } from "../planner/build-plan";
import { addDays, fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { parsePlanSettings } from "../planner/plan-state";
import { type PlannerLesson } from "../planner/plan-units";
import { withCourseLessonOrder } from "./course-lesson-order";
import { getPhaseStates } from "./phase-states";

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

describe("a course level whose chapters only repeat earlier skills", () => {
  const skillA = { id: "skill-a", name: "Skill A" };
  const skillB = { id: "skill-b", name: "Skill B" };
  const skillC = { id: "skill-c", name: "Skill C" };

  const chapters: CourseOutlineChapter[] = [
    {
      chapterId: "beg",
      lessonIds: ["b-0", "b-1"],
      lessons: [[skillA], [skillB]],
      level: "beginner",
      position: 0,
      tags: [skillA, skillB],
    },
    {
      chapterId: "int",
      lessonIds: ["i-0"],
      lessons: [[skillA]],
      level: "intermediate",
      position: 0,
      tags: [skillA],
    },
    {
      chapterId: "adv",
      lessonIds: ["a-0"],
      lessons: [[skillC]],
      level: "advanced",
      position: 0,
      tags: [skillC],
    },
  ];

  function planCourseStart(targetDate: Date | null) {
    const graph = toCoursePlanGraph({
      chapters,
      course: { id: "course", language: "en", title: "Course" },
      startChapterId: null,
    });

    const plan = buildPlan({
      goal: { dailyMinutes: 10, kind: "learn", targetDate },
      graph,
      items: [],
      lessons: withCourseLessonOrder({
        chapters,
        lessons: chapters.flatMap((chapter) =>
          chapter.lessonIds.map((lessonId, index) => ({
            chapterId: chapter.chapterId,
            lessonId,
            minutes: 4,
            skillIds: (chapter.lessons[index] ?? []).map((skill) => skill.id),
            title: lessonId,
          })),
        ),
        levels: graph.courseOutline?.levels,
        startChapterId: null,
      }),
      mockMinutes: 150,
      mode: "forced",
      paceFactor: 1,
      prerequisites: new Map(),
      readiness: new Map(),
      settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
      today: TODAY,
    });

    return {
      levels: plan.items.flatMap((item) =>
        item.kind === "lesson" || item.kind === "boss" ? [`${item.key}@${item.phase}`] : [],
      ),
      states: getPhaseStates({
        currentPhase: 0,
        goalKind: "learn",
        items: plan.items,
        phases: plan.phases,
        targetDate,
        today: TODAY,
      }),
    };
  }

  it.each([
    ["with a target date", addDays(TODAY, 60)],
    ["without a target date", null],
  ])("keeps that level's lessons and challenge in it %s", (_mode, targetDate) => {
    expect(planCourseStart(targetDate)).toStrictEqual({
      levels: [
        "lesson:b-0@0",
        "lesson:b-1@0",
        "boss:0@0",
        "lesson:i-0@1",
        "boss:1@1",
        "lesson:a-0@2",
        "boss:2@2",
      ],
      states: ["current", "upcoming", "upcoming"],
    });
  });
});
