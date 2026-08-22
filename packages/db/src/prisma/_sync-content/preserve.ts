import { type Client } from "pg";

type ReferenceCounts = {
  chapterCompletions: number;
  courseCompletions: number;
  coursePromptLinks: number;
  courseUsers: number;
  lessonProgress: number;
  stepAttempts: number;
};

const REFERENCE_KEYS = [
  "chapterCompletions",
  "courseCompletions",
  "coursePromptLinks",
  "courseUsers",
  "lessonProgress",
  "stepAttempts",
] as const satisfies readonly (keyof ReferenceCounts)[];

async function getReferenceCounts(destination: Client): Promise<ReferenceCounts> {
  const result = await destination.query<ReferenceCounts>(
    `SELECT
       (SELECT count(*)::int FROM local_chapter_completions) AS "chapterCompletions",
       (SELECT count(*)::int FROM local_course_completions) AS "courseCompletions",
       (SELECT count(*)::int FROM local_course_prompt_links) AS "coursePromptLinks",
       (SELECT count(*)::int FROM local_course_users) AS "courseUsers",
       (SELECT count(*)::int FROM local_lesson_progress) AS "lessonProgress",
       (SELECT count(*)::int FROM local_step_attempts) AS "stepAttempts"`,
  );

  return (
    result.rows[0] ?? {
      chapterCompletions: 0,
      courseCompletions: 0,
      coursePromptLinks: 0,
      courseUsers: 0,
      lessonProgress: 0,
      stepAttempts: 0,
    }
  );
}

export async function snapshotDestinationReferences({
  destination,
  organizationId,
}: {
  destination: Client;
  organizationId: string;
}): Promise<ReferenceCounts> {
  await destination.query(
    `CREATE TEMP TABLE local_course_users ON COMMIT DROP AS
       SELECT course_users.*, courses.slug AS course_slug
         FROM course_users
         JOIN courses ON courses.id = course_users.course_id
        WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_course_completions ON COMMIT DROP AS
       SELECT course_completions.*, courses.slug AS course_slug
         FROM course_completions
         JOIN courses ON courses.id = course_completions.course_id
        WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_chapter_completions ON COMMIT DROP AS
       SELECT chapter_completions.*, courses.slug AS course_slug, chapters.slug AS chapter_slug
         FROM chapter_completions
         JOIN chapters ON chapters.id = chapter_completions.chapter_id
         JOIN courses ON courses.id = chapters.course_id
        WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_lesson_progress ON COMMIT DROP AS
       SELECT lesson_progress.*, courses.slug AS course_slug, chapters.slug AS chapter_slug,
              lessons.slug AS lesson_slug
         FROM lesson_progress
         JOIN lessons ON lessons.id = lesson_progress.lesson_id
         JOIN chapters ON chapters.id = lessons.chapter_id
         JOIN courses ON courses.id = chapters.course_id
        WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_step_attempts ON COMMIT DROP AS
       SELECT step_attempts.*, courses.slug AS course_slug, chapters.slug AS chapter_slug,
              lessons.slug AS lesson_slug, steps.position AS step_position
         FROM step_attempts
         JOIN steps ON steps.id = step_attempts.step_id
         JOIN lessons ON lessons.id = steps.lesson_id
         JOIN chapters ON chapters.id = lessons.chapter_id
         JOIN courses ON courses.id = chapters.course_id
        WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_course_prompt_links ON COMMIT DROP AS
       SELECT course_prompts.id, courses.slug AS course_slug
         FROM course_prompts
         JOIN courses ON courses.id = course_prompts.course_id
        WHERE courses.organization_id = $1`,
    [organizationId],
  );

  return getReferenceCounts(destination);
}

function assertRestoredReferences({
  expected,
  restored,
}: {
  expected: ReferenceCounts;
  restored: ReferenceCounts;
}): void {
  const missingReference = REFERENCE_KEYS.find(
    (reference) => restored[reference] !== expected[reference],
  );

  if (missingReference) {
    throw new Error(`Could not preserve all local ${missingReference}`);
  }
}

export async function restoreDestinationReferences({
  destination,
  expected,
  organizationId,
}: {
  destination: Client;
  expected: ReferenceCounts;
  organizationId: string;
}): Promise<void> {
  const courseUsers = await destination.query(
    `INSERT INTO course_users (id, course_id, user_id, started_at)
         SELECT local.id, courses.id, local.user_id, local.started_at
           FROM local_course_users local
           JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug`,
    [organizationId],
  );

  const courseCompletions = await destination.query(
    `INSERT INTO course_completions (id, course_id, user_id, completed_at)
         SELECT local.id, courses.id, local.user_id, local.completed_at
           FROM local_course_completions local
           JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug`,
    [organizationId],
  );

  const chapterCompletions = await destination.query(
    `INSERT INTO chapter_completions (id, chapter_id, user_id, completed_at)
         SELECT local.id, chapters.id, local.user_id, local.completed_at
           FROM local_chapter_completions local
           JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug
           JOIN chapters ON chapters.course_id = courses.id AND chapters.slug = local.chapter_slug`,
    [organizationId],
  );

  const lessonProgress = await destination.query(
    `INSERT INTO lesson_progress
           (id, user_id, lesson_id, started_at, completed_at, completed_date, duration_seconds)
         SELECT local.id, local.user_id, lessons.id, local.started_at, local.completed_at,
                local.completed_date, local.duration_seconds
           FROM local_lesson_progress local
           JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug
           JOIN chapters ON chapters.course_id = courses.id AND chapters.slug = local.chapter_slug
           JOIN lessons ON lessons.chapter_id = chapters.id AND lessons.slug = local.lesson_slug`,
    [organizationId],
  );

  const stepAttempts = await destination.query(
    `INSERT INTO step_attempts
           (id, user_id, step_id, is_correct, answer, effects, duration_seconds, answered_at,
            hour_of_day, day_of_week)
         SELECT local.id, local.user_id, steps.id, local.is_correct, local.answer, local.effects,
                local.duration_seconds, local.answered_at, local.hour_of_day, local.day_of_week
           FROM local_step_attempts local
           JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug
           JOIN chapters ON chapters.course_id = courses.id AND chapters.slug = local.chapter_slug
           JOIN lessons ON lessons.chapter_id = chapters.id AND lessons.slug = local.lesson_slug
           JOIN steps ON steps.lesson_id = lessons.id AND steps.position = local.step_position`,
    [organizationId],
  );

  const prompts = await destination.query(
    `UPDATE course_prompts prompts
            SET course_id = courses.id
           FROM local_course_prompt_links local
           JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug
          WHERE prompts.id = local.id`,
    [organizationId],
  );

  const restored = {
    chapterCompletions: chapterCompletions.rowCount ?? 0,
    courseCompletions: courseCompletions.rowCount ?? 0,
    coursePromptLinks: prompts.rowCount ?? 0,
    courseUsers: courseUsers.rowCount ?? 0,
    lessonProgress: lessonProgress.rowCount ?? 0,
    stepAttempts: stepAttempts.rowCount ?? 0,
  };

  assertRestoredReferences({ expected, restored });

  await destination.query(
    `UPDATE courses
        SET user_count = (SELECT count(*) FROM course_users WHERE course_users.course_id = courses.id)
      WHERE organization_id = $1`,
    [organizationId],
  );
}
