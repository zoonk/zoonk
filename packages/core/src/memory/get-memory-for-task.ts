import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { selectRelevantMemoryFacts } from "@zoonk/ai/tasks/memory/relevance";
import { type MemoryCategory, type MemoryFact, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { markMemoryFactsUsed } from "./_utils/mark-facts-used";
import { isMemoryEnabled } from "./_utils/memory-access";
import { currentFactsWhere } from "./_utils/memory-fact-view";

const FACT_LIMIT = 10;

/**
 * Every fact up to this cap reaches the relevance check, however it's worded. One check costs
 * about $0.00001, so the cap only bounds one lookup's calls for a learner with a very long memory,
 * whose oldest facts are then left out.
 */
const MAX_FACTS_CHECKED = 100;

export type MemoryFactForTask = Pick<MemoryFact, "category" | "id" | "statement">;

type MemoryTaskRequest = {
  userId: string;
  categories: readonly MemoryCategory[];
  /** Such as "Examples for a lesson on discounts". */
  need?: string;
  /** Sensitive facts only reach tasks that help with them, such as the tutor. */
  includeSensitive?: boolean;
  analytics?: AiGenerationContext;
  candidateIds?: readonly string[];
};

type FactScope = {
  candidateIds?: readonly string[];
  categories: MemoryCategory[];
  includeSensitive: boolean;
  now: Date;
  userId: string;
};

type FactSearch = {
  analytics?: AiGenerationContext;
  candidates: MemoryFactForTask[];
  need: string;
  scope: FactScope;
};

function scopeWhere({ candidateIds, categories, includeSensitive, now, userId }: FactScope) {
  return {
    ...currentFactsWhere({ now, userId }),
    category: { in: categories },
    ...(candidateIds ? { id: { in: [...candidateIds] } } : {}),
    ...(includeSensitive ? {} : { sensitive: false }),
  };
}

function findRecentFacts({ limit, scope }: { limit: number; scope: FactScope }) {
  return prisma.memoryFact.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { category: true, id: true, statement: true },
    take: limit,
    where: scopeWhere(scope),
  });
}

async function lookUpMemory({
  analytics,
  candidateIds,
  categories,
  includeSensitive = false,
  need,
  userId,
}: MemoryTaskRequest): Promise<{ facts: MemoryFactForTask[] } | { search: FactSearch }> {
  if (categories.length === 0 || candidateIds?.length === 0 || !(await isMemoryEnabled(userId))) {
    return { facts: [] };
  }

  const scope = {
    candidateIds,
    categories: [...categories],
    includeSensitive,
    now: new Date(),
    userId,
  };

  const candidates = await findRecentFacts({ limit: need ? MAX_FACTS_CHECKED : FACT_LIMIT, scope });

  if (!need || candidates.length <= FACT_LIMIT) {
    return { facts: candidates };
  }

  return { search: { analytics, candidates, need, scope } };
}

function selectRelevantFacts({ analytics, candidates, need }: FactSearch) {
  return selectRelevantMemoryFacts({ analytics, facts: candidates, limit: FACT_LIMIT, need });
}

async function markUsed({
  facts,
  userId,
}: {
  facts: MemoryFactForTask[];
  userId: string;
}): Promise<MemoryFactForTask[]> {
  await markMemoryFactsUsed({ ids: facts.map((fact) => fact.id), now: new Date(), userId });
  return facts;
}

/**
 * Marks the returned facts used. `userId` must come from the capability or workflow a session
 * started, never from a client.
 */
export async function getMemoryForTask(request: MemoryTaskRequest): Promise<MemoryFactForTask[]> {
  return markUsed({ facts: await findMemoryForTask(request), userId: request.userId });
}

/**
 * `getMemoryForTask` without marking the facts used, for a task that marks only what it uses. A
 * failed relevance check falls back to the newest facts, since a learner is waiting.
 */
export async function findMemoryForTask(request: MemoryTaskRequest): Promise<MemoryFactForTask[]> {
  const lookup = await lookUpMemory(request);

  if ("facts" in lookup) {
    return lookup.facts;
  }

  const selected = await safeAsync(() => selectRelevantFacts(lookup.search));

  if (selected.error) {
    logError("Memory relevance failed; using the most recent facts instead.", selected.error);
    return lookup.search.candidates.slice(0, FACT_LIMIT);
  }

  return selected.data;
}

/** `getMemoryForTask` for a workflow step: a failed relevance check throws so the step retries. */
export async function selectMemoryForTask(
  request: MemoryTaskRequest,
): Promise<MemoryFactForTask[]> {
  const lookup = await lookUpMemory(request);
  const facts = "facts" in lookup ? lookup.facts : await selectRelevantFacts(lookup.search);
  return markUsed({ facts, userId: request.userId });
}
