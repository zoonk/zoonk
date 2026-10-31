import "server-only";
import { getListedCourseWhere, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

type ChapterFindManyArgs = NonNullable<Parameters<typeof prisma.chapter.findMany>[0]>;
type ChapterWhere = NonNullable<ChapterFindManyArgs["where"]>;

const searchResultInclude = {
  homeCourse: {
    select: { id: true, organization: { select: { slug: true } }, slug: true, title: true },
  },
} as const;

function findMatches({ limit, where }: { limit: number; where: ChapterWhere }) {
  return prisma.chapter.findMany({
    include: searchResultInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    where,
  });
}

type ChapterMatch = Awaited<ReturnType<typeof findMatches>>[number];

function getDescriptionWhere({
  normalizedSearch,
  query,
}: {
  normalizedSearch: string;
  query: string;
}) {
  const terms = [...new Set([query.trim(), normalizedSearch].filter(Boolean))];

  return {
    OR: terms.map((term) => ({ description: { contains: term, mode: "insensitive" as const } })),
  };
}

function keepFirstPerId(chapters: ChapterMatch[]) {
  return chapters.filter(
    (chapter, index) => chapters.findIndex((item) => item.id === chapter.id) === index,
  );
}

export async function searchLibraryChapters({
  language,
  limit,
  query,
}: {
  language: string;
  limit: number;
  query: string;
}): Promise<ChapterMatch[]> {
  const normalizedSearch = normalizeString(query);

  if (!normalizedSearch) {
    return [];
  }

  const baseWhere: ChapterWhere = {
    homeCourse: getListedCourseWhere(),
    language,
    visibility: "public",
  };

  const ranks = await Promise.all([
    findMatches({ limit, where: { ...baseWhere, normalizedTitle: normalizedSearch } }),
    findMatches({
      limit,
      where: { ...baseWhere, normalizedTitle: { contains: normalizedSearch, mode: "insensitive" } },
    }),
    findMatches({
      limit,
      where: { ...baseWhere, ...getDescriptionWhere({ normalizedSearch, query }) },
    }),
  ]);

  return keepFirstPerId(ranks.flat()).slice(0, limit);
}
