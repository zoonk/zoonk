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
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const MAX_CONTINUE_LEARNING_ITEMS = 4;

/**
 * Over-fetch to account for completed courses being filtered out.
 */
const SQL_LIMIT = 10;

type ContinueLearningRow = {
  courseId: number;
  courseSlug: string;
  courseTitle: string;
  courseImageUrl: string | null;
  orgSlug: string | null;
  activityPosition: number;
  lessonId: number;
  lessonPosition: number;
  chapterId: number;
  chapterPosition: number;
};

export type ContinueLearningActivity = Pick<Activity, "id" | "kind" | "title" | "position">;

export type ContinueLearningLesson = Pick<Lesson, "id" | "slug" | "title" | "description">;

export type ContinueLearningChapter = Pick<Chapter, "id" | "slug">;

export type ContinueLearningCourse = Pick<Course, "id" | "slug" | "title" | "imageUrl"> & {
  organization: Pick<Organization, "slug"> | null;
};

export type ContinueLearningItem = {
  course: ContinueLearningCourse;
  chapter: ContinueLearningChapter;
  lesson: ContinueLearningLesson;
  activity: ContinueLearningActivity;
};

function toItem(row: ContinueLearningRow, next: NextActivityInCourse): ContinueLearningItem {
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
      organization: row.orgSlug ? { slug: row.orgSlug } : null,
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

    const { data: rows, error } = await safeAsync(
      () =>
        prisma.$queryRaw<ContinueLearningRow[]>`
        WITH last_per_course AS (
          SELECT DISTINCT ON (ch.course_id)
            ch.course_id,
            ap.completed_at,
            c.slug as course_slug,
            c.title as course_title,
            c.image_url as course_image_url,
            o.slug as org_slug,
            a.position as activity_position,
            a.lesson_id,
            l.position as lesson_position,
            l.chapter_id,
            ch.position as chapter_position
          FROM activity_progress ap
          JOIN activities a ON a.id = ap.activity_id AND a.is_published = true
          JOIN lessons l ON l.id = a.lesson_id AND l.is_published = true
          JOIN chapters ch ON ch.id = l.chapter_id AND ch.is_published = true
          JOIN courses c ON c.id = ch.course_id
          LEFT JOIN organizations o ON o.id = c.organization_id
          WHERE ap.user_id = ${userId} AND ap.completed_at IS NOT NULL AND (o.kind = 'brand' OR o.id IS NULL)
          ORDER BY ch.course_id, ap.completed_at DESC
        )
        SELECT
          lpc.course_id as "courseId",
          lpc.course_slug as "courseSlug",
          lpc.course_title as "courseTitle",
          lpc.course_image_url as "courseImageUrl",
          lpc.org_slug as "orgSlug",
          lpc.activity_position as "activityPosition",
          lpc.lesson_id as "lessonId",
          lpc.lesson_position as "lessonPosition",
          lpc.chapter_id as "chapterId",
          lpc.chapter_position as "chapterPosition"
        FROM last_per_course lpc
        ORDER BY lpc.completed_at DESC
        LIMIT ${SQL_LIMIT}
      `,
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
