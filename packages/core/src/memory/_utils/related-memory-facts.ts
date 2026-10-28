import "server-only";
import { MemoryCategory, type MemoryFact, prisma } from "@zoonk/db";
import { type MemoryCandidate } from "./memory-candidates";
import { currentFactsWhere } from "./memory-fact-view";
import { searchMemoryFactIds } from "./search-memory-facts";

const MAX_RELATED = 8;

const MAX_OTHER_CATEGORY_MATCHES = 3;

async function findOtherCategoryMatches({
  candidate,
  language,
  now,
  userId,
}: {
  candidate: MemoryCandidate;
  language: string;
  now: Date;
  userId: string;
}): Promise<MemoryFact[]> {
  const ids = await searchMemoryFactIds({
    categories: Object.values(MemoryCategory).filter((category) => category !== candidate.category),
    language,
    limit: MAX_OTHER_CATEGORY_MATCHES,
    now,
    terms: candidate.statement.split(/\s+/u),
    userId,
  });

  const facts = await prisma.memoryFact.findMany({ where: { id: { in: ids }, userId } });
  return ids.flatMap((id) => facts.find((fact) => fact.id === id) ?? []);
}

export async function findRelatedMemoryFacts(params: {
  candidate: MemoryCandidate;
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
