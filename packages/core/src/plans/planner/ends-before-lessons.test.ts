import { describe, expect, it } from "vitest";
import { buildPlan } from "./build-plan";
import { listEndsBeforeLessons } from "./ends-before-lessons";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { parsePlanSettings } from "./plan-state";

function filed(key: string, skillId: string, date: string) {
  return {
    chapterId: null,
    key,
    kind: "lesson" as const,
    lessonId: key,
    phase: 1,
    scheduledFor: fromIsoDate(date),
    skillId,
    status: "todo" as const,
  };
}

function skill(skillId: string, phase: number) {
  return { area: null, lessons: 1, name: skillId, phase, skillId, weight: null };
}

describe(listEndsBeforeLessons, () => {
  const end = fromIsoDate("2026-10-18");
  const phaseEnds = new Map([[0, end]]);
  const skillLessons = new Map<string, number>();

  const given = {
    graph: { phases: [], skills: [skill("arrival", 0), skill("renting", 1)] },
    lessons: [],
  };

  it("reads a lesson filed under the next phase by its own skill's phase", () => {
    const items = [filed("a", "arrival", "2026-10-19"), filed("b", "renting", "2026-10-20")];

    expect(
      listEndsBeforeLessons({
        given,
        items,
        laidOut: [{ depth: false, key: "a" }],
        phaseEnds,
        skillLessons,
      }),
    ).toStrictEqual([0]);
  });

  it("leaves a phase's end to a later course level's lesson on its skill", () => {
    const items = [filed("a", "arrival", "2026-10-19")];

    const course = {
      ...given,
      lessons: [
        {
          chapterId: "revisit",
          courseOrder: { phase: 1, position: 4 },
          lessonId: "a",
          minutes: 4,
          skillIds: ["arrival"],
          title: "a",
        },
      ],
    };

    expect(
      listEndsBeforeLessons({
        given: course,
        items,
        laidOut: [{ depth: false, key: "a" }],
        phaseEnds,
        skillLessons,
      }),
    ).toStrictEqual([]);
  });

  it("never counts the end of a phase whose challenge the learner already won", () => {
    const won = {
      chapterId: null,
      key: "boss:0",
      kind: "boss" as const,
      lessonId: null,
      phase: 0,
      scheduledFor: end,
      skillId: null,
      status: "done" as const,
    };

    const items = [won, filed("a", "arrival", "2026-10-19"), filed("b", "renting", "2026-10-20")];

    expect(
      listEndsBeforeLessons({
        given,
        items,
        laidOut: [{ depth: false, key: "a" }],
        phaseEnds,
        skillLessons,
      }),
    ).toStrictEqual([]);
  });

  it("lets depth a plan short on time studies later come after the challenge", () => {
    const items = [filed("a", "arrival", "2026-10-19"), filed("b", "renting", "2026-10-20")];

    expect(
      listEndsBeforeLessons({
        given,
        items,
        laidOut: [{ depth: true, key: "a" }],
        phaseEnds,
        skillLessons,
      }),
    ).toStrictEqual([]);
  });
});

function courseLesson(lessonId: string, skillId: string, phase: number, position: number) {
  return {
    chapterId: phase === 0 ? "beginner" : "intermediate",
    courseOrder: { phase, position },
    lessonId,
    minutes: 8,
    skillIds: [skillId],
    title: lessonId,
  };
}

describe("kept ends when a course's lessons land", () => {
  const today = fromIsoDate("2026-11-02");

  const input = {
    goal: { dailyMinutes: 10, kind: "learn" as const, targetDate: null },
    graph: {
      phases: [
        { milestone: null, name: "Beginner" },
        { milestone: null, name: "Intermediate" },
      ],
      skills: [
        { ...skill("basics", 0), outlined: true },
        { ...skill("written-later", 0), lessons: 2 },
        { ...skill("deeper", 1), outlined: true },
      ],
    },
    items: [],
    lessons: [courseLesson("basics-0", "basics", 0, 0), courseLesson("deeper-0", "deeper", 1, 1)],
    mockMinutes: 150,
    mode: "forced" as const,
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(today) }),
    today,
  };

  it("leaves an earlier level's end to the later level's lessons that land", () => {
    const first = buildPlan(input);
    const beginnerEnd = first.items.find((item) => item.key === "boss:0")?.scheduledFor;

    const landed = Array.from({ length: 6 }, (_, index) =>
      courseLesson(`later-${index}`, "written-later", 1, index + 2),
    );

    const next = buildPlan({
      ...input,
      items: first.items.map((entry, position) => ({ ...entry, id: entry.key, position })),
      lessons: [...input.lessons, ...landed],
      mode: "automatic",
      phaseEnds: new Map([[0, beginnerEnd ?? today]]),
    });

    expect(next.endsBeforeLessons).toStrictEqual([]);
  });
});
