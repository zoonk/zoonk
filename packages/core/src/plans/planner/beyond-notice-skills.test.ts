import { describe, expect, it } from "vitest";
import { chooseBases } from "./base-choices";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

const TODAY = fromIsoDate("2026-10-07");

function skill(
  skillId: string,
  attrs: Pick<PlanGraphSkill, "area" | "lessons" | "weight"> & Partial<PlanGraphSkill>,
): PlanGraphSkill {
  return { name: skillId, phase: 0, ...attrs, skillId };
}

function outline(skillId: string, count: number): PlannerLesson[] {
  return Array.from({ length: count }, (_, index) => ({
    chapterId: `chapter-${skillId}`,
    lessonId: `${skillId}-${index + 1}`,
    minutes: 4,
    skillIds: [skillId],
    title: `${skillId} ${index + 1}`,
  }));
}

function tiInput({ days, minutes }: { days: number; minutes: number }): BuildPlanInput {
  const ti = [
    skill("formats", { area: "TI", lessons: 26, topics: [], weight: 2 }),
    skill("metadata", { area: "TI", lessons: 9, topics: ["7.1 Conceitos de dados"], weight: 3 }),
    skill("office", { area: "TI", lessons: 2, topics: ["1 MSOffice 365"], weight: 2 }),
    skill("internet", { area: "TI", lessons: 2, topics: ["2.1 Internet e intranet"], weight: 2 }),
    skill("security", {
      area: "TI",
      lessons: 2,
      topics: ["4.1 Segurança da informação"],
      weight: 2,
    }),
  ];

  const portuguese = ["reading", "grammar", "writing"].map((id) =>
    skill(id, { area: "Português", lessons: 6, topics: [`Topic of ${id}`], weight: 3 }),
  );

  return {
    goal: { dailyMinutes: minutes, kind: "exam", targetDate: addDays(TODAY, days) },
    graph: { phases: [{ milestone: null, name: "Base" }], skills: [...ti, ...portuguese] },
    items: [],
    lessons: [...outline("formats", 26), ...outline("metadata", 9)],
    mockMinutes: 180,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map([["metadata", ["formats"]]]),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };
}

const ROOMY = { days: 100, minutes: 60 };

function plan(input: BuildPlanInput) {
  return buildPlan(chooseBases(input).input);
}

function lessonsOf(input: BuildPlanInput, skillIds: readonly string[]) {
  return plan(input).items.filter(
    (item) => item.kind === "lesson" && skillIds.includes(item.skillId ?? ""),
  );
}

function positionOf(items: ReturnType<typeof lessonsOf>, skillId: string, which: "first" | "last") {
  const positions = items.flatMap((item, index) => (item.skillId === skillId ? [index] : []));
  return which === "first" ? (positions[0] ?? -1) : (positions.at(-1) ?? -1);
}

const NOTICE_TI = ["metadata", "office", "internet", "security"];

describe("an exam subject with a skill beyond the notice", () => {
  it("opens the subject with the notice's topics", () => {
    const items = lessonsOf(tiInput(ROOMY), ["formats", ...NOTICE_TI]);

    expect(items[0]?.skillId).not.toBe("formats");

    for (const skillId of ["office", "internet", "security"]) {
      expect(positionOf(items, skillId, "last")).toBeLessThan(
        positionOf(items, "formats", "first"),
      );
    }
  });

  it("studies a base beyond the notice as the learner chose, just before the topic that needs it", () => {
    const essential = lessonsOf(tiInput(ROOMY), ["formats", ...NOTICE_TI]);
    const firstMetadata = positionOf(essential, "metadata", "first");

    expect(
      essential.filter((item) => item.skillId === "formats").map((item) => item.lessonId),
    ).toStrictEqual(outline("formats", 9).map((lesson) => lesson.lessonId));

    expect(positionOf(essential, "formats", "last")).toBeLessThan(firstMetadata);

    const input = tiInput(ROOMY);
    const baseChoices = [{ choice: "deep" as const, skillId: "formats" }];
    const settings = { ...input.settings, baseChoices };
    const deep = lessonsOf({ ...input, settings }, ["formats", ...NOTICE_TI]);

    expect(deep.filter((item) => item.skillId === "formats")).toHaveLength(26);
    expect(positionOf(deep, "formats", "last")).toBeLessThan(positionOf(deep, "metadata", "first"));
  });

  it("studies a skill beyond the notice after the notice's topics, whatever its weight", () => {
    const input = tiInput(ROOMY);
    const extra = skill("archiving", { area: "TI", lessons: 6, topics: [], weight: 5 });
    const graph = { ...input.graph, skills: [...input.graph.skills, extra] };
    const lessons = [...input.lessons, ...outline("archiving", 6)];
    const items = lessonsOf({ ...input, graph, lessons }, ["archiving", ...NOTICE_TI]);

    expect(positionOf(items, "archiving", "first")).toBeGreaterThan(
      Math.max(...NOTICE_TI.map((skillId) => positionOf(items, skillId, "last"))),
    );
  });

  it("cuts a base beyond the notice before any topic the notice names, even studied in depth", () => {
    const base = tiInput({ days: 20, minutes: 35 });
    const baseChoices = [{ choice: "deep" as const, skillId: "formats" }];

    const input = {
      ...base,
      settings: { ...base.settings, baseChoices },
      topicLevels: [{ level: "low" as const, subject: "TI", topic: "7.1 Conceitos de dados" }],
    };

    const planned = plan(input).items.filter((item) => item.kind === "lesson");
    const count = (skillId: string) => planned.filter((item) => item.skillId === skillId).length;

    expect(count("formats")).toBeLessThan(26);
    expect(count("formats")).toBeGreaterThanOrEqual(9);
    expect(count("metadata")).toBe(9);
  });

  it("keeps the selected essential base whole before the topic that builds on it", () => {
    const items = lessonsOf(tiInput({ days: 20, minutes: 30 }), ["formats", "metadata"]);

    expect(items.filter((item) => item.skillId === "formats")).toHaveLength(9);
    expect(items.filter((item) => item.skillId === "metadata").length).toBeGreaterThan(3);

    expect(positionOf(items, "formats", "last")).toBeLessThan(
      positionOf(items, "metadata", "first"),
    );
  });
});
