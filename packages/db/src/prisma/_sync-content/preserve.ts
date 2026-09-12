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
    `UPDATE course_completions history SET content_snapshot = COALESCE(content_snapshot, jsonb_build_object('courseId', courses.id, 'courseTitle', courses.title, 'contentRevision', courses.content_revision)) FROM courses WHERE history.course_id = courses.id AND courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `UPDATE chapter_completions history SET content_snapshot = COALESCE(content_snapshot, jsonb_build_object('courseId', courses.id, 'courseTitle', courses.title, 'chapterId', chapters.id, 'chapterTitle', chapters.title, 'contentRevision', courses.content_revision)) FROM chapters JOIN courses ON courses.id = chapters.course_id WHERE history.chapter_id = chapters.id AND courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `UPDATE lesson_progress history SET content_snapshot = COALESCE(content_snapshot, jsonb_build_object('courseId', courses.id, 'courseTitle', courses.title, 'chapterId', chapters.id, 'chapterTitle', chapters.title, 'lessonId', lessons.id, 'lessonTitle', lessons.title, 'lessonKind', lessons.kind, 'contentRevision', courses.content_revision)) FROM lessons JOIN chapters ON chapters.id = lessons.chapter_id JOIN courses ON courses.id = chapters.course_id WHERE history.lesson_id = lessons.id AND courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `UPDATE step_attempts history SET content_snapshot = COALESCE(content_snapshot, jsonb_build_object('courseId', courses.id, 'courseTitle', courses.title, 'chapterId', chapters.id, 'chapterTitle', chapters.title, 'lessonId', lessons.id, 'lessonTitle', lessons.title, 'stepId', steps.id, 'contentRevision', courses.content_revision)) FROM steps JOIN lessons ON lessons.id = steps.lesson_id JOIN chapters ON chapters.id = lessons.chapter_id JOIN courses ON courses.id = chapters.course_id WHERE history.step_id = steps.id AND courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_course_chapters ON COMMIT DROP AS SELECT chapters.id, chapters.slug, courses.slug AS course_slug FROM chapters JOIN courses ON courses.id = chapters.course_id WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_course_learning_plans ON COMMIT DROP AS SELECT plans.*, courses.slug AS course_slug FROM course_learning_plans plans JOIN courses ON courses.id = plans.course_id WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_track_courses ON COMMIT DROP AS SELECT members.*, courses.slug AS course_slug FROM track_courses members JOIN courses ON courses.id = members.course_id WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_chapter_generation_grants ON COMMIT DROP AS SELECT grants.*, chapters.slug AS chapter_slug, courses.slug AS course_slug, courses.content_revision FROM chapter_generation_grants grants JOIN chapters ON chapters.id = grants.chapter_id JOIN courses ON courses.id = chapters.course_id WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_discovery_courses ON COMMIT DROP AS SELECT discoveries.id, courses.slug AS course_slug FROM course_discoveries discoveries JOIN courses ON courses.id = discoveries.course_id WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_course_users ON COMMIT DROP AS
       SELECT course_users.*, courses.slug AS course_slug, courses.content_revision AS course_content_revision
         FROM course_users
         JOIN courses ON courses.id = course_users.course_id
        WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_course_completions ON COMMIT DROP AS
       SELECT course_completions.*, courses.slug AS course_slug, courses.content_revision AS course_content_revision
         FROM course_completions
         JOIN courses ON courses.id = course_completions.course_id
        WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_chapter_completions ON COMMIT DROP AS
       SELECT chapter_completions.*, courses.slug AS course_slug, courses.content_revision AS course_content_revision, chapters.slug AS chapter_slug
         FROM chapter_completions
         JOIN chapters ON chapters.id = chapter_completions.chapter_id
         JOIN courses ON courses.id = chapters.course_id
        WHERE courses.organization_id = $1`,
    [organizationId],
  );

  await destination.query(
    `CREATE TEMP TABLE local_lesson_progress ON COMMIT DROP AS
       SELECT lesson_progress.*, courses.slug AS course_slug, courses.content_revision AS course_content_revision, chapters.slug AS chapter_slug,
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
       SELECT step_attempts.*, courses.slug AS course_slug, courses.content_revision AS course_content_revision, chapters.slug AS chapter_slug,
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
       SELECT course_prompts.id, courses.slug AS course_slug, courses.content_revision AS course_content_revision
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

  // Nullable historical rows survive deletion. Reattach only the same revision;
  // detached history remains durable if the imported curriculum changed.
  const courseCompletions = await destination.query(
    `UPDATE course_completions history SET course_id = courses.id
       FROM local_course_completions local
       LEFT JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug AND courses.content_revision = local.course_content_revision
      WHERE history.id = local.id`,
    [organizationId],
  );

  const chapterCompletions = await destination.query(
    `UPDATE chapter_completions history SET chapter_id = chapters.id
       FROM local_chapter_completions local
       LEFT JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug AND courses.content_revision = local.course_content_revision
       LEFT JOIN chapters ON chapters.course_id = courses.id AND chapters.slug = local.chapter_slug
      WHERE history.id = local.id`,
    [organizationId],
  );

  const lessonProgress = await destination.query(
    `UPDATE lesson_progress history SET lesson_id = lessons.id
       FROM local_lesson_progress local
       LEFT JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug AND courses.content_revision = local.course_content_revision
       LEFT JOIN chapters ON chapters.course_id = courses.id AND chapters.slug = local.chapter_slug
       LEFT JOIN lessons ON lessons.chapter_id = chapters.id AND lessons.slug = local.lesson_slug
      WHERE history.id = local.id`,
    [organizationId],
  );

  const stepAttempts = await destination.query(
    `UPDATE step_attempts history SET step_id = steps.id
       FROM local_step_attempts local
       LEFT JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug AND courses.content_revision = local.course_content_revision
       LEFT JOIN chapters ON chapters.course_id = courses.id AND chapters.slug = local.chapter_slug
       LEFT JOIN lessons ON lessons.chapter_id = chapters.id AND lessons.slug = local.lesson_slug
       LEFT JOIN steps ON steps.lesson_id = lessons.id AND steps.position = local.step_position
      WHERE history.id = local.id`,
    [organizationId],
  );

  const plans = await destination.query(
    `INSERT INTO course_learning_plans (id, user_id, course_id, goal, starting_knowledge, depth, starting_level, daily_minutes, hidden_lesson_kinds, chapter_ids, content_revision, revision, summary, created_at, updated_at)
    SELECT local.id, local.user_id, courses.id, local.goal, local.starting_knowledge, local.depth, local.starting_level, local.daily_minutes, local.hidden_lesson_kinds,
      CASE WHEN mapped.count = cardinality(local.chapter_ids) THEN mapped.ids ELSE '{}'::uuid[] END,
      CASE WHEN mapped.count = cardinality(local.chapter_ids) AND local.content_revision = courses.content_revision THEN courses.content_revision ELSE 0 END,
      local.revision, local.summary, local.created_at, local.updated_at
    FROM local_course_learning_plans local
    JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug
    CROSS JOIN LATERAL (SELECT count(chapters.id)::int AS count, COALESCE(array_agg(chapters.id ORDER BY selected.position) FILTER (WHERE chapters.id IS NOT NULL), '{}'::uuid[]) AS ids FROM unnest(local.chapter_ids) WITH ORDINALITY selected(id, position) LEFT JOIN local_course_chapters old ON old.id = selected.id LEFT JOIN chapters ON chapters.course_id = courses.id AND chapters.slug = old.slug) mapped`,
    [organizationId],
  );

  const trackCourses = await destination.query(
    `INSERT INTO track_courses (id, track_id, course_id, position) SELECT local.id, local.track_id, courses.id, local.position FROM local_track_courses local JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug`,
    [organizationId],
  );

  // Pending Tracks retain their request after member rows are recreated. Keep its
  // resolved subject identities aligned so a later member can resume the request.
  await destination.query(
    `UPDATE tracks SET request = jsonb_set(request, '{subjects}', (
      SELECT jsonb_agg(
        CASE WHEN replacement.id IS NOT NULL
          THEN jsonb_set(subject.value, '{courseId}', to_jsonb(replacement.id::text))
          ELSE subject.value END ORDER BY subject.position)
      FROM jsonb_array_elements(tracks.request->'subjects') WITH ORDINALITY subject(value, position)
      LEFT JOIN local_track_courses local ON local.track_id = tracks.id AND local.course_id::text = subject.value->>'courseId'
      LEFT JOIN courses replacement ON replacement.organization_id = $1 AND replacement.slug = local.course_slug
    )) WHERE jsonb_typeof(request->'subjects') = 'array'
      AND EXISTS (SELECT 1 FROM local_track_courses local WHERE local.track_id = tracks.id)`,
    [organizationId],
  );

  await destination.query(
    `INSERT INTO chapter_generation_grants (id, user_id, chapter_id, created_at) SELECT local.id, local.user_id, chapters.id, local.created_at FROM local_chapter_generation_grants local JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug AND courses.content_revision = local.content_revision JOIN chapters ON chapters.course_id = courses.id AND chapters.slug = local.chapter_slug`,
    [organizationId],
  );

  const discoveries = await destination.query(
    `UPDATE course_discoveries discoveries SET course_id = courses.id FROM local_discovery_courses local JOIN courses ON courses.organization_id = $1 AND courses.slug = local.course_slug WHERE discoveries.id = local.id`,
    [organizationId],
  );

  const preserved = await destination.query<{ plans: number; tracks: number; discoveries: number }>(
    `SELECT (SELECT count(*)::int FROM local_course_learning_plans) AS plans, (SELECT count(*)::int FROM local_track_courses) AS tracks, (SELECT count(*)::int FROM local_discovery_courses) AS discoveries`,
  );

  if (
    preserved.rows[0]?.plans !== plans.rowCount ||
    preserved.rows[0]?.tracks !== trackCourses.rowCount ||
    preserved.rows[0]?.discoveries !== discoveries.rowCount
  ) {
    throw new Error("Could not preserve all local course preferences, Tracks, and discoveries");
  }

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
