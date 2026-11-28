import { checkCoverage } from "@zoonk/ai/tasks/curriculum/coverage-check";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture, skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENGLISH,
  LANGUAGES,
  MATH,
  SPANISH,
  choiceBlueprintFixture,
} from "../../exams/choices/_test-utils/choice-blueprint";
import { repairNoticePlan } from "../../plans/notice-plan-change";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { examStructureSchema } from "../exams/blueprint-contract";
import {
  mockDecision,
  mockSearchTerms,
  mockSearchTermsFor,
  uniqueWord,
} from "../identity/_test-utils/identity-mocks";
import { addCoveredExamSkills } from "./_test-utils/covered-exam-skills";
import {
  loadExamGraphReconcile,
  prepareNoticeGraphRepair,
  saveReconciledExamGraph,
} from "./exam-graph-repair";

const provenance = {
  generatedAt: new Date().toISOString(),
  latencyMs: 0,
  model: "openai/gpt-6-sol",
  promptVersion: "coverage-test",
  provider: "test",
  requestedModel: "openai/gpt-6-sol",
  runId: "coverage-run",
  usage: {},
};

async function writtenGraph(country?: string) {
  const [blueprint, course] = await Promise.all([
    choiceBlueprintFixture(),
    courseFixture({ country: country ?? null, language: "pt" }),
  ]);

  if (country) {
    await prisma.examBlueprint.update({ data: { country }, where: { id: blueprint.id } });
  }

  const [reading, math, extra] = await Promise.all([
    skillFixture({ language: "pt", name: `Ler textos ${uniqueWord()}` }),
    skillFixture({ language: "pt", name: `Resolver problemas ${uniqueWord()}` }),
    skillFixture({ language: "pt", name: `Administrar o tempo de prova ${uniqueWord()}` }),
  ]);

  const strategy = {
    area: "Estratégia de prova",
    courseIds: [course.id],
    lessons: 3,
    name: extra.name,
    phase: 0,
    skillId: extra.id,
    topics: [],
    weight: null,
  };

  const graph = {
    extraSkills: [strategy],
    phases: [{ milestone: "Ler e calcular", name: "Base" }],
    skills: [
      { area: LANGUAGES, skill: reading, weight: 4 },
      { area: MATH, skill: math, weight: 5 },
    ].map(({ area, skill, weight }) => ({
      area,
      courseIds: [course.id],
      lessons: 3,
      name: skill.name,
      phase: 0,
      skillId: skill.id,
      topics: [`Leitura: ${area}`],
      weight,
    })),
  };

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: new Date(),
      graph,
      model: "openai/gpt-6-sol",
      promptVersion: "graph-test",
      runId: "graph-run",
    },
  });

  return { blueprint, graph, reading, strategy };
}

function mockMissingOptions({ readingId, word }: { readingId: string; word: string }) {
  const missing = [ENGLISH, SPANISH].map((area) => ({
    area,
    description: `Read short texts in ${area}`,
    estimatedLessons: 4,
    examWeight: 2,
    name: `Ler textos em ${area} ${word}`,
    prerequisites: [readingId],
    topics: [`Leitura: ${area}`],
  }));

  vi.mocked(checkCoverage).mockResolvedValue({
    data: { examWeights: [{ examWeight: 1, key: readingId }], missing, placements: [] },
    provenance,
  } as unknown as Awaited<ReturnType<typeof checkCoverage>>);
}

async function loadGraph(examBlueprintId: string) {
  const stored = await prisma.examSkillGraph.findUniqueOrThrow({ where: { examBlueprintId } });
  return parsePlanGraph(stored.graph);
}

describe(saveReconciledExamGraph, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  it("adds the options the graph is missing next to what they build on, changing nothing else", async () => {
    const { blueprint, graph, reading } = await writtenGraph();
    const word = uniqueWord();
    mockMissingOptions({ readingId: reading.id, word });

    await expect(addCoveredExamSkills(blueprint.id)).resolves.toStrictEqual([
      `Ler textos em ${ENGLISH} ${word}`,
      `Ler textos em ${SPANISH} ${word}`,
    ]);

    const repaired = await loadGraph(blueprint.id);
    const [stored, storedMath] = graph.skills;

    expect(repaired.skills.map((skill) => skill.area)).toStrictEqual([
      LANGUAGES,
      ENGLISH,
      SPANISH,
      MATH,
    ]);

    expect(repaired.skills[0]).toStrictEqual(stored);
    expect(repaired.skills[3]).toStrictEqual(storedMath);
    expect(repaired.phases).toStrictEqual(graph.phases);
    expect(repaired.extraSkills).toStrictEqual(graph.extraSkills);

    const added = repaired.skills.slice(1, 3);

    expect(added).toMatchObject([
      { courseIds: stored?.courseIds, topics: [`Leitura: ${ENGLISH}`], weight: 2 },
      { courseIds: stored?.courseIds, topics: [`Leitura: ${SPANISH}`], weight: 2 },
    ]);

    await expect(
      prisma.skillPrerequisite.findMany({
        select: { prerequisiteId: true, skillId: true },
        where: { skillId: { in: added.map((skill) => skill.skillId) } },
      }),
    ).resolves.toHaveLength(2);

    await expect(addCoveredExamSkills(blueprint.id)).resolves.toStrictEqual([]);
    expect(checkCoverage).toHaveBeenCalledOnce();
  });

  it("reuses an option's skill the Library already has, through identity search", async () => {
    const { blueprint, reading } = await writtenGraph();
    const word = uniqueWord();

    const spanish = await skillFixture({
      language: "pt",
      name: `Ler textos em espanhol ${word}`,
      visibility: "public",
    });

    mockMissingOptions({ readingId: reading.id, word });

    mockSearchTermsFor((subject) =>
      subject.item.title.includes(SPANISH) ? [word] : [uniqueWord()],
    );

    mockDecision(spanish.id);

    await addCoveredExamSkills(blueprint.id);

    const repaired = await loadGraph(blueprint.id);

    expect(repaired.skills.find((skill) => skill.area === SPANISH)?.skillId).toBe(spanish.id);
  });

  it("repairs a foreign exam with its country-specific course's skills", async () => {
    const { blueprint, reading } = await writtenGraph("PT");
    const word = uniqueWord();
    mockMissingOptions({ readingId: reading.id, word });

    const legacy = await skillFixture({
      language: "pt",
      name: `Ler textos em ${SPANISH} ${word}`,
      visibility: "public",
    });

    await addCoveredExamSkills(blueprint.id);
    const repaired = await loadGraph(blueprint.id);
    const added = repaired.skills.find((skill) => skill.area === SPANISH);
    const skill = await prisma.skill.findUniqueOrThrow({ where: { id: added?.skillId } });
    expect(skill.country).toBe("PT");
    expect(skill.id).not.toBe(legacy.id);
  });

  it("keeps a foreign exam's general supporting course unscoped when repairing", async () => {
    const { blueprint, graph, reading } = await writtenGraph("PT");
    const courseId = graph.skills[0]?.courseIds[0];
    await prisma.course.update({ data: { country: null }, where: { id: courseId } });
    mockMissingOptions({ readingId: reading.id, word: uniqueWord() });
    await addCoveredExamSkills(blueprint.id);
    const repaired = await loadGraph(blueprint.id);
    const added = repaired.skills.find((skill) => skill.area === SPANISH);

    await expect(
      prisma.skill.findUniqueOrThrow({ where: { id: added?.skillId } }),
    ).resolves.toMatchObject({ country: null });
  });

  it("brings a subject a wrong reading removed back to an existing plan after the corrected reading", async () => {
    const [{ blueprint, graph }, user] = await Promise.all([writtenGraph(), userFixture()]);
    const parsed = examStructureSchema.parse(blueprint.structure);

    const structure = {
      ...parsed,
      subjects: parsed.subjects.filter(({ name }) => name === LANGUAGES || name === MATH),
    };

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    const plan = await planFixture({ goalId: goal.id, graph });

    const repair = async () => {
      const notice = await prepareNoticeGraphRepair(blueprint.id);

      if (!notice) {
        throw new Error("Expected the notice blueprint");
      }

      await repairNoticePlan({
        blueprintId: blueprint.id,
        goalId: goal.id,
        movesExamDays: false,
        notice,
      });
    };

    await prisma.examBlueprint.update({
      data: {
        structure: {
          ...structure,
          subjects: structure.subjects.filter(({ name }) => name !== MATH),
        },
      },
      where: { id: blueprint.id },
    });

    await repair();

    const readPlan = async () => {
      const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
      return parsePlanGraph(saved.graph);
    };

    const areas = (saved: Awaited<ReturnType<typeof readPlan>>) =>
      saved.skills.map((skill) => skill.area);

    expect(areas(await loadGraph(blueprint.id))).toStrictEqual([LANGUAGES]);
    expect(areas(await readPlan())).toStrictEqual([LANGUAGES]);

    await prisma.examBlueprint.update({ data: { structure }, where: { id: blueprint.id } });
    await repair();

    vi.mocked(checkCoverage).mockResolvedValue({
      data: {
        examWeights: [],
        missing: [
          {
            area: MATH,
            description: "Solve the restored math questions",
            estimatedLessons: 6,
            examWeight: 5,
            name: `Resolver questões de matemática ${uniqueWord()}`,
            prerequisites: [],
            reference: "Notice",
            syllabusLine: `Leitura: ${MATH}`,
            topics: [`Leitura: ${MATH}`],
          },
        ],
        placements: [],
      },
      provenance,
      systemPrompt: "",
      usage: {
        inputTokenDetails: {
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
          noCacheTokens: 0,
        },
        inputTokens: 0,
        outputTokenDetails: { reasoningTokens: undefined, textTokens: 0 },
        outputTokens: 0,
        totalTokens: 0,
      },
      userPrompt: "",
    });

    await expect(addCoveredExamSkills(blueprint.id)).resolves.toHaveLength(1);
    const shared = await loadGraph(blueprint.id);
    expect(areas(shared)).toStrictEqual([LANGUAGES, MATH]);
    expect(shared.skills.find((skill) => skill.area === MATH)?.lessons).toBe(6);

    await repair();
    expect(areas(await readPlan())).toStrictEqual([LANGUAGES, MATH]);

    const restored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    await repair();

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      graph: restored.graph,
      version: restored.version,
    });
  });

  it("brings back a restored subject's other skills when one of them stayed in the plan as a base", async () => {
    const [{ blueprint, graph }, user, other] = await Promise.all([
      writtenGraph(),
      userFixture(),
      skillFixture({ language: "pt", name: `Calcular porcentagens ${uniqueWord()}` }),
    ]);

    const [reading, math] = graph.skills;

    if (!reading || !math) {
      throw new Error("Expected both notice skills");
    }

    const percentages = { ...math, name: other.name, skillId: other.id, topics: ["Porcentagem"] };

    await prisma.examSkillGraph.update({
      data: { graph: { ...graph, skills: [reading, math, percentages] } },
      where: { examBlueprintId: blueprint.id },
    });

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    const plan = await planFixture({ goalId: goal.id, graph });

    const repair = async () => {
      const notice = await prepareNoticeGraphRepair(blueprint.id);

      if (!notice) {
        throw new Error("Expected the notice blueprint");
      }

      await repairNoticePlan({
        blueprintId: blueprint.id,
        goalId: goal.id,
        movesExamDays: false,
        notice,
      });
    };

    await repair();

    const restored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(parsePlanGraph(restored.graph).skills.map((skill) => skill.skillId)).toStrictEqual([
      reading.skillId,
      math.skillId,
      other.id,
    ]);

    await repair();

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      graph: restored.graph,
      version: restored.version,
    });
  });

  it("brings in no shared skills for a subject the plan teaches with its own", async () => {
    const [{ blueprint, graph }, user, own] = await Promise.all([
      writtenGraph(),
      userFixture(),
      skillFixture({ language: "pt", name: `Calcular ${uniqueWord()}` }),
    ]);

    const [reading, math] = graph.skills;

    if (!reading || !math) {
      throw new Error("Expected both notice skills");
    }

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        ...graph,
        skills: [reading, { ...math, area: "Cálculo", name: own.name, skillId: own.id }],
      },
    });

    const notice = await prepareNoticeGraphRepair(blueprint.id);

    if (!notice) {
      throw new Error("Expected the notice blueprint");
    }

    await repairNoticePlan({
      blueprintId: blueprint.id,
      goalId: goal.id,
      movesExamDays: false,
      notice,
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      graph: plan.graph,
      version: plan.version,
    });
  });

  it("keeps the winning shared graph when two reconciles read the same draft", async () => {
    const { blueprint, graph } = await writtenGraph();
    const snapshot = await loadExamGraphReconcile(blueprint.id);

    if (!snapshot) {
      throw new Error("Expected a draft to reconcile.");
    }

    const results = await Promise.all(
      [7, 13].map((lessons) =>
        saveReconciledExamGraph({
          examBlueprintId: blueprint.id,
          graph: { ...graph, skills: graph.skills.map((skill) => ({ ...skill, lessons })) },
          storedGraph: snapshot.storedGraph,
          structure: snapshot.structure,
        }),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    const saved = await loadGraph(blueprint.id);

    expect(saved.skills.map((skill) => skill.lessons)).toStrictEqual(
      results[0] ? [7, 7] : [13, 13],
    );
  });

  it("asks no model when the graph already teaches every topic", async () => {
    const blueprint = await choiceBlueprintFixture();

    await expect(addCoveredExamSkills(blueprint.id)).resolves.toStrictEqual([]);
    expect(checkCoverage).not.toHaveBeenCalled();
  });
});

describe(prepareNoticeGraphRepair, () => {
  it("keeps the extra when repairing the graph and prunes its out-of-notice prerequisite", async () => {
    const { blueprint, graph, strategy } = await writtenGraph();
    const outside = await skillFixture({ language: "pt", name: "Lógica do concurso anterior" });

    const [first] = graph.skills;

    if (!first) {
      throw new Error("Expected a notice skill");
    }

    await Promise.all([
      skillPrerequisiteFixture({ prerequisiteId: outside.id, skillId: strategy.skillId }),
      prisma.examSkillGraph.update({
        data: {
          graph: {
            ...graph,
            skills: [
              ...graph.skills,
              { ...first, area: "Lógica", name: outside.name, skillId: outside.id, topics: [] },
            ],
          },
        },
        where: { examBlueprintId: blueprint.id },
      }),
    ]);

    const notice = await prepareNoticeGraphRepair(blueprint.id);
    await expect(prepareNoticeGraphRepair(blueprint.id)).resolves.toStrictEqual(notice);

    const saved = await prisma.examSkillGraph.findUniqueOrThrow({
      where: { examBlueprintId: blueprint.id },
    });

    expect(parsePlanGraph(saved.graph)).toStrictEqual(graph);
  });
});
