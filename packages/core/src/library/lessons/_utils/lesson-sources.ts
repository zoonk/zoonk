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
const FACT_TOPICS: ReadonlySet<SourceTopic | null> = new Set(["regulation", "software"]);

type LessonSourceRow = Pick<Source, "extractedText" | "id" | "mimeType" | "structure" | "title">;

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
    select: { extractedText: true, id: true, mimeType: true, structure: true, title: true },
    take: MAX_LESSON_SOURCES,
    where: {
      OR: [{ learnerSources: { some: { goal: goals } } }, { steps: { some: { lessonId } } }],
      extractedText: { not: null },
      kind: { not: "upload" },
      visibility: "public",
    },
  });

  const documents = sources
    .filter((source) => statesFacts(source))
    .flatMap((source) => (source.extractedText ? [{ ...source, text: source.extractedText }] : []));

  return selectSourcePages({
    maxCharacters: LESSON_SOURCE_CHARACTERS,
    minShared: MIN_SHARED_TERMS,
    pages: toMaterialPages(documents),
    query,
  });
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
