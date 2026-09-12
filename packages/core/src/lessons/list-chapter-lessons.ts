import "server-only";
import { type Lesson, getPublishedLessonWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getChapterLessonsCacheTag, getUserProgressCacheTag } from "../cache/tags";
import { getChapterById } from "../chapters/get-chapter-by-id";
import { requiredLessons } from "../courses/_utils/course-learning-plan-rules";
import { getReadableCourseWhere } from "../courses/course-access";
import { getSession } from "../users/get-session";

/**
 * Returns one chapter's cached published lessons in authored order so every app
 * shares the same visibility, ordering, and invalidation behavior.
 */
export async function listChapterLessons({
  chapterId,
  view = "all",
}: {
  chapterId: string;
  view?: "all" | "teaching" | "curriculum";
}): Promise<Lesson[]> {
  "use cache: private";
  const session = await getSession();
  cacheTag(getChapterLessonsCacheTag(chapterId));

  const lessons = await prisma.lesson.findMany({
    orderBy: { position: "asc" },
    where: getPublishedLessonWhere({
      courseWhere: getReadableCourseWhere(session?.user.id ?? null),
      lessonWhere: { chapterId },
    }),
  });

  if (view === "all") {
    return lessons;
  }

  const chapter = await getChapterById({ chapterId });

  if (!chapter) {
    return [];
  }

  if (session) {
    cacheTag(getUserProgressCacheTag(session.user.id));
  }

  const plan = session
    ? await prisma.courseLearningPlan.findUnique({
        where: { userCoursePlan: { courseId: chapter.courseId, userId: session.user.id } },
      })
    : null;

  return requiredLessons({
    format: chapter.course.format,
    lessons,
    preferences: {
      depth: plan?.depth ?? "complete",
      hiddenLessonKinds: view === "curriculum" ? [] : (plan?.hiddenLessonKinds ?? []),
    },
  });
}
