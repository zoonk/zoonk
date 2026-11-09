import { describe, expect, it } from "vitest";
import { type CourseOutlineChapter, toCoursePlanGraph } from "../../goals/_utils/course-plan-graph";
import { buildPlan } from "../planner/build-plan";
import { getShownPhaseEnds } from "../planner/kept-phase-ends";
import { isPhaseDatesMoveWorth } from "../planner/phase-dates-move";
import { fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem } from "../planner/plan-items";
import { parsePlanSettings } from "../planner/plan-state";
import { withCourseLessonOrder } from "./course-lesson-order";

const TODAY = fromIsoDate("2026-11-02");
const revisited = { id: "revisited", name: "Revisited" };
const beginner = { id: "beginner", name: "Beginner" };
const intermediate = { id: "intermediate", name: "Intermediate" };
const advanced = { id: "advanced", name: "Advanced" };
type Skill = typeof revisited;

function chapter(
  chapterId: string,
  level: CourseOutlineChapter["level"],
  lessons: [string, Skill][],
): CourseOutlineChapter {
  return {
    chapterId,
    lessonIds: lessons.map(([id]) => id),
    lessons: lessons.map(([, skill]) => [skill]),
    level,
    position: 0,
    tags: [...new Set(lessons.map(([, skill]) => skill))],
  };
}

const chapters = [
  chapter("beg", "beginner", [
    ["b-0", revisited],
    ["b-1", revisited],
    ["b-2", revisited],
    ["b-3", beginner],
    ["b-4", beginner],
    ["b-5", beginner],
  ]),
  chapter("int", "intermediate", [
    ["i-0", intermediate],
    ["i-1", intermediate],
    ["i-2", revisited],
  ]),
  chapter("adv", "advanced", [["a-0", advanced]]),
];

const graph = toCoursePlanGraph({
  chapters,
  course: { id: "course", language: "en", title: "Course" },
  startChapterId: null,
});

const lessons = withCourseLessonOrder({
  chapters,
  lessons: chapters.flatMap((entry) =>
    entry.lessonIds.map((lessonId, index) => ({
      chapterId: entry.chapterId,
      lessonId,
      minutes: 4,
      skillIds: (entry.lessons[index] ?? []).map((skill) => skill.id),
      title: lessonId,
    })),
  ),
  levels: graph.courseOutline?.levels,
  startChapterId: null,
});

function planCourse({
  items = [],
  phaseEnds,
}: {
  items?: ExistingPlanItem[];
  phaseEnds?: Map<number, Date>;
}) {
  return buildPlan({
    goal: { dailyMinutes: 10, kind: "learn", targetDate: null },
    graph,
    items,
    lessons,
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    phaseEnds,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
    today: TODAY,
  });
}

function refreshAfterDayOne(done: ReadonlySet<string>) {
  const first = planCourse({});

  const saved: ExistingPlanItem[] = first.items.map((item, position) => ({
    chapterId: item.chapterId,
    completedAt: done.has(item.key) ? TODAY : null,
    id: `item-${position}`,
    kind: item.kind,
    lessonId: item.lessonId,
    phase: item.phase,
    position,
    scheduledFor: item.scheduledFor,
    skillId: item.skillId,
    status: done.has(item.key) ? "done" : item.status,
    titleSnapshot: item.titleSnapshot,
  }));

  const ends = (released: Set<number>) =>
    getShownPhaseEnds({ items: saved, phases: first.phases, released });

  return {
    kept: planCourse({ items: saved, phaseEnds: ends(new Set()) }),
    moved: planCourse({ items: saved, phaseEnds: ends(new Set([0])) }),
  };
}

const dateOf = (plan: ReturnType<typeof buildPlan>, key: string) => {
  const scheduledFor = plan.items.find((item) => item.key === key)?.scheduledFor;
  return scheduledFor ? toIsoDate(scheduledFor) : null;
};

describe("a course-start plan whose later level revisits an earlier level's skill", () => {
  it("keeps the earlier level's end for a learner ahead of plan", () => {
    const { kept, moved } = refreshAfterDayOne(
      new Set(["lesson:b-0", "lesson:b-1", "lesson:b-2", "lesson:b-3"]),
    );

    // Four lessons spent today's 10 minutes: only the chapter's next lesson stays on today.
    expect(dateOf(kept, "lesson:b-4")).toBe("2026-11-02");
    expect(dateOf(kept, "lesson:b-5")).toBe("2026-11-04");
    expect(dateOf(kept, "boss:0")).toBe("2026-11-06");
    expect(dateOf(kept, "lesson:i-2")).toBe("2026-11-09");

    expect(kept.endsBeforeLessons).toStrictEqual([]);
    expect(isPhaseDatesMoveWorth({ graph, kept, moved })).toBe(false);
  });
});
