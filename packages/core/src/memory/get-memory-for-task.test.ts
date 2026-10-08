import { selectRelevantMemoryFacts } from "@zoonk/ai/tasks/v2/memory/relevance";
import { generateMemorySearchTerms } from "@zoonk/ai/tasks/v2/memory/search-terms";
import { type MemoryCategory, prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMemoryForTask } from "./get-memory-for-task";

// Search terms and relevance are paid model calls; their behavior is covered by their evals.
vi.mock("@zoonk/ai/tasks/v2/memory/search-terms", () => ({ generateMemorySearchTerms: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/memory/relevance", () => ({ selectRelevantMemoryFacts: vi.fn() }));

const ADULT_BIRTH = { birthMonth: 5, birthYear: 1990 };
const TEEN_BIRTH = { birthMonth: 1, birthYear: new Date().getUTCFullYear() - 15 };
const MINUTE_MS = 60_000;

async function adultWithFacts(facts: { category: MemoryCategory; statement: string }[]) {
  const user = await userFixture();
  await learningProfileFixture({ ...ADULT_BIRTH, userId: user.id });

  const created = await Promise.all(
    facts.map((fact, index) =>
      memoryFactFixture({
        ...fact,
        createdAt: new Date(Date.now() - (facts.length - index) * MINUTE_MS),
        userId: user.id,
      }),
    ),
  );

  return { facts: created, user };
}

/** Enough facts in one category that a task can't read them all. */
function notes({ category, count }: { category: MemoryCategory; count: number }) {
  return Array.from({ length: count }, (_, index) => ({
    category,
    statement: `Note ${index + 1}`,
  }));
}

function mockSearchTerms(terms: string[]) {
  vi.mocked(generateMemorySearchTerms).mockResolvedValue({ data: { terms } } as Awaited<
    ReturnType<typeof generateMemorySearchTerms>
  >);
}

describe(getMemoryForTask, () => {
  beforeEach(() => {
    vi.mocked(selectRelevantMemoryFacts).mockImplementation(async ({ facts, limit }) =>
      facts.slice(0, limit),
    );
  });

  it("returns a small memory whole, newest first, without any model and marks it used", async () => {
    const { facts, user } = await adultWithFacts([
      { category: "preferences", statement: "Likes football examples" },
      { category: "background", statement: "Works as a nurse" },
      { category: "routine", statement: "Studies after 8 pm" },
    ]);

    const result = await getMemoryForTask({
      categories: ["background", "preferences"],
      language: "en",
      need: "Examples for a lesson on percentages",
      userId: user.id,
    });

    expect(result.map((fact) => fact.statement)).toStrictEqual([
      "Works as a nurse",
      "Likes football examples",
    ]);

    expect(generateMemorySearchTerms).not.toHaveBeenCalled();

    const used = await prisma.memoryFact.findMany({
      select: { id: true, lastUsedAt: true, updatedAt: true },
      where: { lastUsedAt: { not: null }, userId: user.id },
    });

    expect(new Set(used.map((fact) => fact.id))).toStrictEqual(
      new Set([facts[0]?.id, facts[1]?.id]),
    );

    // Reading a fact isn't changing it.
    expect(Object.fromEntries(used.map((fact) => [fact.id, fact.updatedAt]))).toStrictEqual(
      Object.fromEntries(facts.slice(0, 2).map((fact) => [fact.id, fact.updatedAt])),
    );
  });

  it("returns nothing while memory is off", async () => {
    const { user } = await adultWithFacts([{ category: "goals", statement: "Wants Law" }]);
    await learningProfileFixture({ memoryEnabled: false, userId: user.id });

    await expect(
      getMemoryForTask({ categories: ["goals"], language: "en", userId: user.id }),
    ).resolves.toStrictEqual([]);
  });

  it("reads nothing for a minor who hasn't turned memory on", async () => {
    const user = await userFixture();

    await Promise.all([
      learningProfileFixture({ ...TEEN_BIRTH, userId: user.id }),
      memoryFactFixture({ category: "goals", statement: "Wants Medicine", userId: user.id }),
    ]);

    await expect(
      getMemoryForTask({ categories: ["goals"], language: "pt", userId: user.id }),
    ).resolves.toStrictEqual([]);
  });

  it("reads only goals and learning for learners who may not keep other facts", async () => {
    const user = await userFixture();

    await Promise.all([
      learningProfileFixture({ memoryEnabled: true, userId: user.id }),
      memoryFactFixture({ category: "context", statement: "Lives in Recife", userId: user.id }),
      memoryFactFixture({ category: "learning", statement: "Mixes up signs", userId: user.id }),
    ]);

    const result = await getMemoryForTask({
      categories: ["context", "learning"],
      language: "pt",
      userId: user.id,
    });

    expect(result.map((fact) => fact.statement)).toStrictEqual(["Mixes up signs"]);
  });

  it("leaves sensitive facts out unless the task helps with them", async () => {
    const { user } = await adultWithFacts([{ category: "learning", statement: "Mixes up signs" }]);

    await memoryFactFixture({
      category: "learning",
      sensitive: true,
      statement: "Has ADHD",
      userId: user.id,
    });

    const request = { categories: ["learning" as const], language: "en", userId: user.id };

    const [withoutSensitive, withSensitive] = await Promise.all([
      getMemoryForTask(request),
      getMemoryForTask({ ...request, includeSensitive: true }),
    ]);

    expect(withoutSensitive.map((fact) => fact.statement)).toStrictEqual(["Mixes up signs"]);

    expect(withSensitive.map((fact) => fact.statement)).toStrictEqual([
      "Has ADHD",
      "Mixes up signs",
    ]);
  });

  it("never hands a minor's sensitive fact to a task, even one that helps with them", async () => {
    const user = await userFixture();

    await Promise.all([
      learningProfileFixture({ ...TEEN_BIRTH, memoryEnabled: true, userId: user.id }),
      memoryFactFixture({ category: "learning", statement: "Mixes up signs", userId: user.id }),
      // A teen can write anything into a fact they correct; the check flags it, and it stays theirs.
      memoryFactFixture({
        category: "learning",
        sensitive: true,
        statement: "Has ADHD",
        userId: user.id,
      }),
    ]);

    const facts = await getMemoryForTask({
      categories: ["learning"],
      includeSensitive: true,
      language: "en",
      userId: user.id,
    });

    expect(facts.map((fact) => fact.statement)).toStrictEqual(["Mixes up signs"]);
  });

  it("searches a large memory with model terms and keeps what the relevance check keeps", async () => {
    const { user } = await adultWithFacts([
      { category: "preferences", statement: "Likes football examples" },
      { category: "preferences", statement: "Prefers short explanations" },
      { category: "background", statement: "Works as a nurse at night" },
      { category: "preferences", statement: "Enjoys cooking shows" },
      ...notes({ category: "preferences", count: 8 }),
    ]);

    mockSearchTerms(["football", "nurse"]);

    vi.mocked(selectRelevantMemoryFacts).mockImplementation(async ({ facts }) =>
      facts.filter((fact) => fact.statement.includes("football")),
    );

    const result = await getMemoryForTask({
      analytics: { distinctId: user.id },
      categories: ["background", "preferences"],
      language: "en",
      need: "Examples for a lesson on percentages",
      userId: user.id,
    });

    expect(result.map((fact) => fact.statement)).toStrictEqual(["Likes football examples"]);

    expect(generateMemorySearchTerms).toHaveBeenCalledWith({
      analytics: { distinctId: user.id },
      language: "en",
      need: "Examples for a lesson on percentages",
    });

    const [call] = vi.mocked(selectRelevantMemoryFacts).mock.calls;
    const candidates = call?.[0].facts.map((fact) => fact.statement) ?? [];

    expect(candidates.slice(0, 2).toSorted()).toStrictEqual([
      "Likes football examples",
      "Works as a nurse at night",
    ]);

    expect(candidates).toHaveLength(12);
  });

  it("falls back to the most recent facts when the search fails", async () => {
    const { user } = await adultWithFacts(notes({ category: "goals", count: 11 }));

    vi.mocked(generateMemorySearchTerms).mockRejectedValue(new Error("Gateway down"));

    const result = await getMemoryForTask({
      categories: ["goals"],
      language: "en",
      need: "Plan the week",
      userId: user.id,
    });

    expect(result.map((fact) => fact.statement)).toStrictEqual(
      Array.from({ length: 10 }, (_, index) => `Note ${11 - index}`),
    );
  });
});
