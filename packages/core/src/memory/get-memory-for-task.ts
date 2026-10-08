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
import { getMemoryAccess } from "./_utils/memory-access";
import { currentFactsWhere } from "./_utils/memory-fact-view";
import { searchMemoryFactIds } from "./_utils/search-memory-facts";

type AiGenerationContext = MemorySearchTermsParams["analytics"];

/** A task never loads a learner's whole memory: about ten facts at most. */
const FACT_LIMIT = 10;

/** The relevance check sees up to twice what the task gets, so it can still drop near misses. */
const CANDIDATE_FACTOR = 2;

export type MemoryFactForTask = Pick<MemoryFact, "category" | "id" | "statement">;

type MemoryTaskRequest = {
  userId: string;
  /** Only what the task needs: the planner reads goals and routine, example lines background and preferences. */
  categories: readonly MemoryCategory[];
  /** The learner's language, which their facts are written in. */
  language: string;
  /** What the task is about to do, such as "Examples for a lesson on discounts". */
  need?: string;
  /** Sensitive facts only reach tasks that help with them, such as the tutor, and only for adults. */
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

/**
 * The agentic search the Library uses: a fast model writes search terms, Postgres finds matching
 * facts, and a classifier keeps the ones the task would use. The most recent facts join the
 * candidates when the search finds few, since a fact can matter without sharing a word.
 */
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
 * The facts one AI task may read about a learner: only the categories it asks for and the learner's
 * age allows, nothing when memory is off, and never more than ten. When those categories hold
 * more than that and the task says what it needs, an agentic search picks the relevant facts;
 * otherwise the most recent ones come back. Returned facts are marked as used, so stale ones can
 * be reviewed.
 *
 * This is a bridge for tasks and workflows: `userId` comes from the public capability or workflow
 * that a session started, never from a client.
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

/**
 * The same facts as `getMemoryForTask`, without marking them used: for a task that reads memory
 * while it still decides whether it needs it, and marks only what it uses (`markMemoryFactsUsed`).
 */
export async function findMemoryForTask({
  analytics,
  categories,
  includeSensitive = false,
  language,
  need,
  userId,
}: MemoryTaskRequest): Promise<MemoryFactForTask[]> {
  const access = await getMemoryAccess(userId);
  const allowed = access.categories.filter((category) => categories.includes(category));

  if (!access.enabled || allowed.length === 0) {
    return [];
  }

  // A minor's own correction can still be flagged sensitive; it stays listed for them, never read.
  const scope = {
    categories: allowed,
    includeSensitive: includeSensitive && access.allowSensitive,
    now: new Date(),
    userId,
  };

  return selectFacts({ analytics, language, need, scope });
}
