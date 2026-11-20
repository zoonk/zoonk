import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { parsePlanSettings } from "./plan-state";

const TODAY = fromIsoDate("2026-10-08");

/** One area's skills of one weight, in this order: at 15 minutes a day the month can't hold them all. */
const SKILL_LESSONS = [25, 15, 25, 15];

/** At 15 minutes a day this plan opens with S1, at 120 with S0. */
const WRITTEN = "S1-0";

function shortExam({
  dailyMinutes,
  focusAreas = [],
  phases = [0, 0, 0, 0],
  prerequisites = new Map(),
  startLessonId = null,
}: {
  dailyMinutes: number;
  focusAreas?: string[];
  /** Each skill's phase, in `SKILL_LESSONS` order. */
  phases?: number[];
  prerequisites?: ReadonlyMap<string, readonly string[]>;
  startLessonId?: string | null;
}): BuildPlanInput {
  const skills = [
    ...SKILL_LESSONS.map((lessons, index) => ({
      area: "Life",
      lessons,
      phase: phases[index] ?? 0,
      skillId: `S${index}`,
    })),
    ...focusAreas.map((area) => ({ area, lessons: 15, phase: 0, skillId: `${area}-skill` })),
  ].map((skill) => ({ ...skill, name: skill.skillId, weight: 5 }));

  return {
    goal: { dailyMinutes, kind: "exam", targetDate: addDays(TODAY, 30) },
    graph: {
      phases: [
        { milestone: null, name: "Basics" },
        { milestone: null, name: "Exam" },
      ],
      skills,
    },
    items: [],
    lessons: skills.flatMap((skill) =>
      Array.from({ length: skill.lessons }, (_, index) => ({
        chapterId: skill.skillId,
        lessonId: `${skill.skillId}-${index}`,
        minutes: 5,
        skillIds: [skill.skillId],
        title: `${skill.name} ${index}`,
      })),
    ),
    mockMinutes: 0,
    mode: "forced",
    noticeAreas: new Set(["Life", ...focusAreas]),
    paceFactor: 1,
    prerequisites,
    readiness: new Map(),
    settings: parsePlanSettings({ focusAreas, startDate: toIsoDate(TODAY) }),
    startLessonId,
    today: TODAY,
  };
}

function listLessons(input: BuildPlanInput): string[] {
  return buildPlan(input).items.flatMap((item) =>
    item.kind === "lesson" && item.lessonId ? [item.lessonId] : [],
  );
}

describe("the lesson written to open the plan", () => {
  it("stays first once a longer day reorders the plan, which covers the same lessons", () => {
    expect(listLessons(shortExam({ dailyMinutes: 15 }))[0]).toBe(WRITTEN);

    const reordered = listLessons(shortExam({ dailyMinutes: 120 }));
    const kept = listLessons(shortExam({ dailyMinutes: 120, startLessonId: WRITTEN }));

    expect(reordered[0]).not.toBe(WRITTEN);
    expect(kept[0]).toBe(WRITTEN);
    expect(kept.toSorted()).toStrictEqual(reordered.toSorted());
  });

  it("never jumps its own skill's earlier lessons", () => {
    const lessons = listLessons(shortExam({ dailyMinutes: 120, startLessonId: "S0-3" }));

    expect(lessons.slice(0, 4)).toStrictEqual(["S0-0", "S0-1", "S0-2", "S0-3"]);
  });

  it("never jumps an earlier phase", () => {
    const lessons = listLessons(
      shortExam({ dailyMinutes: 120, phases: [0, 0, 1, 1], startLessonId: "S2-0" }),
    );

    expect(lessons[0]).toBe("S0-0");
  });

  it("comes after a skill it builds on", () => {
    const lessons = listLessons(
      shortExam({
        dailyMinutes: 120,
        prerequisites: new Map([["S1", ["S0"]]]),
        startLessonId: WRITTEN,
      }),
    );

    expect(lessons[0]).toBe("S0-0");
  });

  it("comes after the area the learner chose to focus on", () => {
    const lessons = listLessons(
      shortExam({ dailyMinutes: 120, focusAreas: ["Earth"], startLessonId: WRITTEN }),
    );

    expect(lessons[0]).toBe("Earth-skill-0");
  });
});
