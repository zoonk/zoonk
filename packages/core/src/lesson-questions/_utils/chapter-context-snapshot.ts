import "server-only";
import { type ChapterScopeContext } from "@zoonk/ai/tasks/lessons/question-context";
import { listFinishedLessonIds } from "../../catalog/_utils/finished-lessons";
import { getLibraryChapter } from "../../library/chapters/get-library-chapter";

export async function buildChapterContextSnapshot({
  chapterId,
  userId,
}: {
  chapterId: string;
  userId: string;
}): Promise<ChapterScopeContext | null> {
  const [chapter, finished] = await Promise.all([
    getLibraryChapter({ chapterId }),
    listFinishedLessonIds(userId),
  ]);

  if (!chapter) {
    return null;
  }

  return {
    chapter: {
      description: chapter.description,
      level: chapter.level,
      objectives: chapter.objectives,
      title: chapter.title,
    },
    course: chapter.homeCourse ? { title: chapter.homeCourse.title } : null,
    language: chapter.language,
    lessons: chapter.lessons.map((lesson) => ({
      canDo: lesson.canDo,
      description: lesson.description,
      finished: finished.has(lesson.id),
      title: lesson.title,
    })),
    scope: { kind: "chapter" },
    version: 1,
  };
}
