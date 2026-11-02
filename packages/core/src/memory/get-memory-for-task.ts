import "server-only";
import { selectRelevantMemoryFacts } from "@zoonk/ai/tasks/memory/relevance";
import {
  type MemorySearchTermsParams,
  generateMemorySearchTerms,
} from "@zoonk/ai/tasks/memory/search-terms";
import { type MemoryCategory, type MemoryFact, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { markMemoryFactsUsed } from "./_utils/mark-facts-used";
import { isMemoryEnabled } from "./_utils/memory-access";
import { currentFactsWhere } from "./_utils/memory-fact-view";
import { searchMemoryFactIds } from "./_utils/search-memory-facts";

type AiGenerationContext = MemorySearchTermsParams["analytics"];

const FACT_LIMIT = 10;

const CANDIDATE_FACTOR = 2;

export type MemoryFactForTask = Pick<MemoryFact, "category" | "id" | "statement">;

type MemoryTaskRequest = {
  userId: string;
  categories: readonly MemoryCategory[];
  language: string;
  /** Such as "Examples for a lesson on discounts". */
  need?: string;
  /** Sensitive facts only reach tasks that help with them, such as the tutor. */
  includeSensitive?: boolean;
  analytics?: AiGenerationContext;
};

type MemorySearch = { facts: MemoryFactForTask[] } | { terms: string[] };

type FactScope = {
  categories: MemoryCategory[];
  includeSensitive: boolean;
  now: Date;
  userId: string;
};

type FactSearch = {
  analytics?: AiGenerationContext;
  language: string;
  need: string;
  scope: FactScope;
};

function scopeWhere({ categories, includeSensitive, now, userId }: FactScope) {
  return {
    ...currentFactsWhere({ now, userId }),
    category: { in: categories },
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
  categories,
  includeSensitive = false,
  language,
  need,
  userId,
}: MemoryTaskRequest): Promise<{ facts: MemoryFactForTask[] } | { search: FactSearch }> {
  if (categories.length === 0 || !(await isMemoryEnabled(userId))) {
    return { facts: [] };
  }

  const scope = { categories: [...categories], includeSensitive, now: new Date(), userId };
  const total = await prisma.memoryFact.count({ where: scopeWhere(scope) });

  if (total <= FACT_LIMIT || !need) {
    return { facts: await findRecentFacts({ limit: FACT_LIMIT, scope }) };
  }

  return { search: { analytics, language, need, scope } };
}

async function generateFactSearchTerms({
  analytics,
  language,
  need,
}: FactSearch): Promise<string[]> {
  const { data } = await generateMemorySearchTerms({ analytics, language, need });
  return data.terms;
}

async function searchRelevantFacts({
  language,
  need,
  scope,
  terms,
}: FactSearch & { terms: string[] }): Promise<MemoryFactForTask[]> {
  const candidateLimit = FACT_LIMIT * CANDIDATE_FACTOR;

  const matchedIds = await searchMemoryFactIds({
    ...scope,
    language,
    limit: candidateLimit,
    terms,
  });

  const [matched, recent] = await Promise.all([
    prisma.memoryFact.findMany({
      select: { category: true, id: true, statement: true },
      where: { ...scopeWhere(scope), id: { in: matchedIds } },
    }),
    findRecentFacts({ limit: candidateLimit, scope }),
  ]);

  const byRank = matchedIds.flatMap((id) => matched.find((fact) => fact.id === id) ?? []);
  const others = recent.filter((fact) => !matchedIds.includes(fact.id));
  const candidates = [...byRank, ...others].slice(0, candidateLimit);

  return selectRelevantMemoryFacts({ facts: candidates, limit: FACT_LIMIT, need });
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

/** `getMemoryForTask` without marking the facts used, for a task that marks only what it uses. */
export async function findMemoryForTask(request: MemoryTaskRequest): Promise<MemoryFactForTask[]> {
  const lookup = await lookUpMemory(request);

  if ("facts" in lookup) {
    return lookup.facts;
  }

  const { search } = lookup;

  const searched = await safeAsync(async () =>
    searchRelevantFacts({ ...search, terms: await generateFactSearchTerms(search) }),
  );

  if (searched.error) {
    logError("Memory search failed; using the most recent facts instead.", searched.error);
    return findRecentFacts({ limit: FACT_LIMIT, scope: search.scope });
  }

  return searched.data;
}

/**
 * `getMemoryForTask` in two calls, one model call each, so a workflow retries each alone: a failed
 * call throws instead of falling back to the most recent facts.
 */
export async function startMemorySearch(request: MemoryTaskRequest): Promise<MemorySearch> {
  const lookup = await lookUpMemory(request);

  if ("facts" in lookup) {
    return { facts: await markUsed({ facts: lookup.facts, userId: request.userId }) };
  }

  return { terms: await generateFactSearchTerms(lookup.search) };
}

export async function selectMemoryFacts({
  terms,
  ...request
}: MemoryTaskRequest & { terms: string[] }): Promise<MemoryFactForTask[]> {
  const lookup = await lookUpMemory(request);

  const facts =
    "facts" in lookup ? lookup.facts : await searchRelevantFacts({ ...lookup.search, terms });

  return markUsed({ facts, userId: request.userId });
}
