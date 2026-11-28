import { describe, expect, it } from "vitest";
import { buildPlan } from "./build-plan";
import { getExamDomainGroups, sizeExamDomains } from "./exam-domain-size";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraph, parsePlanSettings } from "./plan-state";
import { DEFAULT_LESSON_MINUTES, type PlannerLesson } from "./plan-units";

const TODAY = fromIsoDate("2026-10-12");
const MATH = "Math";
const ALGEBRA = "Algebra";
const ADVANCED = "Advanced Math";
const algebraTopics = ["Linear equations", "Linear functions", "Linear inequalities"];
const advancedTopics = ["Nonlinear functions", "Equivalent expressions"];

const groups = [
  { name: ALGEBRA, share: 0.65, topics: algebraTopics },
  { name: ADVANCED, share: 0.35, topics: advancedTopics },
];

const domains = new Map([[MATH, getExamDomainGroups(groups)]]);

const graph: PlanGraph = {
  phases: [{ milestone: null, name: "Solve math problems" }],
  skills: [
    { lessons: 18, skillId: "equations", topic: algebraTopics[0] ?? "" },
    { lessons: 11, skillId: "functions", topic: algebraTopics[1] ?? "" },
    { lessons: 3, outlined: true, skillId: "inequalities", topic: algebraTopics[2] ?? "" },
    { lessons: 4, skillId: "nonlinear", topic: advancedTopics[0] ?? "" },
    { lessons: 4, skillId: "expressions", topic: advancedTopics[1] ?? "" },
  ].map(({ skillId, topic, ...skill }) => ({
    ...skill,
    area: MATH,
    name: topic,
    phase: 0,
    skillId,
    topics: [topic],
    weight: 3,
  })),
};

const lessons: PlannerLesson[] = [
  "equations",
  "equations",
  "inequalities",
  "inequalities",
  "inequalities",
  "nonlinear",
].map((skillId, index) => ({
  chapterId: skillId,
  lessonId: `lesson-${index}`,
  minutes: DEFAULT_LESSON_MINUTES,
  skillIds: [skillId],
  title: `Practice ${skillId} ${index}`,
}));

function totalsOf(value: (skillId: string) => number) {
  const [algebra, advanced] = groups.map((group) =>
    graph.skills
      .filter((skill) => skill.topics?.some((topic) => group.topics.includes(topic)))
      .reduce((sum, skill) => sum + value(skill.skillId), 0),
  );

  return { advanced: advanced ?? 0, algebra: algebra ?? 0 };
}

const sizing = { domains, graph, lessons, settled: new Set<string>() };

describe("an exam plan with official domain shares", () => {
  it.each([
    { days: 50, name: "generous" },
    { days: 5, name: "tight" },
  ])("preserves the shares with a $name deadline", ({ days }) => {
    const targetDate = addDays(TODAY, days);
    const sized = sizeExamDomains(sizing);

    const plan = buildPlan({
      goal: { dailyMinutes: 20, kind: "exam", targetDate },
      graph: sized,
      items: [],
      lessons,
      mockMinutes: 0,
      mode: "forced",
      paceFactor: 1,
      prerequisites: new Map(),
      readiness: new Map(),
      settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
      today: TODAY,
    });

    expect(totalsOf((skillId) => plan.skillLessons.get(skillId) ?? 0)).toStrictEqual({
      advanced: 14,
      algebra: 26,
    });

    const teaching = totalsOf((skillId) =>
      plan.items
        .filter((item) => item.skillId === skillId && item.kind === "lesson")
        .flatMap((item) => [...(plan.lessonRawMinutes.get(item.key) ?? [])])
        .filter(([date]) => date < toIsoDate(targetDate))
        .reduce((sum, [, minutes]) => sum + minutes, 0),
    );

    const total = teaching.advanced + teaching.algebra;
    expect(total).toBeGreaterThan(0);
    expect(Math.abs(teaching.algebra - total * 0.65)).toBeLessThanOrEqual(DEFAULT_LESSON_MINUTES);
    expect(Math.abs(teaching.advanced - total * 0.35)).toBeLessThanOrEqual(DEFAULT_LESSON_MINUTES);
    expect(total < 40 * DEFAULT_LESSON_MINUTES).toBe(days === 5);
  });

  it("keeps authored sizes and settled slots and can replan repeatedly from the saved graph", () => {
    const settled = new Set(["expressions"]);
    const sized = sizeExamDomains({ ...sizing, settled });

    expect(sized.skills.map(({ lessons: count }) => count)).toStrictEqual([14, 9, 3, 10, 4]);
    expect(sizeExamDomains({ ...sizing, graph: sized, settled })).toStrictEqual(sized);
  });

  it("leaves estimates alone when a heading is missing a share or has no graph skills", () => {
    const partial = getExamDomainGroups([groups[0]!, { name: ADVANCED, topics: advancedTopics }]);
    expect(partial).toStrictEqual([]);

    const incomplete = { ...graph, skills: graph.skills.slice(0, 3) };
    expect(sizeExamDomains({ ...sizing, graph: incomplete })).toStrictEqual(incomplete);
  });

  it("gives a skill that spans two headings to the one no other skill covers", () => {
    const [equations, nonlinear] = [graph.skills[0]!, graph.skills[3]!];

    const spanning = {
      ...graph,
      skills: [
        { ...nonlinear, lessons: 1, topics: [algebraTopics[1]!, advancedTopics[0]!] },
        { ...equations, lessons: 19 },
      ],
    };

    const sized = sizeExamDomains({ ...sizing, graph: spanning, lessons: [] });

    expect(sized.skills.map((skill) => [skill.skillId, skill.domain?.name])).toStrictEqual([
      ["nonlinear", ADVANCED],
      ["equations", ALGEBRA],
    ]);
  });
});
