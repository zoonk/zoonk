import "server-only";
import { type ChapterView } from "@zoonk/core/view-models/chapter/contract";
import { getChapterView } from "@zoonk/core/view-models/chapter/get";
import { type LessonRouting } from "./lesson-player-client";

const TODAY: LessonRouting = { exit: "/today", exitTo: null, nextLesson: null };

/** A language goal's chapter is a unit, with a page of its own. */
function getChapterHref({
  chapterId,
  goalKind,
}: {
  chapterId: string;
  goalKind: ChapterView["goal"]["kind"];
}) {
  return goalKind === "language" ? `/content/units/${chapterId}` : `/content/chapters/${chapterId}`;
}

/**
 * Where a learner's lesson closes to when it isn't a session block: its chapter in their plan,
 * with the chapter's next lesson still to do after this one, or Today when the plan doesn't have
 * the chapter.
 */
export async function getLessonRouting({
  chapterId,
  lessonId,
}: {
  chapterId: string | null;
  lessonId: string;
}): Promise<LessonRouting> {
  const result = chapterId ? await getChapterView({ chapterId }) : null;

  if (!chapterId || result?.status !== "ready") {
    return TODAY;
  }

  const { goal, lessons } = result.chapter;
  const index = lessons.findIndex((lesson) => lesson.lessonId === lessonId);
  const next = lessons.slice(index + 1).find((lesson) => lesson.state !== "done");

  return {
    exit: getChapterHref({ chapterId, goalKind: goal.kind }),
    exitTo: goal.kind === "language" ? "unit" : "chapter",
    nextLesson: next ? `/learn/${next.lessonId}` : null,
  };
}
