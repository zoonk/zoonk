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

/** A skill's lessons as the Library outlined them, one chapter, in order. */
function outline(skillId: string, count: number): PlannerLesson[] {
  return Array.from({ length: count }, (_, index) => ({
    chapterId: `chapter-${skillId}`,
    lessonId: `${skillId}-${index + 1}`,
    minutes: 4,
    skillIds: [skillId],
    title: `${skillId} ${index + 1}`,
  }));
}

/**
 * Rafaela's IT subject: for her role (records area), the graph gave it a skill the notice
 * doesn't name ("formats", 26 lessons, outlined) as the base of one that teaches a notice topic
 * ("metadata"), next to the notice's other topics, two lessons each; Portuguese shares the days.
 */
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

/** Time for everything: 100 days at an hour a day. */
const ROOMY = { days: 100, minutes: 60 };

/** The plan as a re-plan builds it, with each of its bases studied as the learner chose. */
function plan(input: BuildPlanInput) {
  return buildPlan(chooseBases(input).input);
}

/** The plan's lesson items of these skills, in the order the plan studies them. */
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
  // Rafaela's IT day one taught digital-preservation formats, 26 lessons the notice doesn't name,
  // while the topics it names got two lessons each from 12 and 22 Oct.
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

    // Unless the learner chooses otherwise, its core: the first third, as "metadata" needs.
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
    const base = tiInput({ days: 20, minutes: 30 });
    const baseChoices = [{ choice: "deep" as const, skillId: "formats" }];

    const input = {
      ...base,
      settings: { ...base.settings, baseChoices },
      topicLevels: [{ level: "low" as const, subject: "TI", topic: "7.1 Conceitos de dados" }],
    };

    const planned = plan(input).items.filter((item) => item.kind === "lesson");
    const count = (skillId: string) => planned.filter((item) => item.skillId === skillId).length;

    // Short on time, the plan keeps the core "metadata" needs and cuts the rest of "formats" before
    // any of "metadata", a topic the exam asks little.
    expect(count("formats")).toBeLessThan(26);
    expect(count("formats")).toBeGreaterThanOrEqual(9);
    expect(count("metadata")).toBe(9);
  });
});
