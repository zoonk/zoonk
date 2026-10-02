import "server-only";
import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { getPublicLibraryLesson } from "@zoonk/core/library/lessons/public";

/** How many of a course's first lessons are looked at to find one to show. */
const SAMPLE_CANDIDATES = 8;

/**
 * The first written lesson near the start of a course whose first screen is a question, so a
 * course page can show what a lesson looks like with its real content. Null until one is written.
 */
export async function getSampleLesson(outline: LibraryOutline) {
  const candidates = outline.levels
    .flatMap((band) => band.chapters.flatMap((chapter) => chapter.lessons))
    .slice(0, SAMPLE_CANDIDATES);

  const lessons = await Promise.all(
    candidates.map((lesson) => getPublicLibraryLesson({ lessonId: lesson.id })),
  );

  const sample = lessons.find((lesson) => lesson?.firstScreen?.kind === "choice");

  if (sample?.firstScreen?.kind !== "choice") {
    return null;
  }

  return { ...sample, firstScreen: sample.firstScreen };
}

export type SampleLesson = NonNullable<Awaited<ReturnType<typeof getSampleLesson>>>;
