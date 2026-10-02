import "server-only";
import { type Source, prisma } from "@zoonk/db";
import { lessonGoalsFilter, loadLessonMaterialPages } from "../../sources/goal-material";
import {
  type MaterialPage,
  selectSourcePages,
  toMaterialPages,
} from "../../sources/material-pages";
import { type SourceTopic, sourceStructureSchema } from "../../sources/source-contract";

/** Of its goals' public documents, a lesson reads the most recently checked ones. */
const MAX_LESSON_SOURCES = 6;
/** Excerpts, not whole notices: enough for the facts of one short lesson. */
const LESSON_SOURCE_CHARACTERS = 6000;
/** A passage shares at least this many of the lesson's words to count as being about it. */
const MIN_SHARED_TERMS = 3;

/**
 * Documents whose facts a lesson must get right: exam notices, laws and official guidance, and
 * product documentation. Uploads (no topic) are notices a learner shared. Anything else research
 * stores, such as a university syllabus, guides what a curriculum covers but states no facts.
 */
const FACT_TOPICS: ReadonlySet<SourceTopic | null> = new Set([
  "exam",
  "regulation",
  "software",
  null,
]);

type LessonSourceRow = Pick<Source, "extractedText" | "id" | "mimeType" | "structure" | "title">;

function statesFacts(source: LessonSourceRow): boolean {
  if (source.structure === null) {
    return true;
  }

  const parsed = sourceStructureSchema.safeParse(source.structure);
  return parsed.success && FACT_TOPICS.has(parsed.data.topic);
}

/**
 * The passages of public documents a lesson's facts come from, for lessons of goals built from
 * sources: what research found for a goal that plans the lesson (a law, a product's docs) and the
 * notice behind its exam's blueprint. Only public sources, so a learner's private upload never
 * reaches a shared lesson, and only passages about the lesson (`query`: its title, description
 * and skills), so a lesson the documents don't cover reads none.
 */
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
      OR: [
        { learnerSources: { some: { goal: goals } } },
        { examBlueprints: { some: { goals: { some: goals } } } },
      ],
      extractedText: { not: null },
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

/**
 * What a lesson is planned and written from, besides its outline: a private lesson built from the
 * learner's material follows those pages alone; any other lesson reads the passages of public
 * sources its facts come from, when its goals have them. `query` is what the lesson teaches (its
 * title, description and skills), to pick the pages about it.
 *
 * This is a workflow bridge: the lesson comes from the workflow planning or writing it.
 */
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
