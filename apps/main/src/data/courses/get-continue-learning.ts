import "server-only";
import {
  type NextActivityInCourse,
  getNextActivityInCourse,
} from "@zoonk/core/activities/next-in-course";
import { getSession } from "@zoonk/core/users/session/get";
import {
  type Activity,
  type Chapter,
  type Course,
  type Lesson,
  type Organization,
  prisma,
} from "@zoonk/db";
import {
  type getContinueLearning as GetContinueLearningQuery,
  getContinueLearning as getContinueLearningQuery,
} from "@zoonk/db/continue-learning";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const MAX_CONTINUE_LEARNING_ITEMS = 4;

/**
 * Over-fetch to account for completed courses being filtered out.
 */
const SQL_LIMIT = 10;

export type ContinueLearningActivity = Pick<Activity, "id" | "kind" | "title" | "position">;

export type ContinueLearningLesson = Pick<Lesson, "id" | "slug" | "title" | "description">;

export type ContinueLearningChapter = Pick<Chapter, "id" | "slug">;

export type ContinueLearningCourse = Pick<Course, "id" | "slug" | "title" | "imageUrl"> & {
  organization: Pick<Organization, "slug">;
};

export type ContinueLearningItem = {
  course: ContinueLearningCourse;
  chapter: ContinueLearningChapter;
  lesson: ContinueLearningLesson;
  activity: ContinueLearningActivity;
};

function toItem(
  row: GetContinueLearningQuery.Result,
  next: NextActivityInCourse,
): ContinueLearningItem {
  return {
    activity: {
      id: next.activityId,
      kind: next.activityKind,
      position: next.activityPosition,
      title: next.activityTitle,
    },
    chapter: {
      id: next.chapterId,
      slug: next.chapterSlug,
    },
    course: {
      id: row.courseId,
      imageUrl: row.courseImageUrl,
      organization: { slug: row.orgSlug },
      slug: row.courseSlug,
      title: row.courseTitle,
    },
    lesson: {
      description: next.lessonDescription,
      id: next.lessonId,
      slug: next.lessonSlug,
      title: next.lessonTitle,
    },
  };
}

export const getContinueLearning = cache(
  async (headers?: Headers): Promise<ContinueLearningItem[]> => {
    const session = await getSession(headers);

    if (!session) {
      return [];
    }

    const userId = Number(session.user.id);

    const { data: rows, error } = await safeAsync(() =>
      prisma.$queryRawTyped(getContinueLearningQuery(userId, SQL_LIMIT)),
    );

    if (error || !rows) {
      return [];
    }

    const nextActivities = await Promise.all(
      rows.map((row) =>
        getNextActivityInCourse({
          activityPosition: row.activityPosition,
          chapterId: row.chapterId,
          chapterPosition: row.chapterPosition,
          courseId: row.courseId,
          lessonId: row.lessonId,
          lessonPosition: row.lessonPosition,
        }),
      ),
    );

    return rows
      .flatMap((row, idx) => {
        const next = nextActivities[idx];
        return next ? [toItem(row, next)] : [];
      })
      .slice(0, MAX_CONTINUE_LEARNING_ITEMS);
  },
);
