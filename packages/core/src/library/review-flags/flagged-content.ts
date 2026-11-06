import "server-only";
import { type ItemFormat, type TransactionClient, prisma } from "@zoonk/db";
import {
  type StatuteArticleText,
  isStatuteSource,
  splitStatuteArticles,
  toStatuteShortName,
} from "../../exams/statutes/statute-articles";

const MAX_FLAGGED_LESSONS = 10;
const MAX_DRILL_GROUPS = 10;

type DrillFormat = Extract<ItemFormat, "multipleChoice" | "trueFalse" | "typed">;

const STYLE_BY_FORMAT = { multipleChoice: "fgv", trueFalse: "cebraspe", typed: "generic" } as const;

export type FlaggedDrillGroup = {
  article: StatuteArticleText;
  citation: string;
  format: DrillFormat;
  itemIds: string[];
  language: string;
  preparedAt: Date;
  law: { shortName: string; title: string; url: string | null };
  sourceHash: string;
  sourceId: string;
  style: (typeof STYLE_BY_FORMAT)[DrillFormat];
};

export type FlaggedContent = { drillGroups: FlaggedDrillGroup[]; lessonIds: string[] };

type FlaggedItem = {
  format: ItemFormat;
  id: string;
  language: string;
  source: { id: string; title: string; url: string | null } | null;
  sourceCitation: string | null;
};

function isDrillFormat(format: ItemFormat): format is DrillFormat {
  return format in STYLE_BY_FORMAT;
}

function readArticleReference(citation: string): string {
  return citation.split(",").at(-1)?.trim() ?? citation;
}

type LawText = { contentHash: string; text: string };

function toDrillGroup({
  items,
  laws,
  preparedAt,
}: {
  items: readonly FlaggedItem[];
  laws: ReadonlyMap<string, LawText>;
  preparedAt: Date;
}): FlaggedDrillGroup | null {
  const [first] = items;
  const source = first?.source;
  const law = source && laws.get(source.id);

  if (!first?.sourceCitation || !source || !law || !isDrillFormat(first.format)) {
    return null;
  }

  const reference = readArticleReference(first.sourceCitation);

  const article = splitStatuteArticles(law.text).find(
    (candidate) => candidate.reference === reference,
  );

  if (!article) {
    return null;
  }

  return {
    article,
    citation: first.sourceCitation,
    format: first.format,
    itemIds: items.map((item) => item.id),
    language: first.language,
    law: { shortName: toStatuteShortName(source.title), title: source.title, url: source.url },
    preparedAt,
    sourceHash: law.contentHash,
    sourceId: source.id,
    style: STYLE_BY_FORMAT[first.format],
  };
}

async function toDrillGroups({
  items,
  preparedAt,
}: {
  items: readonly FlaggedItem[];
  preparedAt: Date;
}): Promise<FlaggedDrillGroup[]> {
  const drills = items.filter(
    (item) => item.source && isStatuteSource({ title: item.source.title, url: item.source.url }),
  );

  const sources = await prisma.source.findMany({
    select: { contentHash: true, extractedText: true, id: true },
    where: { id: { in: [...new Set(drills.flatMap((item) => item.source?.id ?? []))] } },
  });

  const laws = new Map(
    sources.map((source) => [
      source.id,
      { contentHash: source.contentHash, text: source.extractedText ?? "" },
    ]),
  );

  const groups = Map.groupBy(
    drills,
    (item) => `${item.source?.id}\u0000${item.sourceCitation}\u0000${item.format}`,
  );

  return [...groups.values()].flatMap(
    (group) => toDrillGroup({ items: group, laws, preparedAt }) ?? [],
  );
}

/** Internal workflow bridge for the daily sweep and admin API. */
export async function prepareFlaggedContent({
  flagIds,
}: { flagIds?: readonly string[] } = {}): Promise<FlaggedContent> {
  const preparedAt = new Date();
  const openFlags = { status: "open" as const, ...(flagIds ? { id: { in: [...flagIds] } } : {}) };

  const drillFlags = { ...openFlags, ...(!flagIds && { rewriteFailedAt: null }) };

  const drillWhere = {
    format: { in: ["multipleChoice", "trueFalse", "typed"] satisfies ItemFormat[] },
    reviewFlags: { some: drillFlags },
    sourceCitation: { not: null },
  };

  const [lessons, keys] = await Promise.all([
    prisma.lesson.findMany({
      orderBy: { updatedAt: "asc" },
      select: { id: true },
      take: MAX_FLAGGED_LESSONS,
      where: { contentStatus: "completed", reviewFlags: { some: openFlags } },
    }),
    prisma.item.groupBy({
      by: ["sourceId", "sourceCitation", "format"],
      orderBy: [
        { _min: { createdAt: "asc" } },
        { sourceId: "asc" },
        { sourceCitation: "asc" },
        { format: "asc" },
      ],
      take: MAX_DRILL_GROUPS,
      where: drillWhere,
    }),
  ]);

  const items = await prisma.item.findMany({
    orderBy: { id: "asc" },
    select: {
      format: true,
      id: true,
      language: true,
      source: { select: { id: true, title: true, url: true } },
      sourceCitation: true,
    },
    where: {
      ...drillWhere,
      OR: keys.map(({ format, sourceCitation, sourceId }) => ({
        format,
        sourceCitation,
        sourceId,
      })),
    },
  });

  const drillGroups = await toDrillGroups({ items, preparedAt });
  const grouped = new Set(drillGroups.flatMap((group) => group.itemIds));

  await recordFailedDrillRewrites({
    itemIds: items.filter((item) => !grouped.has(item.id)).map((item) => item.id),
    preparedAt,
  });

  return { drillGroups, lessonIds: lessons.map((lesson) => lesson.id) };
}

export function countOpenReviewFlags(): Promise<number> {
  return prisma.contentReviewFlag.count({ where: { status: "open" } });
}

export function recordFailedDrillRewrites({
  itemIds,
  preparedAt,
  tx = prisma,
}: {
  itemIds: readonly string[];
  preparedAt: Date;
  tx?: Pick<TransactionClient, "contentReviewFlag">;
}) {
  return tx.contentReviewFlag.updateMany({
    data: { rewriteFailedAt: new Date() },
    where: { createdAt: { lte: preparedAt }, itemId: { in: [...itemIds] }, status: "open" },
  });
}
