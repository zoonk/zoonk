import { selectRelevantMemoryFacts } from "@zoonk/ai/tasks/memory/relevance";
import { type MemoryCategory, prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMemoryForTask } from "./get-memory-for-task";

const MINUTE_MS = 60_000;

async function learnerWithFacts(facts: { category: MemoryCategory; statement: string }[]) {
  const user = await userFixture();

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

function notes({ category, count }: { category: MemoryCategory; count: number }) {
  return Array.from({ length: count }, (_, index) => ({
    category,
    statement: `Note ${index + 1}`,
  }));
}

describe(getMemoryForTask, () => {
  beforeEach(() => {
    vi.mocked(selectRelevantMemoryFacts).mockImplementation(async ({ facts, limit }) =>
      facts.slice(0, limit),
    );
  });

  it("returns a small memory whole, newest first, without any model and marks it used", async () => {
    const { facts, user } = await learnerWithFacts([
      { category: "preferences", statement: "Likes football examples" },
      { category: "background", statement: "Works as a nurse" },
      { category: "routine", statement: "Studies after 8 pm" },
    ]);

    const result = await getMemoryForTask({
      categories: ["background", "preferences"],
      need: "Examples for a lesson on percentages",
      userId: user.id,
    });

    expect(result.map((fact) => fact.statement)).toStrictEqual([
      "Works as a nurse",
      "Likes football examples",
    ]);

    expect(selectRelevantMemoryFacts).not.toHaveBeenCalled();

    const used = await prisma.memoryFact.findMany({
      select: { id: true, lastUsedAt: true, updatedAt: true },
      where: { lastUsedAt: { not: null }, userId: user.id },
    });

    expect(new Set(used.map((fact) => fact.id))).toStrictEqual(
      new Set([facts[0]?.id, facts[1]?.id]),
    );

    expect(Object.fromEntries(used.map((fact) => [fact.id, fact.updatedAt]))).toStrictEqual(
      Object.fromEntries(facts.slice(0, 2).map((fact) => [fact.id, fact.updatedAt])),
    );
  });

  it("returns nothing while memory is off", async () => {
    const { user } = await learnerWithFacts([{ category: "goals", statement: "Wants Law" }]);
    await learningProfileFixture({ memoryEnabled: false, userId: user.id });

    await expect(
      getMemoryForTask({ categories: ["goals"], userId: user.id }),
    ).resolves.toStrictEqual([]);
  });

  it("reads only the categories the task asks for", async () => {
    const { user } = await learnerWithFacts([
      { category: "context", statement: "Lives in Recife" },
      { category: "learning", statement: "Mixes up signs" },
    ]);

    const result = await getMemoryForTask({ categories: ["learning"], userId: user.id });

    expect(result.map((fact) => fact.statement)).toStrictEqual(["Mixes up signs"]);
  });

  it("leaves sensitive facts out unless the task helps with them", async () => {
    const { user } = await learnerWithFacts([
      { category: "learning", statement: "Mixes up signs" },
    ]);

    await memoryFactFixture({
      category: "learning",
      sensitive: true,
      statement: "Has ADHD",
      userId: user.id,
    });

    const request = { categories: ["learning" as const], userId: user.id };

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

  it("hands a large memory to the relevance check and keeps what it keeps", async () => {
    const { user } = await learnerWithFacts([
      { category: "preferences", statement: "Likes football examples" },
      { category: "background", statement: "Works as a nurse at night" },
      { category: "routine", statement: "Studies after 8 pm" },
      ...notes({ category: "preferences", count: 9 }),
    ]);

    vi.mocked(selectRelevantMemoryFacts).mockImplementation(async ({ facts }) =>
      facts.filter((fact) => fact.statement.includes("football")),
    );

    const analytics = { contentScope: "personal" as const, distinctId: user.id };
    const need = "Examples for a lesson on percentages";

    const result = await getMemoryForTask({
      analytics,
      categories: ["background", "preferences"],
      need,
      userId: user.id,
    });

    expect(result.map((fact) => fact.statement)).toStrictEqual(["Likes football examples"]);

    const [call] = vi.mocked(selectRelevantMemoryFacts).mock.calls;

    expect(call?.[0]).toMatchObject({ analytics, limit: 10, need });
    expect(call?.[0].facts).toHaveLength(11);
  });

  it("finds an old fact that shares no words with the need behind newer ones", async () => {
    const { user } = await learnerWithFacts([
      { category: "goals", statement: "Has the ENEM on November 8" },
      ...notes({ category: "goals", count: 20 }),
    ]);

    vi.mocked(selectRelevantMemoryFacts).mockImplementation(async ({ facts }) =>
      facts.filter((fact) => fact.statement.includes("ENEM")),
    );

    const result = await getMemoryForTask({
      categories: ["goals"],
      need: "Decide which topics to prioritize before the learner's exam",
      userId: user.id,
    });

    expect(result.map((fact) => fact.statement)).toStrictEqual(["Has the ENEM on November 8"]);
  });

  it("falls back to the most recent facts when the relevance check fails", async () => {
    const { user } = await learnerWithFacts(notes({ category: "goals", count: 11 }));

    vi.mocked(selectRelevantMemoryFacts).mockRejectedValue(new Error("Gateway down"));

    const result = await getMemoryForTask({
      categories: ["goals"],
      need: "Plan the week",
      userId: user.id,
    });

    expect(result.map((fact) => fact.statement)).toStrictEqual(
      Array.from({ length: 10 }, (_, index) => `Note ${11 - index}`),
    );
  });
});
