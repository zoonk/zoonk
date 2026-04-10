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
import { getNextSibling } from "../progress/get-next-sibling";

export const MAX_CONTINUE_LEARNING_ITEMS = 4;

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

type ContinueLearningActivity = Pick<Activity, "id" | "kind" | "title" | "position">;

type ContinueLearningLesson = Pick<Lesson, "id" | "slug" | "title" | "description">;

type ContinueLearningChapter = Pick<Chapter, "id" | "slug">;

type ContinueLearningCourse = Pick<Course, "id" | "slug" | "title" | "imageUrl"> & {
  organization: Pick<Organization, "slug"> | null;
};

export type ContinueLearningCompletedItem = {
  status: "completed";
  activity: ContinueLearningActivity;
  chapter: ContinueLearningChapter;
  course: ContinueLearningCourse;
  lesson: ContinueLearningLesson;
};

export type ContinueLearningPendingItem = {
  status: "pending";
  chapter: ContinueLearningChapter;
  course: ContinueLearningCourse;
  lesson: ContinueLearningLesson | null;
};

export type ContinueLearningItem = ContinueLearningCompletedItem | ContinueLearningPendingItem;

function toCourse(row: ContinueLearningRow): ContinueLearningCourse {
  return {
    id: row.courseId,
    imageUrl: row.courseImageUrl,
    organization: row.orgSlug ? { slug: row.orgSlug } : null,
    slug: row.courseSlug,
    title: row.courseTitle,
  };
}

function toCompletedItem(
  row: ContinueLearningRow,
  next: NextActivityInCourse,
): ContinueLearningCompletedItem {
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
    course: toCourse(row),
    lesson: {
      description: next.lessonDescription,
      id: next.lessonId,
      slug: next.lessonSlug,
      title: next.lessonTitle,
    },
    status: "completed",
  };
}

type PendingTarget = {
  chapter: ContinueLearningChapter;
  lesson: ContinueLearningLesson | null;
};

async function findPendingTarget(row: ContinueLearningRow): Promise<PendingTarget | null> {
  const nextLesson = await getNextSibling({
    chapterId: row.chapterId,
    chapterPosition: row.chapterPosition,
    courseId: row.courseId,
    lessonPosition: row.lessonPosition,
    level: "lesson",
  });

  if (nextLesson) {
    return {
      chapter: { id: nextLesson.chapterId, slug: nextLesson.chapterSlug },
      lesson: {
        description: nextLesson.lessonDescription,
        id: nextLesson.lessonId,
        slug: nextLesson.lessonSlug,
        title: nextLesson.lessonTitle,
      },
    };
  }

  const nextChapter = await getNextSibling({
    chapterPosition: row.chapterPosition,
    courseId: row.courseId,
    level: "chapter",
  });

  if (nextChapter) {
    return {
      chapter: { id: nextChapter.chapterId, slug: nextChapter.chapterSlug },
      lesson: null,
    };
  }

  return null;
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
          JOIN activities a ON a.id = ap.activity_id AND a.is_published = true AND a.archived_at IS NULL
          JOIN lessons l ON l.id = a.lesson_id AND l.is_published = true AND l.archived_at IS NULL
          JOIN chapters ch ON ch.id = l.chapter_id AND ch.is_published = true AND ch.archived_at IS NULL
          JOIN courses c ON c.id = ch.course_id AND c.is_published = true AND c.archived_at IS NULL
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

    const pendingTargets = await Promise.all(
      rows.map((row, idx) =>
        nextActivities[idx] ? Promise.resolve(null) : findPendingTarget(row),
      ),
    );

    return rows
      .flatMap<ContinueLearningItem>((row, idx) => {
        const next = nextActivities[idx];

        if (next) {
          return [toCompletedItem(row, next)];
        }

        const target = pendingTargets[idx];

        if (!target) {
          return [];
        }

        return [{ ...target, course: toCourse(row), status: "pending" as const }];
      })
      .slice(0, MAX_CONTINUE_LEARNING_ITEMS);
  },
);
