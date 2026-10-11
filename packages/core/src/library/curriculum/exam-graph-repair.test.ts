import { checkCoverage } from "@zoonk/ai/tasks/v2/curriculum/coverage-check";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENGLISH,
  LANGUAGES,
  MATH,
  SPANISH,
  choiceBlueprintFixture,
} from "../../exams/choices/_test-utils/choice-blueprint";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import {
  mockDecision,
  mockSearchTerms,
  mockSearchTermsFor,
  uniqueWord,
} from "../identity/_test-utils/identity-mocks";
import { addMissingExamGraphSkills } from "./exam-graph-repair";

/** Model calls are the external boundary; identity search and storage run for real. */
vi.mock("@zoonk/ai/tasks/v2/curriculum/coverage-check", () => ({ checkCoverage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));

const provenance = {
  generatedAt: new Date().toISOString(),
  model: "openai/gpt-6-sol",
  promptVersion: "coverage-test",
  runId: "coverage-run",
};

/**
 * ENEM's shared graph as it was written before its notice named the foreign language's options:
 * a Languages skill and a Math one, each teaching its subject's topic.
 */
async function writtenGraph() {
  const [blueprint, course] = await Promise.all([choiceBlueprintFixture(), courseFixture()]);

  const [reading, math] = await Promise.all([
    skillFixture({ language: "pt", name: `Ler textos ${uniqueWord()}` }),
    skillFixture({ language: "pt", name: `Resolver problemas ${uniqueWord()}` }),
  ]);

  const graph = {
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

  return { blueprint, graph, reading };
}

/**
 * The check finds each option's reading skill missing (named with `word`, so another test's
 * skills never match it), and asks for a weight it mustn't move.
 */
function mockMissingOptions({ readingId, word }: { readingId: string; word: string }) {
  const missing = [ENGLISH, SPANISH].map((area) => ({
    area,
    description: `Read short texts in ${area}`,
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

describe(addMissingExamGraphSkills, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  it("adds the options the graph is missing next to what they build on, changing nothing else", async () => {
    const { blueprint, graph, reading } = await writtenGraph();
    const word = uniqueWord();
    mockMissingOptions({ readingId: reading.id, word });

    await expect(addMissingExamGraphSkills(blueprint.id)).resolves.toStrictEqual([
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

    // The skills it had keep their weights and places; the check's weight change is left out.
    expect(repaired.skills[0]).toStrictEqual(stored);
    expect(repaired.skills[3]).toStrictEqual(storedMath);
    expect(repaired.phases).toStrictEqual(graph.phases);

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

    // Once every topic has a skill, it asks no model again.
    await expect(addMissingExamGraphSkills(blueprint.id)).resolves.toStrictEqual([]);
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

    await addMissingExamGraphSkills(blueprint.id);

    const repaired = await loadGraph(blueprint.id);

    expect(repaired.skills.find((skill) => skill.area === SPANISH)?.skillId).toBe(spanish.id);
  });

  it("asks no model when the graph already teaches every topic", async () => {
    const blueprint = await choiceBlueprintFixture();

    await expect(addMissingExamGraphSkills(blueprint.id)).resolves.toStrictEqual([]);
    expect(checkCoverage).not.toHaveBeenCalled();
  });
});
