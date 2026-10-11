import { describe, expect, it } from "vitest";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { weighGraphByTopicFrequency } from "./topic-weights";

/** A Wednesday, a few weeks before an ENEM-like exam: too little time for every topic's core. */
const TODAY = fromIsoDate("2026-10-07");

function skill(
  skillId: string,
  attrs: Pick<PlanGraphSkill, "area" | "phase" | "weight"> & Partial<PlanGraphSkill>,
): PlanGraphSkill {
  return { lessons: 30, name: skillId, ...attrs, skillId };
}

/**
 * Natural sciences' skills run over four phases, the ones the exam asks most (genetics, organic chemistry,
 * circuits) in later phases than ones it asks little (units of measure past what circuits need,
 * gravitation); human sciences share the days.
 */
function examInput(): BuildPlanInput {
  const natureza = [
    skill("units", { area: "Natureza", phase: 0, weight: 2 }),
    skill("cells", { area: "Natureza", phase: 0, weight: 3 }),
    skill("circuits", { area: "Natureza", phase: 1, weight: 4 }),
    skill("heat", { area: "Natureza", phase: 1, weight: 2 }),
    skill("genetics", { area: "Natureza", phase: 2, weight: 5 }),
    skill("optics", { area: "Natureza", phase: 2, weight: 2 }),
    skill("organic", { area: "Natureza", phase: 3, weight: 5 }),
    skill("gravitation", { area: "Natureza", phase: 3, weight: 1 }),
  ];

  const humanas = ["history", "geography", "sociology", "philosophy"].map((id, index) =>
    skill(id, { area: "Humanas", phase: index % 2, weight: 3 }),
  );

  return {
    goal: { dailyMinutes: 37, kind: "exam", targetDate: addDays(TODAY, 30) },
    graph: {
      phases: ["Base", "Core", "Depth", "Review"].map((name) => ({ milestone: null, name })),
      skills: [...natureza, ...humanas],
    },
    items: [],
    lessons: [],
    mockMinutes: 330,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map([
      ["circuits", ["units"]],
      ["genetics", ["cells"]],
    ]),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };
}

/** Natural sciences' skills all weighed alike by the graph, each teaching one of the notice's topics. */
function evenInput(): BuildPlanInput {
  const input = examInput();

  return {
    ...input,
    graph: {
      ...input.graph,
      skills: input.graph.skills.map((graphSkill) => ({
        ...graphSkill,
        topics: [`Topic of ${graphSkill.skillId}`],
        weight: 3,
      })),
    },
  };
}

/** Every skill weighed alike, so only the focus tells natural sciences' apart. */
function focusInput(settings: Record<string, unknown>): BuildPlanInput {
  const input = examInput();

  return {
    ...input,
    goal: { ...input.goal, dailyMinutes: 22 },
    graph: {
      ...input.graph,
      skills: input.graph.skills.map((graphSkill) => ({ ...graphSkill, weight: 3 })),
    },
    settings: parsePlanSettings({ ...settings, startDate: toIsoDate(TODAY) }),
  };
}

/** An area's weight in all: its skills' weights by their size. */
function areaMass(skills: readonly PlanGraphSkill[], area: string): number {
  return skills
    .filter((item) => item.area === area)
    .reduce((sum, item) => sum + (item.weight ?? 0) * item.lessons, 0);
}

describe("an exam plan whose time doesn't fit every topic's core", () => {
  it("leaves out the topics the exam asks least in each subject, whatever their phase", () => {
    const plan = buildPlan(examInput());
    const waiting = new Set(plan.waitingSkillIds);

    // Some of natural sciences waits: the least asked of it, never what's asked most or what that needs.
    expect(["heat", "optics", "gravitation"].some((id) => waiting.has(id))).toBe(true);

    expect(
      ["units", "cells", "circuits", "genetics", "organic"].filter((id) => waiting.has(id)),
    ).toStrictEqual([]);
  });
});

describe("an exam plan short on time with a chapter in progress", () => {
  it("never leaves out the rest of the chapter the learner is in, even of a topic asked least", () => {
    // Gravitation is the topic the time leaves out first; the learner finished the first lesson
    // of its chapter (a focus took them there), so its next lessons still come.
    const chapter = Array.from({ length: 6 }, (_, index) => ({
      chapterId: "gravity",
      lessonId: `gravity-${index}`,
      minutes: 4,
      skillIds: ["gravitation"],
      title: `Gravity ${index + 1}`,
    }));

    const input = examInput();

    const plan = buildPlan({
      ...input,
      items: chapter.map((row, index) => ({
        chapterId: "gravity",
        completedAt: index === 0 ? TODAY : null,
        id: row.lessonId,
        kind: "lesson" as const,
        lessonId: row.lessonId,
        phase: 3,
        position: index,
        scheduledFor: TODAY,
        skillId: "gravitation",
        status: index === 0 ? ("done" as const) : ("todo" as const),
        titleSnapshot: row.title,
      })),
      lessons: chapter,
    });

    const rest = plan.items.filter((item) => item.key.startsWith("lesson:gravity-"));

    expect(rest.filter((item) => item.status === "todo")).toHaveLength(5);
    expect(rest.every((item) => item.scheduledFor !== null)).toBe(true);
  });
});

describe("an exam's subject whose topics past papers rate", () => {
  const levels = [
    { level: "high" as const, subject: "Natureza", topic: "Topic of genetics" },
    { level: "high" as const, subject: "Natureza", topic: "Topic of organic" },
    { level: "low" as const, subject: "Natureza", topic: "Topic of gravitation" },
    { level: "low" as const, subject: "Natureza", topic: "Topic of optics" },
  ];

  it("weighs a subject's skills by how often their topics are asked, the subject's total kept", () => {
    const { graph } = evenInput();
    const weighed = weighGraphByTopicFrequency({ graph, levels });
    const weightOf = (id: string) => weighed.skills.find((item) => item.skillId === id)?.weight;

    expect(weightOf("genetics")).toBeGreaterThan(weightOf("heat") ?? 0);
    expect(weightOf("heat")).toBeGreaterThan(weightOf("gravitation") ?? 0);
    expect(areaMass(weighed.skills, "Natureza")).toBeCloseTo(areaMass(graph.skills, "Natureza"), 6);

    // Nothing rates human sciences' topics: its weights stay as the graph gave them.
    expect(weighed.skills.filter((item) => item.area === "Humanas")).toStrictEqual(
      graph.skills.filter((item) => item.area === "Humanas"),
    );
  });

  it("leaves out the topics asked least when the time doesn't fit every core", () => {
    const input = evenInput();
    const graph = weighGraphByTopicFrequency({ graph: input.graph, levels });
    const plan = buildPlan({ ...input, graph, topicLevels: levels });
    const waiting = new Set(plan.waitingSkillIds);

    expect(waiting.has("gravitation") || waiting.has("optics")).toBe(true);
    expect(waiting.has("genetics") || waiting.has("organic")).toBe(false);
  });
});

describe("an exam's subject with several skills on one topic", () => {
  it("keeps more of its topics in, each with one core, before a topic gets a second", () => {
    const input = examInput();
    const topicOf: Record<string, string> = { cells: "Ecology", genetics: "Ecology" };

    const graph = {
      ...input.graph,
      skills: input.graph.skills.map((graphSkill) => ({
        ...graphSkill,
        topics: [topicOf[graphSkill.skillId] ?? `Topic of ${graphSkill.skillId}`],
        weight: 3,
      })),
    };

    const levels = [{ level: "high" as const, subject: "Natureza", topic: "Ecology" }];
    const plan = buildPlan({ ...input, graph, topicLevels: levels });
    const waiting = new Set(plan.waitingSkillIds);

    // Ecology, asked most, stays in with one of its two skills; the second waits before any
    // other topic does.
    expect(waiting.has("cells") && waiting.has("genetics")).toBe(false);
    expect(waiting.has("cells") || waiting.has("genetics")).toBe(true);
  });
});

/**
 * Natural sciences with three big topics the exam asks often and four it asks less or that no ranking
 * names, small ones unless `lessons` says otherwise: they cost little, the frequent ones a lot.
 * The default time fits the frequent ones' cores, not every core.
 */
function frequencyInput({
  dailyMinutes = 20,
  lessons = {},
}: { dailyMinutes?: number; lessons?: Record<string, number> } = {}): BuildPlanInput {
  const input = examInput();
  const big = ["mechanics", "heat", "electricity"];
  const small = ["taxonomy", "evolution", "water", "optics"];

  const natureza = [...big, ...small].map((id) =>
    skill(id, {
      area: "Natureza",
      lessons: lessons[id] ?? (big.includes(id) ? 30 : 6),
      phase: 0,
      topics: [`Topic of ${id}`],
      weight: 3,
    }),
  );

  const humanas = input.graph.skills.filter((item) => item.area === "Humanas");

  const levels: TopicLevel[] = [
    ...big.map((id) => ({ level: "high" as const, subject: "Natureza", topic: `Topic of ${id}` })),
    { level: "medium", subject: "Natureza", topic: "Topic of taxonomy" },
    { level: "low", subject: "Natureza", topic: "Topic of optics" },
  ];

  return {
    ...input,
    goal: { ...input.goal, dailyMinutes },
    graph: weighGraphByTopicFrequency({
      graph: { ...input.graph, skills: [...natureza, ...humanas] },
      levels,
    }),
    prerequisites: new Map(),
    topicLevels: levels,
  };
}

/** The skills with any of their lessons in the plan, so the topics they teach are in it. */
function plannedSkills(plan: ReturnType<typeof buildPlan>): Set<string> {
  return new Set(plan.skillMinutes.filter((item) => item.covered > 0).map((item) => item.skillId));
}

/** The minutes the plan gives these skills. */
function plannedMinutes(plan: ReturnType<typeof buildPlan>, skillIds: readonly string[]): number {
  return plan.skillMinutes
    .filter((item) => skillIds.includes(item.skillId))
    .reduce((sum, item) => sum + item.covered, 0);
}

describe("an exam's subject whose time doesn't fit every topic's core", () => {
  it("never leaves out a topic asked often while one asked less, or unranked, stays", () => {
    const planned = plannedSkills(buildPlan(frequencyInput()));

    // Each frequent topic is in (one may fit in part); none asked less is while one waits.
    expect(["mechanics", "heat", "electricity"].filter((id) => !planned.has(id))).toStrictEqual([]);

    expect(
      ["taxonomy", "evolution", "water", "optics"].filter((id) => planned.has(id)),
    ).toStrictEqual([]);
  });

  it("gives a part the learner focuses on more time and keeps the rest's frequent topics", () => {
    const input = frequencyInput({ dailyMinutes: 27, lessons: { evolution: 30, taxonomy: 30 } });
    const biology = ["taxonomy", "evolution"];

    const focused = buildPlan({
      ...input,
      settings: parsePlanSettings({
        focusAreas: ["Natureza"],
        focusParts: [{ area: "Natureza", name: "Biologia", skillIds: biology }],
        startDate: toIsoDate(TODAY),
      }),
    });

    const planned = plannedSkills(focused);

    // "More biology, less physics": physics keeps its frequent topics, biology gets the time.
    expect(["mechanics", "heat", "electricity"].filter((id) => !planned.has(id))).toStrictEqual([]);

    expect(plannedMinutes(focused, biology)).toBeGreaterThan(
      plannedMinutes(buildPlan(input), biology),
    );
  });
});

describe("an exam's subject whose time fits every core and some depth", () => {
  it("cuts the depth of the topics asked least first", () => {
    // Every topic the same size: the time fits every core and part of the depth.
    const input = frequencyInput({
      dailyMinutes: 40,
      lessons: { evolution: 30, optics: 30, taxonomy: 30, water: 30 },
    });

    const plan = buildPlan(input);

    const share = (id: string) => {
      const entry = plan.skillMinutes.find((item) => item.skillId === id);
      return entry ? entry.covered / entry.total : 0;
    };

    const frequent = ["mechanics", "heat", "electricity"].map((id) => share(id));
    const least = share("optics");

    // Optics, asked least, keeps its core and no more while a topic asked most misses depth.
    expect(least).toBeGreaterThan(0);
    expect(Math.min(...frequent)).toBeGreaterThan(least);
    expect(least < 0.5 || frequent.every((value) => value === 1)).toBe(true);
  });
});

/** Placement: a solid answer on mechanics, a wrong one on taxonomy. */
function placedInput(dailyMinutes: number): BuildPlanInput {
  return {
    ...frequencyInput({ dailyMinutes }),
    knownSkillIds: new Set(["mechanics"]),
    missedSkillIds: new Set(["taxonomy"]),
    readiness: new Map([
      [
        "mechanics",
        { reps: 1, retrievabilityAtTarget: 0.6, stability: 4, state: "learning" as const },
      ],
      [
        "taxonomy",
        { reps: 1, retrievabilityAtTarget: 0.05, stability: 0.2, state: "learning" as const },
      ],
    ]),
  };
}

describe("an exam's subject the learner already knows part of", () => {
  it("leaves out a frequent topic they showed they know before a gap asked less", () => {
    const planned = plannedSkills(buildPlan(placedInput(22)));

    expect(planned.has("taxonomy")).toBe(true);
    expect(planned.has("mechanics")).toBe(false);
    expect(planned.has("heat") && planned.has("electricity")).toBe(true);
  });

  it("never keeps what they know while a gap waits, whatever their time", () => {
    for (const dailyMinutes of [15, 20, 22, 25, 30]) {
      const planned = plannedSkills(buildPlan(placedInput(dailyMinutes)));
      expect(planned.has("taxonomy") || !planned.has("mechanics")).toBe(true);
    }
  });
});

/**
 * ENEM's natural sciences as its notice groups them (physics, chemistry, biology): physics and chemistry with
 * big topics asked most, and biology whose most asked topic, ecology, builds on cells, so bringing
 * it in costs the most. The time fits a few of their cores, not every one.
 */
function partsInput({
  asked: levelsOf = { cells: "low", genetics: "low" },
}: {
  /** How often the exam asks each skill's topic; the rest are asked most. */
  asked?: Record<string, TopicLevel["level"]>;
} = {}): BuildPlanInput {
  const input = examInput();

  const parts = {
    Biologia: ["cells", "ecology", "genetics"],
    Física: ["mechanics", "electricity", "energy"],
    Química: ["reactions", "materials"],
  };

  const natureza = Object.values(parts)
    .flat()
    .map((id) => skill(id, { area: "Natureza", phase: 0, topics: [`Topic of ${id}`], weight: 3 }));

  const humanas = input.graph.skills.filter((item) => item.area === "Humanas");

  const levels: TopicLevel[] = natureza.map((item) => ({
    level: levelsOf[item.skillId] ?? "high",
    subject: "Natureza",
    topic: `Topic of ${item.skillId}`,
  }));

  return {
    ...input,
    goal: { ...input.goal, dailyMinutes: 30 },
    graph: weighGraphByTopicFrequency({
      graph: { ...input.graph, skills: [...natureza, ...humanas] },
      levels,
    }),
    prerequisites: new Map([["ecology", ["cells"]]]),
    topicLevels: levels,
  };
}

describe("an exam's subject whose notice groups its topics in parts", () => {
  /*
   * The owner's rule for a plan short on time: every topic's core before any depth, topics in the
   * order the exam asks them, and cuts from the end of that order. Lucas's 3 hours kept physics'
   * and chemistry's basics, one per part of the subject, and left out ecology, a topic ENEM asks
   * most.
   */
  it("never keeps a topic asked less while one asked most is out, whatever part it's in", () => {
    const input = partsInput({
      asked: { energy: "low", materials: "low", mechanics: "low", reactions: "low" },
    });

    const planned = plannedSkills(buildPlan(input));
    const frequent = ["cells", "ecology", "genetics", "electricity"];
    const askedLess = ["energy", "materials", "mechanics", "reactions"];

    expect(frequent.filter((id) => planned.has(id)).length).toBeGreaterThan(0);

    expect(askedLess.some((id) => planned.has(id)) && frequent.some((id) => !planned.has(id))).toBe(
      false,
    );
  });

  it("keeps a topic asked less only as the base a frequent topic builds on", () => {
    // Cells and genetics are asked least: cells comes in only with ecology, which builds on it, and
    // genetics waits while any topic asked more does.
    const planned = plannedSkills(buildPlan(partsInput()));
    const frequent = ["ecology", "mechanics", "electricity", "energy", "reactions", "materials"];
    const waits = frequent.some((id) => !planned.has(id));

    expect(planned.has("cells")).toBe(planned.has("ecology"));
    expect(planned.has("genetics") && waits).toBe(false);
  });
});

describe("a focus on part of an exam's subject", () => {
  const biology = { area: "Natureza", name: "Biologia", skillIds: ["cells", "genetics"] };

  it("gives the part the learner named the time, not the rest of its subject", () => {
    const whole = buildPlan(focusInput({ focusAreas: ["Natureza"] }));
    const part = buildPlan(focusInput({ focusAreas: ["Natureza"], focusParts: [biology] }));

    // Focused whole, natural sciences' skills are all alike: genetics waits like the rest of the area.
    expect(whole.waitingSkillIds).toContain("genetics");

    // Focused on biology, its skills keep their cores and the rest of natural sciences waits first.
    expect(part.waitingSkillIds).not.toContain("genetics");
    expect(part.waitingSkillIds).not.toContain("cells");
    expect(part.waitingSkillIds).toContain("circuits");
  });
});
