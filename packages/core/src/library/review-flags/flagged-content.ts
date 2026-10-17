import "server-only";
import { type ItemFormat, prisma } from "@zoonk/db";
import {
  type StatuteArticleText,
  isStatuteSource,
  splitStatuteArticles,
  toStatuteShortName,
} from "../../exams/statutes/statute-articles";

/** Lessons and drill groups one run rewrites at most; the next day's run takes the rest. */
const MAX_FLAGGED_LESSONS = 10;
const MAX_DRILL_GROUPS = 10;

type DrillFormat = Extract<ItemFormat, "multipleChoice" | "trueFalse" | "typed">;

/** The board style that writes a drill in the format it had, so a rewrite keeps its format. */
const STYLE_BY_FORMAT = { multipleChoice: "fgv", trueFalse: "cebraspe", typed: "generic" } as const;

/**
 * Drills on one article of a changed law, in one format, rewritten together from the article's
 * new text. `itemIds` keep their ids, so answers, calibration and screens keep pointing at them.
 */
export type FlaggedDrillGroup = {
  article: StatuteArticleText;
  citation: string;
  format: DrillFormat;
  itemIds: string[];
  language: string;
  law: { shortName: string; title: string; url: string | null };
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

/** "Lei nº 8.112, Art. 13" names the article after the law's short name. */
function readArticleReference(citation: string): string {
  return citation.split(",").at(-1)?.trim() ?? citation;
}

function toDrillGroup({
  items,
  texts,
}: {
  items: readonly FlaggedItem[];
  texts: ReadonlyMap<string, string>;
}): FlaggedDrillGroup | null {
  const [first] = items;
  const source = first?.source;

  if (!first?.sourceCitation || !source || !isDrillFormat(first.format)) {
    return null;
  }

  const reference = readArticleReference(first.sourceCitation);

  const article = splitStatuteArticles(texts.get(source.id) ?? "").find(
    (candidate) => candidate.reference === reference,
  );

  // An article the new text no longer has can't be drilled; its flags stay open for admin.
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
    sourceId: source.id,
    style: STYLE_BY_FORMAT[first.format],
  };
}

/** Flagged drills on the letter of a law, grouped by article and format, read from its new text. */
async function toDrillGroups(items: readonly FlaggedItem[]): Promise<FlaggedDrillGroup[]> {
  const drills = items.filter(
    (item) => item.source && isStatuteSource({ title: item.source.title, url: item.source.url }),
  );

  const sources = await prisma.source.findMany({
    select: { extractedText: true, id: true },
    where: { id: { in: [...new Set(drills.flatMap((item) => item.source?.id ?? []))] } },
  });

  const texts = new Map(sources.map((source) => [source.id, source.extractedText ?? ""]));

  const groups = Map.groupBy(
    drills,
    (item) => `${item.source?.id}\u0000${item.sourceCitation}\u0000${item.format}`,
  );

  return [...groups.values()].flatMap((group) => toDrillGroup({ items: group, texts }) ?? []);
}

/**
 * What the flag sweep rewrites: published lessons with an open flag, and drills on a changed
 * law's articles. Other flagged questions wait in admin. Only the given flags when `flagIds` is
 * set, for an admin's "Rewrite now".
 *
 * This is a workflow bridge: the daily sweep and the admin API route call it.
 */
export async function listFlaggedContent({
  flagIds,
}: { flagIds?: readonly string[] } = {}): Promise<FlaggedContent> {
  const openFlags = { status: "open" as const, ...(flagIds ? { id: { in: [...flagIds] } } : {}) };

  const [lessons, items] = await Promise.all([
    prisma.lesson.findMany({
      orderBy: { updatedAt: "asc" },
      select: { id: true },
      take: MAX_FLAGGED_LESSONS,
      where: { contentStatus: "completed", reviewFlags: { some: openFlags } },
    }),
    prisma.item.findMany({
      orderBy: { id: "asc" },
      select: {
        format: true,
        id: true,
        language: true,
        source: { select: { id: true, title: true, url: true } },
        sourceCitation: true,
      },
      where: { reviewFlags: { some: openFlags } },
    }),
  ]);

  const drillGroups = await toDrillGroups(items);

  return {
    drillGroups: drillGroups.slice(0, MAX_DRILL_GROUPS),
    lessonIds: lessons.map((lesson) => lesson.id),
  };
}

/** How many flags wait for a rewrite, so the daily sweep starts one only when there's work. */
export function countOpenReviewFlags(): Promise<number> {
  return prisma.contentReviewFlag.count({ where: { status: "open" } });
}
