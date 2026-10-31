import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate } from "./plan-calendar";
import { type ExistingPlanItem } from "./plan-items";
import { parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";
import { summarizeSelectedPlan } from "./selected-plan-summary";

const SKILLS = ["a", "b", "c"];
const TODAY = fromIsoDate("2020-09-28");

function input({
  minutes = [3],
  weekdayMinutes = [0, 0, 0, 0, 0, 15, 0],
}: { minutes?: number[]; weekdayMinutes?: number[] } = {}): BuildPlanInput {
  return {
    goal: { dailyMinutes: 15, kind: "learn", targetDate: fromIsoDate("2020-09-29") },
    graph: {
      phases: [{ milestone: null, name: "Shared concepts" }],
      skills: SKILLS.map((skillId) => ({
        area: "Science",
        lessons: minutes.length,
        name: skillId,
        outlined: true,
        phase: 0,
        skillId,
        weight: 1,
      })),
    },
    items: [],
    lessons: minutes.map((value, index) => ({
      chapterId: "shared-chapter",
      lessonId: `shared-${index}`,
      minutes: value,
      skillIds: SKILLS,
      title: `Shared lesson ${index}`,
    })),
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2020-09-27", weekdayMinutes }),
    today: TODAY,
  };
}

function saved({
  lessonId = "shared-0",
  owner,
  status,
}: {
  lessonId?: string;
  owner: string;
  status: "done" | "testedOut";
}): ExistingPlanItem {
  return {
    chapterId: "shared-chapter",
    completedAt: TODAY,
    id: `${lessonId}:${owner}:${status}`,
    kind: "lesson",
    lessonId,
    phase: 0,
    position: 0,
    scheduledFor: TODAY,
    skillId: owner,
    status,
    titleSnapshot: lessonId,
  };
}

function measure(value: BuildPlanInput) {
  const built = buildPlan(value);
  const summary = summarizeSelectedPlan({ built, examSubjects: null, input: value });

  if (!summary.coverage) {
    throw new Error("Expected selected coverage for the dated plan");
  }

  return {
    built,
    coverage: summary.coverage,
    requirement: summary.requirement,
    shares: new Map(
      summary.coverage.skills.map((skill) => [skill.skillId, skill.coveredRaw / skill.requiredRaw]),
    ),
  };
}

describe("selected coverage of shared lessons", () => {
  it.each(SKILLS)("credits only the tested-out owner %s", (owner) => {
    const result = measure({ ...input(), items: [saved({ owner, status: "testedOut" })] });

    expect(result.shares).toStrictEqual(
      new Map(SKILLS.map((skillId) => [skillId, skillId === owner ? 1 : 0])),
    );

    expect(result.coverage.coveredShare).toBeCloseTo(1 / 3);
    expect(result.coverage.fits).toBe(false);
    expect(result.requirement).toStrictEqual({ doneRaw: 0, remainingRaw: 3, totalRaw: 3 });
  });

  it("credits an actual completion to every taught skill and counts its minutes once", () => {
    const result = measure({ ...input(), items: [saved({ owner: "a", status: "done" })] });

    expect(result.shares).toStrictEqual(new Map(SKILLS.map((skillId) => [skillId, 1])));
    expect(result.coverage.coveredShare).toBe(1);
    expect(result.requirement).toStrictEqual({ doneRaw: 3, remainingRaw: 0, totalRaw: 3 });
  });

  it("weights a shared partial allocation by raw minutes for every taught skill", () => {
    const result = measure(input({ minutes: [3, 9], weekdayMinutes: [0, 5, 0, 0, 0, 0, 0] }));

    expect(result.built.items.filter((item) => item.kind === "lesson")).toHaveLength(1);
    expect(result.shares).toStrictEqual(new Map(SKILLS.map((skillId) => [skillId, 0.25])));
    expect(result.coverage.coveredShare).toBe(0.25);
  });

  it("keeps mixed test-out ownership separate from real shared completion minutes", () => {
    const result = measure({
      ...input({ minutes: [3, 9] }),
      items: [
        saved({ owner: "a", status: "testedOut" }),
        { ...saved({ lessonId: "shared-1", owner: "b", status: "done" }), position: 1 },
      ],
    });

    expect(result.shares).toStrictEqual(
      new Map([
        ["a", 1],
        ["b", 0.75],
        ["c", 0.75],
      ]),
    );

    expect(result.coverage.coveredShare).toBeCloseTo(5 / 6);
    expect(result.requirement).toStrictEqual({ doneRaw: 9, remainingRaw: 3, totalRaw: 12 });
  });
});

function writeLessons(skillId: string, count: number): PlannerLesson[] {
  return Array.from({ length: count }, (_, index) => ({
    chapterId: `${skillId}-chapter`,
    lessonId: `${skillId}-${index}`,
    minutes: 3,
    skillIds: [skillId],
    title: `${skillId} ${index}`,
  }));
}

const LANDING: BuildPlanInput = {
  goal: { dailyMinutes: 12, kind: "learn", targetDate: fromIsoDate("2020-11-30") },
  graph: {
    phases: [{ milestone: null, name: "Only" }],
    skills: [
      { area: "First", lessons: 4, name: "first", phase: 0, skillId: "first", weight: 1 },
      { area: "Landed", lessons: 8, name: "landed", phase: 0, skillId: "landed", weight: 1 },
      { area: "Last", lessons: 4, name: "last", phase: 0, skillId: "last", weight: 1 },
    ],
  },
  items: [],
  lessons: [...writeLessons("first", 4), ...writeLessons("last", 4)],
  mockMinutes: 150,
  mode: "forced",
  paceFactor: 1,
  prerequisites: new Map(),
  readiness: new Map(),
  settings: parsePlanSettings({ startDate: "2020-09-28" }),
  today: TODAY,
};

describe("selected coverage of lessons that land in a stand-in's place", () => {
  it.each([8, 4])("counts %i written lessons as covered, as their stand-in was", (written) => {
    const before = measure(LANDING);

    const after = measure({
      ...LANDING,
      items: before.built.items.map((item, position) => ({ ...item, id: item.key, position })),
      landedOnly: true,
      lessons: [...LANDING.lessons, ...writeLessons("landed", written)],
      mode: "automatic",
    });

    const landed = after.built.items.filter((item) => item.skillId === "landed" && item.lessonId);
    expect(landed).toHaveLength(written);

    expect({
      after: after.coverage.coveredShare,
      before: before.coverage.coveredShare,
    }).toStrictEqual({ after: 1, before: 1 });
  });
});

const FOCUS: BuildPlanInput = {
  ...LANDING,
  graph: {
    phases: [{ milestone: null, name: "Only" }],
    skills: [
      { area: "Less", lessons: 6, name: "less", phase: 0, skillId: "less", weight: 1 },
      { area: "More", lessons: 6, name: "more", phase: 0, skillId: "more", weight: 1 },
    ],
  },
  lessons: [...writeLessons("less", 6), ...writeLessons("more", 6)],
};

function isToday(item: { scheduledFor: Date | null }): boolean {
  return item.scheduledFor?.getTime() === TODAY.getTime();
}

describe("selected coverage of the focused lessons today takes", () => {
  it("counts them as covered by today's time", () => {
    const before = measure(FOCUS);
    const shown = before.built.items.map((item, position) => ({ ...item, id: item.key, position }));
    const shownToday = new Set(shown.filter((item) => isToday(item)).map((item) => item.key));

    const after = measure({
      ...FOCUS,
      carryOver: { lessonIds: [], todayExceptAreas: ["Less"] },
      items: shown,
      settings: parsePlanSettings({
        focusAreas: ["More"],
        reducedAreas: ["Less"],
        startDate: "2020-09-28",
      }),
    });

    const taken = new Set(
      after.built.items.flatMap((item) =>
        item.lessonId && isToday(item) && !shownToday.has(item.key) ? [item.lessonId] : [],
      ),
    );

    expect(taken.size).toBeGreaterThan(0);

    expect(
      after.coverage.shortLessons.filter((lesson) => taken.has(lesson.lessonId)),
    ).toStrictEqual([]);
  });
});
