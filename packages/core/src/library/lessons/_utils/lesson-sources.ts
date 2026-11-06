import "server-only";
import { type Source, prisma } from "@zoonk/db";
import { lessonGoalsFilter, loadLessonMaterialPages } from "../../sources/goal-material";
import {
  type MaterialPage,
  selectSourcePages,
  toMaterialPages,
} from "../../sources/material-pages";
import { type SourceTopic, sourceStructureSchema } from "../../sources/source-contract";

const MAX_LESSON_SOURCES = 6;
const LESSON_SOURCE_CHARACTERS = 6000;
const MIN_SHARED_TERMS = 3;

/** Exam notices describe one exam's syllabus; using them as factual sources would leak that context into shared lessons. */
const FACT_TOPICS: ReadonlySet<SourceTopic | null> = new Set(["product", "regulation", "software"]);

type LessonSourceRow = Pick<
  Source,
  "extractedText" | "id" | "mimeType" | "productId" | "structure" | "title"
>;

function statesFacts(source: LessonSourceRow): boolean {
  if (source.structure === null) {
    return true;
  }

  const parsed = sourceStructureSchema.safeParse(source.structure);
  return parsed.success && FACT_TOPICS.has(parsed.data.topic);
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
  const goals = lessonGoalsFilter({ chapterId, courseId, lessonId });

  const sources = await prisma.source.findMany({
    orderBy: { fetchedAt: "desc" },
    select: {
      extractedText: true,
      id: true,
      mimeType: true,
      productId: true,
      structure: true,
      title: true,
    },
    take: MAX_LESSON_SOURCES,
    where: {
      OR: [
        { learnerSources: { some: { goal: goals } } },
        { steps: { some: { lessonId } } },
        ...(courseId ? [{ product: { courses: { some: { id: courseId } } } }] : []),
      ],
      extractedText: { not: null },
      kind: { not: "upload" },
      visibility: "public",
    },
  });

  const documents = sources
    .filter((source) => statesFacts(source))
    .flatMap((source) => (source.extractedText ? [{ ...source, text: source.extractedText }] : []));

  const productSourceIds = new Set(
    documents.flatMap((source) => (source.productId ? [source.id] : [])),
  );

  const pages = toMaterialPages(documents);

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

  return [...productPages, ...otherPages];
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
