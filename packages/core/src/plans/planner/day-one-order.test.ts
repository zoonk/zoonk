import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

/** A Thursday, a month before an ENEM-like exam, as Lucas's first day was. */
const TODAY = fromIsoDate("2026-10-08");
const SKILLS_PER_AREA = 4;
const LESSONS_PER_SKILL = 6;

type AreaSpec = { area: string; outcome?: boolean; phase?: number; weight?: number };

/**
 * ENEM's four parts and its redação, each skill building on the one before it in its part, and
 * exam strategy outside the notice. Linguagens and Matemática weigh a little more on their own, as
 * they did for Lucas once the basics he said he knows were skipped.
 */
const NOTICE_AREAS: AreaSpec[] = [
  { area: "Linguagens", weight: 3.3 },
  { area: "Matemática", weight: 3.3 },
  { area: "Natureza" },
  { area: "Humanas" },
  { area: "Redação", outcome: true },
];

const STRATEGY: AreaSpec = { area: "Estratégia de prova", phase: 2, weight: 3.3 };

function skillsOf({ area, outcome, phase = 0, weight = 3 }: AreaSpec): PlanGraphSkill[] {
  return Array.from({ length: SKILLS_PER_AREA }, (_, index) => ({
    area,
    lessons: LESSONS_PER_SKILL,
    name: `${area} ${index}`,
    outcome,
    phase: phase + Math.floor(index / 2),
    skillId: `${area}-${index}`,
    weight,
  }));
}

function lessonsOf(skill: PlanGraphSkill): PlannerLesson[] {
  return Array.from({ length: LESSONS_PER_SKILL }, (_, index) => ({
    chapterId: skill.skillId,
    lessonId: `${skill.skillId}-${index}`,
    minutes: 4,
    skillIds: [skill.skillId],
    title: `${skill.name} lesson ${index + 1}`,
  }));
}

function enemPlan({
  areas = [...NOTICE_AREAS, STRATEGY],
  knownAreas = new Set(),
  missedSkillIds = new Set(),
}: {
  areas?: AreaSpec[];
  knownAreas?: ReadonlySet<string>;
  missedSkillIds?: ReadonlySet<string>;
} = {}): BuildPlanInput {
  const skills = areas.flatMap((spec) => skillsOf(spec));

  const prerequisites = new Map(
    skills.flatMap((skill) => {
      const index = Number(skill.skillId.split("-").at(-1));
      return index === 0 ? [] : [[skill.skillId, [`${skill.area}-${index - 1}`]] as const];
    }),
  );

  return {
    goal: { dailyMinutes: 180, kind: "exam", targetDate: addDays(TODAY, 31) },
    graph: {
      phases: ["Fundamentos", "Modelos", "Prova"].map((name) => ({ milestone: null, name })),
      skills,
    },
    items: [],
    knownAreas,
    lessons: skills.flatMap((skill) => lessonsOf(skill)),
    missedSkillIds,
    mockMinutes: 330,
    mode: "forced",
    noticeAreas: new Set(NOTICE_AREAS.map((spec) => spec.area)),
    paceFactor: 1,
    prerequisites,
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };
}

/** The areas the plan's first day studies, in the order it gets to them. */
function dayOneAreas(input: BuildPlanInput): string[] {
  const areaOf = new Map(input.graph.skills.map((skill) => [skill.skillId, skill.area ?? ""]));

  const areas = buildPlan(input).items.flatMap((item) =>
    item.kind === "lesson" && item.scheduledFor?.getTime() === TODAY.getTime()
      ? [areaOf.get(item.skillId ?? "") ?? ""]
      : [],
  );

  return [...new Set(areas)];
}

describe("an exam plan's first day", () => {
  // Lucas said he knows Linguagens and Matemática: his first day was those two, Redação and nine
  // exam-strategy lessons, with no Natureza or Humanas until days later.
  it("opens with the parts the learner didn't say they know, then theirs, then what's beyond the notice", () => {
    const areas = dayOneAreas(enemPlan({ knownAreas: new Set(["Linguagens", "Matemática"]) }));

    // The redação comes on the days of its own cadence, apart from this order.
    const parts = areas.filter((area) => area !== "Redação");

    expect(parts.slice(0, 2).toSorted()).toStrictEqual(["Humanas", "Natureza"]);
    expect(parts).not.toContain("Estratégia de prova");
  });

  // Rafaela answered English "I don't know yet" in placement, and English, a later phase of her
  // graph, only joined her study cycle days later.
  it("opens with a part placement found a gap in, whatever its phase", () => {
    const english: AreaSpec = { area: "Inglês", phase: 1 };

    const areas = dayOneAreas(
      enemPlan({
        areas: [...NOTICE_AREAS, english, STRATEGY],
        missedSkillIds: new Set(["Inglês-0"]),
      }),
    );

    expect(areas[0]).toBe("Inglês");
  });
});
