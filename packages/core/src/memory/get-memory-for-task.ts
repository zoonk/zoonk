import "server-only";
import { selectRelevantMemoryFacts } from "@zoonk/ai/tasks/v2/memory/relevance";
import {
  type MemorySearchTermsParams,
  generateMemorySearchTerms,
} from "@zoonk/ai/tasks/v2/memory/search-terms";
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

type FactScope = {
  categories: MemoryCategory[];
  includeSensitive: boolean;
  now: Date;
  userId: string;
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

async function searchRelevantFacts({
  analytics,
  language,
  need,
  scope,
}: {
  analytics?: AiGenerationContext;
  language: string;
  need: string;
  scope: FactScope;
}): Promise<MemoryFactForTask[]> {
  const candidateLimit = FACT_LIMIT * CANDIDATE_FACTOR;
  const { data } = await generateMemorySearchTerms({ analytics, language, need });

  const matchedIds = await searchMemoryFactIds({
    ...scope,
    language,
    limit: candidateLimit,
    terms: data.terms,
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

async function selectFacts({
  analytics,
  language,
  need,
  scope,
}: {
  analytics?: AiGenerationContext;
  language: string;
  need?: string;
  scope: FactScope;
}): Promise<MemoryFactForTask[]> {
  const total = await prisma.memoryFact.count({ where: scopeWhere(scope) });

  if (total <= FACT_LIMIT || !need) {
    return findRecentFacts({ limit: FACT_LIMIT, scope });
  }

  const searched = await safeAsync(() => searchRelevantFacts({ analytics, language, need, scope }));

  if (searched.error) {
    logError("Memory search failed; using the most recent facts instead.", searched.error);
    return findRecentFacts({ limit: FACT_LIMIT, scope });
  }

  return searched.data;
}

/**
 * Marks the returned facts used. `userId` must come from the capability or workflow a session
 * started, never from a client.
 */
export async function getMemoryForTask(request: MemoryTaskRequest): Promise<MemoryFactForTask[]> {
  const facts = await findMemoryForTask(request);

  await markMemoryFactsUsed({
    ids: facts.map((fact) => fact.id),
    now: new Date(),
    userId: request.userId,
  });

  return facts;
}

/** `getMemoryForTask` without marking the facts used, for a task that marks only what it uses. */
export async function findMemoryForTask({
  analytics,
  categories,
  includeSensitive = false,
  language,
  need,
  userId,
}: MemoryTaskRequest): Promise<MemoryFactForTask[]> {
  if (categories.length === 0 || !(await isMemoryEnabled(userId))) {
    return [];
  }

  const scope = { categories: [...categories], includeSensitive, now: new Date(), userId };

  return selectFacts({ analytics, language, need, scope });
}
