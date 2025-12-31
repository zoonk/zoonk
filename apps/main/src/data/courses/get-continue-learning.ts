import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import {
  type Activity,
  type ActivityProgress,
  type Chapter,
  type Course,
  type Lesson,
  type Organization,
  prisma,
} from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export const MAX_CONTINUE_LEARNING_ITEMS = 4;

export type ContinueLearningActivity = Pick<
  Activity,
  "id" | "kind" | "title" | "position"
>;

export type ContinueLearningLesson = Pick<
  Lesson,
  "id" | "slug" | "title" | "description"
>;

export type ContinueLearningChapter = Pick<Chapter, "id" | "slug">;

export type ContinueLearningCourse = Pick<
  Course,
  "id" | "slug" | "title" | "imageUrl"
> & {
  organization: Pick<Organization, "slug">;
};

export type ContinueLearningItem = {
  course: ContinueLearningCourse;
  chapter: ContinueLearningChapter;
  lesson: ContinueLearningLesson;
  activity: ContinueLearningActivity;
};

type ActivityWithProgress = Activity & { progress: ActivityProgress[] };
type LessonWithActivities = Lesson & { activities: ActivityWithProgress[] };
type ChapterWithLessons = Chapter & { lessons: LessonWithActivities[] };
type CourseWithChapters = Course & {
  chapters: ChapterWithLessons[];
  organization: Organization;
};

function findNextActivity(
  course: CourseWithChapters,
): ContinueLearningItem | null {
  for (const chapter of course.chapters) {
    const result = findNextActivityInChapter(course, chapter);
    if (result) {
      return result;
    }
  }
  return null;
}

function findNextActivityInChapter(
  course: CourseWithChapters,
  chapter: ChapterWithLessons,
): ContinueLearningItem | null {
  for (const lesson of chapter.lessons) {
    const result = findNextActivityInLesson(course, chapter, lesson);
    if (result) {
      return result;
    }
  }
  return null;
}

function findNextActivityInLesson(
  course: CourseWithChapters,
  chapter: ChapterWithLessons,
  lesson: LessonWithActivities,
): ContinueLearningItem | null {
  for (const activity of lesson.activities) {
    const progress = activity.progress[0];
    const isCompleted = progress?.completedAt !== undefined;

    if (!isCompleted) {
      return {
        activity: {
          id: activity.id,
          kind: activity.kind,
          position: activity.position,
          title: activity.title,
        },
        chapter: {
          id: chapter.id,
          slug: chapter.slug,
        },
        course: {
          id: course.id,
          imageUrl: course.imageUrl,
          organization: { slug: course.organization.slug },
          slug: course.slug,
          title: course.title,
        },
        lesson: {
          description: lesson.description,
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
        },
      };
    }
  }
  return null;
}

export const getContinueLearning = cache(
  async (params?: { headers?: Headers }): Promise<ContinueLearningItem[]> => {
    const session = await getSession({ headers: params?.headers });

    if (!session) {
      return [];
    }

    const userId = Number(session.user.id);

    const { data: courseUsers, error } = await safeAsync(() =>
      prisma.courseUser.findMany({
        include: {
          course: {
            include: {
              chapters: {
                include: {
                  lessons: {
                    include: {
                      activities: {
                        include: {
                          progress: {
                            where: { userId },
                          },
                        },
                        orderBy: { position: "asc" },
                        where: { isPublished: true },
                      },
                    },
                    orderBy: { position: "asc" },
                    where: { isPublished: true },
                  },
                },
                orderBy: { position: "asc" },
                where: { isPublished: true },
              },
              organization: true,
            },
          },
        },
        orderBy: { startedAt: "desc" },
        take: MAX_CONTINUE_LEARNING_ITEMS,
        where: { userId },
      }),
    );

    if (error || !courseUsers) {
      return [];
    }

    return courseUsers
      .map((cu) => findNextActivity(cu.course))
      .filter((item): item is ContinueLearningItem => item !== null);
  },
);
