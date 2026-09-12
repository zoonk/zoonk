import { type LessonKind, prisma } from "@zoonk/db";
import { getLessonKindExclusionSql } from "../../lessons/lesson-kind-exclusions";
import { getCourseBrandSlug, getReadableCourseWhere } from "../course-access";

/**
 * The continue-learning feed only needs the learner's most recent completion
 * anchor per course. Keeping that SQL in one helper makes the capability logic
 * about item selection instead of raw historical query details.
 */
export type ContinueLearningRow = {
  brandSlug: string;
  chapterId: string;
  chapterPosition: number;
  chapterTitle: string;
  courseId: string;
  courseImageUrl: string | null;
  courseSlug: string;
  courseTitle: string;
  lessonId: string;
  lessonPosition: number;
  lastActivityAt: Date;
  orgSlug: string | null;
};

/**
 * The feed intentionally over-fetches recent courses because some of them will
 * be filtered out later after durable completion and current curriculum checks.
 */
const SQL_LIMIT = 10;

/**
 * Over-fetches the ten most recent distinct course anchors because completed
 * or no-longer-actionable candidates are filtered by the later state wave.
 */
async function findRecentContinueLearningRows({
  excludedLessonKinds,
  userId,
}: {
  excludedLessonKinds?: LessonKind[];
  userId: string;
}): Promise<ContinueLearningRow[]> {
  const lessonKindFilter = getLessonKindExclusionSql({ excludedLessonKinds });

  return prisma.$queryRaw<ContinueLearningRow[]>`
        WITH last_per_course AS (
          SELECT DISTINCT ON (ch.course_id)
            ch.course_id,
            ap.completed_at,
            c.slug as course_slug,
            c.title as course_title,
            c.image_url as course_image_url,
            CASE WHEN c.user_id IS NOT NULL THEN 'me' ELSE o.slug END as brand_slug,
            o.slug as org_slug,
            l.position as lesson_position,
            l.id as lesson_id,
            l.chapter_id,
            ch.position as chapter_position,
            ch.title as chapter_title
          FROM lesson_progress ap
          JOIN lessons l ON l.id = ap.lesson_id
          JOIN chapters ch ON ch.id = l.chapter_id
          JOIN courses c ON c.id = ch.course_id AND c.is_published = true
          LEFT JOIN organizations o ON o.id = c.organization_id
          WHERE ap.user_id = ${userId}
            AND ap.completed_at IS NOT NULL
            AND ${lessonKindFilter}
            AND ((o.kind = 'brand' AND c.user_id IS NULL) OR (c.organization_id IS NULL AND c.user_id = ${userId}))
          ORDER BY ch.course_id, ap.completed_at DESC
        )
        SELECT
          lpc.completed_at as "lastActivityAt",
          lpc.brand_slug as "brandSlug",
          lpc.course_id as "courseId",
          lpc.course_slug as "courseSlug",
          lpc.course_title as "courseTitle",
          lpc.course_image_url as "courseImageUrl",
          lpc.org_slug as "orgSlug",
          lpc.lesson_id as "lessonId",
          lpc.lesson_position as "lessonPosition",
          lpc.chapter_id as "chapterId",
          lpc.chapter_position as "chapterPosition",
          lpc.chapter_title as "chapterTitle"
        FROM last_per_course lpc
        ORDER BY lpc.completed_at DESC
        LIMIT ${SQL_LIMIT}
      `;
}

/**
 * Historical completions keep a course eligible for continue-learning. The
 * public capability derives this internal repository user id from its trusted
 * authenticated session before calling the query.
 */
export async function listRecentContinueLearningRows({
  excludedLessonKinds,
  userId,
}: {
  excludedLessonKinds?: LessonKind[];
  userId: string;
}): Promise<ContinueLearningRow[]> {
  const [completions, plans] = await Promise.all([
    findRecentContinueLearningRows({ excludedLessonKinds, userId }),
    prisma.courseLearningPlan.findMany({
      include: {
        course: {
          include: {
            chapters: {
              include: {
                lessons: { orderBy: { position: "asc" }, take: 1, where: { isPublished: true } },
              },
              orderBy: { position: "asc" },
              take: 1,
              where: { isPublished: true },
            },
            organization: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: SQL_LIMIT,
      where: { course: getReadableCourseWhere(userId), userId },
    }),
  ]);

  const planRows: ContinueLearningRow[] = plans.flatMap((plan) => {
    const course = plan.course;
    const chapter = course.chapters[0];

    if (!chapter) {
      return [];
    }

    const lesson = chapter.lessons[0];

    return [
      {
        brandSlug: getCourseBrandSlug(course),
        chapterId: chapter.id,
        chapterPosition: chapter.position,
        chapterTitle: chapter.title,
        courseId: course.id,
        courseImageUrl: course.imageUrl,
        courseSlug: course.slug,
        courseTitle: course.title,
        lastActivityAt: plan.updatedAt,
        lessonId: lesson?.id ?? "",
        lessonPosition: lesson?.position ?? -1,
        orgSlug: course.organization?.slug ?? null,
      },
    ];
  });

  const recent = [...completions, ...planRows].toSorted(
    (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
  );

  const seen = new Set<string>();

  return recent
    .filter((row) => {
      if (seen.has(row.courseId)) {
        return false;
      }

      seen.add(row.courseId);
      return true;
    })
    .slice(0, SQL_LIMIT);
}
