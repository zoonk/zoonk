import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma, sql } from "@zoonk/db";

/** A run still marked running after this long has almost certainly died without saying so. */
export const STUCK_RUNNING_MINUTES = 60;

const LATEST_FAILURES_PER_WORKFLOW = 5;

/** The workflows the queries below report, in the order the counts table lists them. */
export type GenerationWorkflow =
  | "lessonContent"
  | "lessonSpec"
  | "chapterOutline"
  | "courseOutline"
  | "lessonQuestion";

type WorkflowCountRow = { failed: bigint; stuck: bigint; workflow: GenerationWorkflow };

export type GenerationFailure = {
  id: string;
  label: string;
  parentId: string | null;
  status: "failed" | "running";
  updatedAt: Date;
  workflow: GenerationWorkflow;
};

/** Workflows write `updated_at` through Prisma in UTC, so the cutoff is UTC too. */
const stuckBeforeSql = sql`(NOW() AT TIME ZONE 'UTC') - make_interval(mins => ${STUCK_RUNNING_MINUTES}::int)`;

/** Failed and stuck rows per workflow, counted in one pass over each table. */
function countFailures() {
  return prisma.$queryRaw<WorkflowCountRow[]>`
    SELECT 1 AS position, 'lessonContent' AS workflow,
      COUNT(*) FILTER (WHERE content_status = 'failed') AS failed,
      COUNT(*) FILTER (WHERE content_status = 'running' AND updated_at < ${stuckBeforeSql}) AS stuck
    FROM library_lessons
    UNION ALL SELECT 2, 'lessonSpec',
      COUNT(*) FILTER (WHERE spec_status = 'failed'),
      COUNT(*) FILTER (WHERE spec_status = 'running' AND updated_at < ${stuckBeforeSql})
    FROM library_lessons
    UNION ALL SELECT 3, 'chapterOutline',
      COUNT(*) FILTER (WHERE outline_status = 'failed'),
      COUNT(*) FILTER (WHERE outline_status = 'running' AND updated_at < ${stuckBeforeSql})
    FROM library_chapters
    UNION ALL SELECT 4, 'courseOutline',
      COUNT(*) FILTER (WHERE outline_status = 'failed'),
      COUNT(*) FILTER (WHERE outline_status = 'running' AND updated_at < ${stuckBeforeSql})
    FROM courses
    UNION ALL SELECT 5, 'lessonQuestion',
      COUNT(*) FILTER (WHERE status = 'failed'),
      COUNT(*) FILTER (WHERE status = 'running' AND updated_at < ${stuckBeforeSql})
    FROM lesson_questions
    ORDER BY position
  `;
}

/**
 * The latest failed or stuck rows of each workflow, with the parent course of chapters, which
 * have no admin page of their own.
 */
function listLatestFailures() {
  const limit = LATEST_FAILURES_PER_WORKFLOW;

  return prisma.$queryRaw<GenerationFailure[]>`
    (SELECT 'lessonContent' AS workflow, id, title AS label, NULL::uuid AS "parentId",
      content_status::text AS status, updated_at AS "updatedAt"
    FROM library_lessons
    WHERE content_status = 'failed' OR (content_status = 'running' AND updated_at < ${stuckBeforeSql})
    ORDER BY updated_at DESC LIMIT ${limit})
    UNION ALL (SELECT 'lessonSpec', id, title, NULL::uuid, spec_status::text, updated_at
    FROM library_lessons
    WHERE spec_status = 'failed' OR (spec_status = 'running' AND updated_at < ${stuckBeforeSql})
    ORDER BY updated_at DESC LIMIT ${limit})
    UNION ALL (SELECT 'chapterOutline', id, title, home_course_id, outline_status::text, updated_at
    FROM library_chapters
    WHERE outline_status = 'failed' OR (outline_status = 'running' AND updated_at < ${stuckBeforeSql})
    ORDER BY updated_at DESC LIMIT ${limit})
    UNION ALL (SELECT 'courseOutline', id, title, NULL::uuid, outline_status::text, updated_at
    FROM courses
    WHERE outline_status = 'failed' OR (outline_status = 'running' AND updated_at < ${stuckBeforeSql})
    ORDER BY updated_at DESC LIMIT ${limit})
    UNION ALL (SELECT 'lessonQuestion', id, question, NULL::uuid, status::text, updated_at
    FROM lesson_questions
    WHERE status = 'failed' OR (status = 'running' AND updated_at < ${stuckBeforeSql})
    ORDER BY updated_at DESC LIMIT ${limit})
  `;
}

/**
 * Generation failures by workflow: how many rows failed or are stuck running, and the latest of
 * them newest first, so admins can open and retry them.
 */
export const getGenerationFailures = cacheAdminData(async () => {
  const [counts, latest] = await Promise.all([countFailures(), listLatestFailures()]);

  return {
    counts: counts.map((row) => ({
      failed: Number(row.failed),
      stuck: Number(row.stuck),
      workflow: row.workflow,
    })),
    latest: latest.toSorted((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
  };
});
