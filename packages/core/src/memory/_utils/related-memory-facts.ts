import "server-only";
import { type MemoryCategory, type MemoryFact, prisma } from "@zoonk/db";
import { type MemoryCandidate } from "./memory-candidates";
import { currentFactsWhere } from "./memory-fact-view";
import { searchMemoryFactIds } from "./search-memory-facts";

/** Enough for the decision to see every fact a new one could change, without paying for noise. */
const MAX_RELATED = 8;

/** Facts in other categories that share words with the new one, such as a routine and a goal. */
const MAX_OTHER_CATEGORY_MATCHES = 3;

async function findOtherCategoryMatches({
  candidate,
  categories,
  language,
  now,
  userId,
}: {
  candidate: MemoryCandidate;
  categories: readonly MemoryCategory[];
  language: string;
  now: Date;
  userId: string;
}): Promise<MemoryFact[]> {
  const ids = await searchMemoryFactIds({
    categories: categories.filter((category) => category !== candidate.category),
    language,
    limit: MAX_OTHER_CATEGORY_MATCHES,
    now,
    terms: candidate.statement.split(/\s+/u),
    userId,
  });

  const facts = await prisma.memoryFact.findMany({ where: { id: { in: ids }, userId } });
  return ids.flatMap((id) => facts.find((fact) => fact.id === id) ?? []);
}

/**
 * The facts a new one could repeat, update or contradict: the latest in its category, plus facts in
 * other categories that share its words, since the extractor and an earlier run may have filed
 * the same thing differently. Each word is its own search term, so any shared word finds a fact.
 */
export async function findRelatedMemoryFacts(params: {
  candidate: MemoryCandidate;
  categories: readonly MemoryCategory[];
  language: string;
  now: Date;
  userId: string;
}): Promise<MemoryFact[]> {
  const { candidate, now, userId } = params;

  const [sameCategory, others] = await Promise.all([
    prisma.memoryFact.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MAX_RELATED,
      where: { ...currentFactsWhere({ now, userId }), category: candidate.category },
    }),
    findOtherCategoryMatches(params),
  ]);

  return [...sameCategory.slice(0, MAX_RELATED - others.length), ...others];
}
