import { describe, expect, it } from "vitest";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";
import { type SkillReadiness } from "./skill-order";
import { weighGraphByTopicFrequency } from "./topic-weights";

/** A Wednesday: Pedro's class test on cells is on Friday, and Thursday is its short mock. */
const TODAY = fromIsoDate("2026-10-07");

const TOPICS = {
  membrane: "Membrana plasmática",
  nucleus: "Núcleo",
  organelles: "Organelas",
  prokaryotes: "Procarionte x eucarionte",
  theory: "Teoria celular",
  virus: "Vírus",
} as const;

type TopicId = keyof typeof TOPICS;

/** One skill per heading of his notes, the membrane the biggest of them. */
const SIZES: Record<TopicId, number> = {
  membrane: 3,
  nucleus: 1,
  organelles: 2,
  prokaryotes: 1,
  theory: 1,
  virus: 1,
};

const SKILLS: PlanGraphSkill[] = Object.entries(TOPICS).map(([id, topic]) => ({
  area: "Biologia",
  lessons: SIZES[id as TopicId],
  name: topic,
  phase: 0,
  skillId: id,
  topics: [topic],
  weight: 3,
}));

/** His notes stress the organelles ("CAI MUITO!!"); the teacher announced an essay on osmosis. */
const LEVELS: TopicLevel[] = [
  { level: "high", subject: "Biologia", topic: TOPICS.organelles },
  { level: "high", subject: "Biologia", topic: TOPICS.membrane },
];

const LESSONS: PlannerLesson[] = SKILLS.flatMap((skill) =>
  Array.from({ length: skill.lessons }, (_, index) => ({
    chapterId: "cells",
    lessonId: `${skill.skillId}-${index}`,
    minutes: skill.skillId === "membrane" ? 6 : 4,
    skillIds: [skill.skillId],
    title: `${skill.name} ${index + 1}`,
  })),
);

/** Answered right once in placement: he recalls it for a few days. */
const RIGHT: SkillReadiness = {
  reps: 1,
  retrievabilityAtTarget: 0.8,
  stability: 3,
  state: "learning",
};

/** Answered wrong in placement. */
const WRONG: SkillReadiness = {
  reps: 2,
  retrievabilityAtTarget: 0.1,
  stability: 0.2,
  state: "learning",
};

function classTest({
  dailyMinutes,
  levels = [],
}: {
  dailyMinutes: number;
  levels?: TopicLevel[];
}): BuildPlanInput {
  const graph = { phases: [{ milestone: null, name: "Células" }], skills: SKILLS };

  return {
    goal: { dailyMinutes, kind: "exam", targetDate: addDays(TODAY, 2) },
    graph: weighGraphByTopicFrequency({ graph, levels }),
    items: [],
    lessons: LESSONS,
    missedSkillIds: new Set(["membrane", "virus"]),
    mockMinutes: 30,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map([
      ["membrane", WRONG],
      ["nucleus", RIGHT],
      ["prokaryotes", RIGHT],
      ["virus", WRONG],
    ]),
    settings: parsePlanSettings({ shortMockMinutes: 30, startDate: toIsoDate(TODAY) }),
    today: TODAY,
    topicLevels: levels,
  };
}

/** The skills with any of their lessons in the plan, so the topics they teach are in it. */
function plannedSkills(plan: ReturnType<typeof buildPlan>): Set<string> {
  return new Set(plan.skillMinutes.filter((item) => item.covered > 0).map((item) => item.skillId));
}

describe("a class test whose days don't fit every topic", () => {
  it("keeps the topics the learner got wrong before the ones they showed they know", () => {
    // The membrane takes the most time: ranked by topics per minute, it was the one cut.
    const plan = buildPlan(classTest({ dailyMinutes: 30 }));
    const planned = plannedSkills(plan);

    expect(planned.has("membrane") && planned.has("virus")).toBe(true);
    expect(plan.waitingSkillIds).toStrictEqual(expect.arrayContaining(["nucleus", "prokaryotes"]));
  });

  it("never leaves a gap out while something the learner knows is in", () => {
    for (const dailyMinutes of [10, 15, 20, 25, 30]) {
      const planned = plannedSkills(buildPlan(classTest({ dailyMinutes })));
      const gapsOut = ["membrane", "virus"].filter((id) => !planned.has(id));
      const knownIn = ["nucleus", "prokaryotes"].filter((id) => planned.has(id));

      expect(gapsOut.length === 0 || knownIn.length === 0).toBe(true);
    }
  });

  it("keeps what placement found missing before what the material stresses, at any level", () => {
    // The organelles "CAI MUITO!!" but nobody asked him about them; he missed the virus question.
    const short = plannedSkills(buildPlan(classTest({ dailyMinutes: 20, levels: LEVELS })));

    expect([...short].toSorted()).toStrictEqual(["membrane", "virus"]);

    const plan = buildPlan(classTest({ dailyMinutes: 30, levels: LEVELS }));
    const planned = plannedSkills(plan);

    expect(planned.has("membrane") && planned.has("organelles")).toBe(true);
    expect(plan.waitingSkillIds).toStrictEqual(expect.arrayContaining(["nucleus", "prokaryotes"]));
  });
});

/**
 * Pedro's class test in persona pass 7: his notes became eight skills, placement found two gaps
 * (osmosis, on the passive transport skill, and the organelles' roles), tested out three skills
 * and answered the other three right once. His teacher announced a table of the organelles and an
 * essay on osmosis. At 30 minutes a day the plan kept the virus lesson he had answered right and
 * cut "Osmose em células animais e vegetais", the lesson on what he missed.
 */
describe("Pedro's notes at 30 minutes a day", () => {
  const THURSDAY = fromIsoDate("2026-10-08");

  type PedroSkill = { skillId: string; titles: [string, number][]; topics: string[]; weight: number };

  const PEDRO_SPECS: PedroSkill[] = [
    {
      skillId: "theory",
      titles: [["Postulados da teoria celular", 3]],
      topics: ["Teoria celular"],
      weight: 2,
    },
    {
      skillId: "prokaryotes",
      titles: [
        ["Organização estrutural dos procariontes", 3],
        ["Diferenciação entre procariontes e eucariontes", 4],
      ],
      topics: ["Procarionte x eucarionte"],
      weight: 3,
    },
    {
      skillId: "passive",
      titles: [
        ["Estrutura do mosaico fluido e permeabilidade seletiva", 3],
        ["Difusão simples e difusão facilitada", 4],
        ["Osmose em células animais e vegetais", 4],
      ],
      topics: ["Membrana plasmática"],
      weight: 4,
    },
    {
      skillId: "active",
      titles: [
        ["Transporte ativo e bomba de sódio e potássio", 4],
        ["Transporte em bloco por endocitose e exocitose", 3],
      ],
      topics: ["Membrana plasmática"],
      weight: 3,
    },
    {
      skillId: "organelles",
      titles: [
        ["Ribossomos e síntese proteica", 3],
        ["Retículo endoplasmático liso e rugoso", 4],
        ["Mitocôndrias e respiração celular", 4],
      ],
      topics: ["Organelas"],
      weight: 5,
    },
    {
      skillId: "golgi",
      titles: [
        ["Complexo golgiense e digestão intracelular", 4],
        ["Cloroplastos, parede celular e vacúolos vegetais", 4],
      ],
      topics: ["Organelas"],
      weight: 5,
    },
    {
      skillId: "nucleus",
      titles: [["Estrutura do núcleo celular e nucléolo", 4]],
      topics: ["Núcleo"],
      weight: 2,
    },
    {
      skillId: "virus",
      titles: [["Biologia dos vírus e parasitismo intracelular", 3]],
      topics: ["Vírus"],
      weight: 3,
    },
  ];

  const PEDRO_SKILLS: PlanGraphSkill[] = PEDRO_SPECS.map((spec, index) => ({
    area: "Biologia",
    lessons: spec.titles.length,
    name: spec.skillId,
    phase: index < 4 ? 0 : 1,
    skillId: spec.skillId,
    topics: spec.topics,
    weight: spec.weight,
  }));

  const PEDRO_LESSONS: PlannerLesson[] = PEDRO_SPECS.flatMap((skill) =>
    skill.titles.map(([title, minutes]) => ({
      chapterId: "cells",
      lessonId: title,
      minutes,
      skillIds: [skill.skillId],
      title,
    })),
  );

  /** What placement's two right answers settled: the lessons it tested out. */
  const TESTED_OUT = ["theory", "prokaryotes", "active"].map((skillId, position) => ({
    chapterId: null,
    completedAt: THURSDAY,
    id: `tested-${skillId}`,
    kind: "lesson" as const,
    lessonId: null,
    phase: 0,
    position,
    scheduledFor: THURSDAY,
    skillId,
    status: "testedOut" as const,
    titleSnapshot: skillId,
  }));

  /** One right answer in placement: he recalls it for a couple of days. */
  const ONCE_RIGHT: SkillReadiness = {
    reps: 1,
    retrievabilityAtTarget: 0.6,
    stability: 2.3,
    state: "learning",
  };

  /** His notes stress the organelles and the teacher announced questions on two topics. */
  const PEDRO_LEVELS: TopicLevel[] = [
    { level: "high", subject: "Biologia", topic: "Organelas" },
    { level: "high", subject: "Biologia", topic: "Membrana plasmática" },
  ];

  const ANNOUNCED = ["Completar a tabela das organelas", "Dissertativa sobre osmose"];

  function pedroPlan(dailyMinutes: number, announcements: readonly string[] = ANNOUNCED) {
    const graph = {
      phases: [
        { milestone: null, name: "Organização celular e membrana" },
        { milestone: null, name: "Estruturas internas, núcleo e vírus" },
      ],
      skills: PEDRO_SKILLS,
    };

    return buildPlan({
      announcements,
      goal: { dailyMinutes, kind: "exam", targetDate: addDays(THURSDAY, 2) },
      graph: weighGraphByTopicFrequency({ graph, levels: PEDRO_LEVELS }),
      items: TESTED_OUT,
      lessons: PEDRO_LESSONS,
      missedSkillIds: new Set(["passive", "organelles"]),
      mockMinutes: 30,
      mode: "forced",
      paceFactor: 0.98,
      prerequisites: new Map(),
      readiness: new Map([
        ["passive", WRONG],
        ["organelles", WRONG],
        ["golgi", ONCE_RIGHT],
        ["nucleus", ONCE_RIGHT],
        ["virus", ONCE_RIGHT],
      ]),
      settings: parsePlanSettings({ shortMockMinutes: 30, startDate: toIsoDate(THURSDAY) }),
      today: THURSDAY,
      topicLevels: PEDRO_LEVELS,
    });
  }

  function plannedTitles(plan: ReturnType<typeof buildPlan>): string[] {
    return plan.items.flatMap((item) => (item.kind === "lesson" ? [item.titleSnapshot] : []));
  }

  it("keeps the lesson on what he missed and his teacher announced", () => {
    expect(plannedTitles(pedroPlan(30))).toContain("Osmose em células animais e vegetais");
  });

  it("reads no lesson as announced from a word several skills' lessons share", () => {
    expect(plannedTitles(pedroPlan(30, ["Dissertativa sobre a célula"]))).toStrictEqual(
      plannedTitles(pedroPlan(30, [])),
    );
  });

  it("never leaves the announced lesson on his miss out for one he showed he knows", () => {
    const gapCores = [
      "Estrutura do mosaico fluido e permeabilidade seletiva",
      "Osmose em células animais e vegetais",
      "Ribossomos e síntese proteica",
    ];

    for (const dailyMinutes of [20, 30, 40]) {
      const planned = new Set(plannedTitles(pedroPlan(dailyMinutes)));

      const knownIn = PEDRO_LESSONS.filter(
        (lesson) =>
          lesson.skillIds.some((id) => ["golgi", "nucleus", "virus"].includes(id)) &&
          planned.has(lesson.title),
      );

      expect(planned.has("Osmose em células animais e vegetais")).toBe(true);
      expect(knownIn.length === 0 || gapCores.every((title) => planned.has(title))).toBe(true);
    }
  });
});
