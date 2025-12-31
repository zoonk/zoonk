import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import {
  type Activity,
  type Chapter,
  type Course,
  type Lesson,
  type Organization,
  prisma,
} from "@zoonk/db";
import { getContinueLearning as getContinueLearningQuery } from "@zoonk/db/continue-learning";
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

export const getContinueLearning = cache(
  async (params?: { headers?: Headers }): Promise<ContinueLearningItem[]> => {
    const session = await getSession({ headers: params?.headers });

    if (!session) {
      return [];
    }

    const userId = Number(session.user.id);

    const { data: rows, error } = await safeAsync(() =>
      prisma.$queryRawTyped(
        getContinueLearningQuery(userId, MAX_CONTINUE_LEARNING_ITEMS),
      ),
    );

    if (error || !rows) {
      return [];
    }

    return rows.map((row) => ({
      activity: {
        id: row.activityId,
        kind: row.activityKind,
        position: row.activityPosition,
        title: row.activityTitle,
      },
      chapter: {
        id: row.chapterId,
        slug: row.chapterSlug,
      },
      course: {
        id: row.courseId,
        imageUrl: row.courseImageUrl,
        organization: { slug: row.orgSlug },
        slug: row.courseSlug,
        title: row.courseTitle,
      },
      lesson: {
        description: row.lessonDescription,
        id: row.lessonId,
        slug: row.lessonSlug,
        title: row.lessonTitle,
      },
    }));
  },
);
