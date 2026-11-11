import "server-only";
import { DbNull, type Source, prisma } from "@zoonk/db";
import { listProductPageIds } from "../../products/product-pages";
import { lessonGoalsFilter, loadLessonMaterialPages } from "../../sources/goal-material";
import { pickLawPages, toLawPages } from "../../sources/law-pages";
import {
  type MaterialPage,
  type MaterialSource,
  selectSourcePages,
  toSourcePages,
} from "../../sources/material-pages";
import { type SourceTopic, sourceStructureSchema } from "../../sources/source-contract";

const MAX_LESSON_SOURCES = 6;
const LESSON_SOURCE_CHARACTERS = 6000;
const MIN_SHARED_TERMS = 3;

/** Exam notices describe one exam's syllabus; using them as factual sources would leak that context into shared lessons. */
const FACT_TOPICS = ["product", "regulation", "software"] satisfies SourceTopic[];

const SOURCE_SELECT = {
  contentHash: true,
  extractedText: true,
  id: true,
  mimeType: true,
  structure: true,
  title: true,
} as const;

type LessonSourceRow = Pick<Source, keyof typeof SOURCE_SELECT>;

type FactSource = MaterialSource & { topic: SourceTopic | null };

function toFactSource(source: LessonSourceRow): FactSource[] {
  const topic = sourceStructureSchema.safeParse(source.structure).data?.topic ?? null;
  return source.extractedText ? [{ ...source, text: source.extractedText, topic }] : [];
}

/** Linked laws, read only in the articles picked for the lesson, whatever the other sources hold. */
async function findLinkedLaws(lessonId: string) {
  const links = await prisma.lessonSource.findMany({
    orderBy: { createdAt: "asc" },
    select: { articles: true, source: { select: SOURCE_SELECT } },
    where: { lessonId, source: { extractedText: { not: null } } },
  });

  return links.flatMap((link) =>
    toFactSource(link.source).map((source) => ({ articles: link.articles, source })),
  );
}

async function findFactSources({
  goals,
  lessonId,
  productPageIds,
}: {
  goals: ReturnType<typeof lessonGoalsFilter>;
  lessonId: string;
  productPageIds: string[];
}): Promise<FactSource[]> {
  const sources = await prisma.source.findMany({
    orderBy: { fetchedAt: "desc" },
    select: SOURCE_SELECT,
    take: MAX_LESSON_SOURCES,
    where: {
      AND: [
        {
          OR: [
            { learnerSources: { some: { goal: goals } } },
            { steps: { some: { lessonId } } },
            { stepSources: { some: { step: { lessonId } } } },
            { id: { in: productPageIds } },
          ],
        },
        {
          OR: [
            { structure: { equals: DbNull } },
            ...FACT_TOPICS.map((topic) => ({ structure: { equals: topic, path: ["topic"] } })),
          ],
        },
      ],
      extractedText: { not: null },
      kind: { not: "upload" },
      lessons: { none: { lessonId } },
      visibility: "public",
    },
  });

  return sources.flatMap((source) => toFactSource(source));
}

function toFactPages({ index, source }: { index: number; source: FactSource }): MaterialPage[] {
  return source.topic === "regulation"
    ? toLawPages({ index, source }).map((page) => page.page)
    : toSourcePages({ index, source });
}

async function loadLessonSourcePages({
  chapterId,
  courseId,
  lessonId,
  query,
}: {
  chapterId: string | null;
  courseId: string | null;
  lessonId: string;
  query: string;
}): Promise<MaterialPage[]> {
  const productPageIds = courseId
    ? await listProductPageIds({ courses: { some: { id: courseId } } })
    : [];

  const [laws, sources] = await Promise.all([
    findLinkedLaws(lessonId),
    findFactSources({
      goals: lessonGoalsFilter({ chapterId, courseId, lessonId }),
      lessonId,
      productPageIds,
    }),
  ]);

  const lawPages = laws.flatMap(({ articles, source }, index) =>
    pickLawPages({ labels: articles, pages: toLawPages({ index, source }) }),
  );

  const pages = sources.flatMap((source, index) =>
    toFactPages({ index: laws.length + index, source }),
  );

  const productSourceIds = new Set(productPageIds);

  // A product's own pages are about its lessons whatever words they share, often in another language.
  const productPages = selectSourcePages({
    maxCharacters: LESSON_SOURCE_CHARACTERS,
    minShared: 0,
    pages: pages.filter((page) => productSourceIds.has(page.sourceId)),
    query,
  });

  const used = productPages.reduce((total, page) => total + page.text.length, 0);

  const otherPages = selectSourcePages({
    maxCharacters: LESSON_SOURCE_CHARACTERS - used,
    minShared: MIN_SHARED_TERMS,
    pages: pages.filter((page) => !productSourceIds.has(page.sourceId)),
    query,
  });

  return [...lawPages, ...productPages, ...otherPages];
}

/** Internal workflow bridge: the lesson must come from the workflow planning or writing it. */
export async function loadLessonDocuments(input: {
  chapterId: string | null;
  courseId: string | null;
  lessonId: string;
  query: string;
}): Promise<{ material: MaterialPage[]; sources: MaterialPage[] }> {
  const material = await loadLessonMaterialPages({ lessonId: input.lessonId, query: input.query });

  if (material.length > 0) {
    return { material, sources: [] };
  }

  return { material, sources: await loadLessonSourcePages(input) };
}
