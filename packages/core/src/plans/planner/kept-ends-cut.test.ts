import { describe, expect, it } from "vitest";
import { buildSyllabus } from "../../view-models/syllabus/_utils/build-syllabus";
import { isPlanFinished } from "../_utils/plan-end";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { getShownPhaseEnds } from "./kept-phase-ends";
import { addDays, fromIsoDate } from "./plan-calendar";
import { parsePlanSettings } from "./plan-state";

const TODAY = fromIsoDate("2026-09-28");

const SIZES = [8, 8, 8, 4];

const input: BuildPlanInput = {
  goal: { dailyMinutes: 19, kind: "learn", targetDate: addDays(TODAY, 9) },
  graph: {
    phases: SIZES.map((_, index) => ({ milestone: null, name: `Phase ${index + 1}` })),
    skills: SIZES.map((lessons, index) => ({
      area: `Area ${index + 1}`,
      lessons,
      name: `Skill ${index + 1}`,
      phase: index,
      skillId: `skill-${index}`,
      weight: null,
    })),
  },
  items: [],
  lessons: SIZES.flatMap((count, skill) =>
    Array.from({ length: count }, (_, index) => ({
      chapterId: `chapter-${skill}`,
      lessonId: `lesson-${skill}-${index}`,
      minutes: 3,
      skillIds: [`skill-${skill}`],
      title: `Lesson ${skill}.${index}`,
    })),
  ),
  mockMinutes: 150,
  mode: "forced",
  paceFactor: 1,
  prerequisites: new Map(),
  readiness: new Map(),
  settings: parsePlanSettings({ startDate: "2026-09-28" }),
  today: TODAY,
};

function listLessonIds(plan: ReturnType<typeof buildPlan>) {
  return plan.items.flatMap((item) => (item.lessonId ? [item.lessonId] : []));
}

describe("a plan short on time whose phase ends a run keeps", () => {
  const made = buildPlan(input);
  const items = made.items.map((item, position) => ({ ...item, id: item.key, position }));
  const phaseEnds = getShownPhaseEnds({ items, phases: made.phases });

  it.each(["automatic", "forced"] as const)(
    "keeps the lessons its cut left in (%s run)",
    (mode) => {
      expect(listLessonIds(made).length).toBeLessThan(input.lessons.length);

      const next = buildPlan({ ...input, items, mode, phaseEnds });

      expect(listLessonIds(next)).toStrictEqual(listLessonIds(made));
    },
  );
});

describe("a plan short on time, finished", () => {
  const made = buildPlan(input);

  const done = made.items.map((item, position) => ({
    ...item,
    id: item.key,
    position,
    status: "done" as const,
  }));

  it("reads 100% of the lessons it chose", () => {
    const { lessons } = buildSyllabus({
      areaCourses: new Map(),
      chapterTitles: new Map(),
      items: done.filter((item) => item.kind === "lesson" || item.kind === "chapter"),
      knownSkillIds: new Set(),
      notice: null,
      pastBasicsSkillIds: new Set(),
      skills: input.graph.skills.map((skill) => ({ ...skill, area: skill.area ?? "", topics: [] })),
      skippedAreas: [],
    });

    expect(input.lessons).toHaveLength(28);

    expect(
      listLessonIds(buildPlan({ ...input, goal: { ...input.goal, dailyMinutes: 18 } })),
    ).toHaveLength(18);

    expect(
      made.items.filter((item) => item.kind === "boss").map((item) => item.minutes),
    ).toStrictEqual([15, 15, 15, 15]);

    expect(listLessonIds(made)).toHaveLength(19);
    expect(lessons).toStrictEqual({ done: 19, known: 0, total: 19 });

    expect(
      isPlanFinished({
        goalKind: "learn",
        items: done,
        targetDate: input.goal.targetDate ?? null,
        today: TODAY,
      }),
    ).toBe(true);
  });
});
