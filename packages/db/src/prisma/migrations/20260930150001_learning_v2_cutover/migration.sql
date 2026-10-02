-- Learning v2 cutover.
--
-- Moves learners from the legacy courses to learning v2 and removes the legacy tables, in one
-- transaction: if anything fails, nothing changes and the deploy stops with the legacy data intact.
--   1. Copy legacy progress into the content-free stats tables (daily_progress.lessons_completed and
--      the learning_events ledger), so every progress page shows the same numbers afterwards.
--   2. Offer each learner their three most recent courses as suggested goals.
--   3. Delete the courses learners made for themselves before the Library.
--   4. Drop the legacy tables, columns and enums.
-- Kept: organization courses, course prompts, words, sentences, pronunciations, user_progress,
-- daily_progress, learning_events, question threads and questions (without their legacy links),
-- feedback, users, profiles and subscriptions. Generation quotas and course edition requests go too.
BEGIN;

-- The running release keeps writing legacy progress while this deploy builds. Blocking those writes
-- until the tables are gone makes each one fail whole instead of being dropped after the copy.
LOCK TABLE lesson_progress, step_attempts, chapter_completions, course_completions, course_users IN SHARE MODE;

-- 1a. Daily totals: first lesson completions per learner-local day. A day with completions but no
--     daily row gets one that carries the Energy of the learner's previous daily row forward.
WITH completion_days AS (
  SELECT
    lp.user_id,
    COALESCE(lp.completed_date, lp.completed_at::date) AS local_date,
    COUNT(*)::int AS lessons_completed
  FROM lesson_progress lp
  WHERE lp.completed_at IS NOT NULL
  GROUP BY lp.user_id, COALESCE(lp.completed_date, lp.completed_at::date)
),
timeline AS (
  SELECT dp.user_id, dp.date, dp.energy_at_end
  FROM daily_progress dp
  WHERE dp.user_id IN (SELECT user_id FROM completion_days)
  UNION ALL
  SELECT days.user_id, days.local_date, NULL
  FROM completion_days days
  WHERE NOT EXISTS (
    SELECT 1 FROM daily_progress dp WHERE dp.user_id = days.user_id AND dp.date = days.local_date
  )
),
energy_groups AS (
  SELECT
    timeline.*,
    COUNT(energy_at_end) OVER (PARTITION BY user_id ORDER BY date) AS energy_group
  FROM timeline
),
carried_energy AS (
  SELECT
    user_id,
    date,
    FIRST_VALUE(energy_at_end) OVER (PARTITION BY user_id, energy_group ORDER BY date) AS energy_at_end
  FROM energy_groups
)
INSERT INTO daily_progress (user_id, date, day_of_week, lessons_completed, energy_at_end)
SELECT
  days.user_id,
  days.local_date,
  EXTRACT(DOW FROM days.local_date)::smallint,
  days.lessons_completed,
  COALESCE(carried.energy_at_end, 0)
FROM completion_days days
JOIN carried_energy carried ON carried.user_id = days.user_id AND carried.date = days.local_date
ON CONFLICT (user_id, date) DO UPDATE
SET lessons_completed = EXCLUDED.lessons_completed
WHERE daily_progress.lessons_completed < EXCLUDED.lessons_completed;

-- 1b. The ledger: one row per legacy lesson start and first completion, and one per later replay.
--   * A `lesson` row per lesson_progress row, with its id. A lesson that was started and never
--     finished keeps ended_at NULL, so completion rates survive.
--   * A `review` row per later replay, with the id of its first step attempt. The legacy completion
--     flow saved all attempts of one completion in one insert, so attempts saved within 5 seconds of
--     each other (by their uuidv7 timestamp) belong to the same completion.
--   * Local hour and weekday come from step attempts, which store them in the learner's time zone.
--     Lessons without attempts use the learner's UTC offset from their latest attempt (UTC if none).
--   * Brain Power and Energy follow the legacy completion rules: 10 Brain Power per completion, and
--     +0.2 Energy per correct answer, -0.1 per incorrect one, +0.1 for a lesson without questions.
WITH attempts AS (
  SELECT
    sa.id,
    sa.user_id,
    s.lesson_id,
    sa.answered_at,
    sa.hour_of_day,
    sa.day_of_week,
    sa.duration_seconds,
    COALESCE(sa.correct_answers, sa.is_correct::int) AS correct_answers,
    COALESCE(sa.incorrect_answers, (NOT sa.is_correct)::int) AS incorrect_answers,
    COALESCE(uuid_extract_timestamp(sa.id) AT TIME ZONE 'UTC', sa.answered_at) AS saved_at,
    -- Learner-local minus UTC hours of the week, normalized to [-84, 84).
    (
      (
        (sa.day_of_week * 24 + sa.hour_of_day)
        - (EXTRACT(DOW FROM sa.answered_at)::int * 24 + EXTRACT(HOUR FROM sa.answered_at)::int)
      ) % 168 + 252
    ) % 168 - 84 AS offset_hours
  FROM step_attempts sa
  JOIN steps s ON s.id = sa.step_id
),
attempt_starts AS (
  SELECT
    attempts.*,
    CASE
      WHEN saved_at - LAG(saved_at) OVER (PARTITION BY user_id ORDER BY saved_at, id) <= INTERVAL '5 seconds'
        THEN 0
      ELSE 1
    END AS starts_completion
  FROM attempts
),
attempt_completions AS (
  SELECT
    attempt_starts.*,
    SUM(starts_completion) OVER (PARTITION BY user_id ORDER BY saved_at, id) AS completion_number
  FROM attempt_starts
),
completions AS (
  SELECT
    (ARRAY_AGG(id ORDER BY saved_at, id))[1] AS id,
    user_id,
    (ARRAY_AGG(lesson_id ORDER BY saved_at, id))[1] AS lesson_id,
    ARRAY_AGG(DISTINCT lesson_id) AS lesson_ids,
    MAX(saved_at) AS saved_at,
    (ARRAY_AGG(answered_at ORDER BY answered_at DESC, id DESC))[1] AS last_answered_at,
    (ARRAY_AGG(hour_of_day ORDER BY answered_at DESC, id DESC))[1] AS hour,
    (ARRAY_AGG(day_of_week ORDER BY answered_at DESC, id DESC))[1] AS weekday,
    (ARRAY_AGG(offset_hours ORDER BY answered_at DESC, id DESC))[1] AS offset_hours,
    SUM(correct_answers)::int AS correct_answers,
    SUM(incorrect_answers)::int AS incorrect_answers,
    SUM(duration_seconds)::int AS seconds
  FROM attempt_completions
  GROUP BY user_id, completion_number
),
-- A first completion saved its attempts in the same transaction as lesson_progress.completed_at.
-- Review lessons answer steps of other lessons, so only they skip the lesson check.
completion_candidates AS (
  SELECT
    lp.id AS progress_id,
    completions.id AS completion_id,
    ABS(EXTRACT(EPOCH FROM completions.saved_at - lp.completed_at)) AS distance
  FROM completions
  JOIN lesson_progress lp
    ON lp.user_id = completions.user_id
    AND lp.completed_at BETWEEN completions.saved_at - INTERVAL '1 minute'
      AND completions.saved_at + INTERVAL '1 minute'
  JOIN lessons l ON l.id = lp.lesson_id
  WHERE lp.lesson_id = ANY (completions.lesson_ids) OR l.kind = 'review'
),
nearest_progress AS (
  SELECT DISTINCT ON (completion_id) progress_id, completion_id, distance
  FROM completion_candidates
  ORDER BY completion_id, distance, progress_id
),
first_completions AS (
  SELECT DISTINCT ON (progress_id) progress_id, completion_id
  FROM nearest_progress
  ORDER BY progress_id, distance, completion_id
),
user_offsets AS (
  SELECT DISTINCT ON (user_id) user_id, offset_hours
  FROM attempts
  ORDER BY user_id, answered_at DESC, id DESC
),
progress_events AS (
  SELECT
    lp.id,
    lp.user_id,
    'lesson'::"LearningEventKind" AS kind,
    l.kind::text AS lesson_kind,
    lp.started_at,
    lp.completed_at AS ended_at,
    local_time.local_date,
    COALESCE(c.hour, EXTRACT(HOUR FROM shifted.local_at)::int) AS hour,
    EXTRACT(DOW FROM local_time.local_date)::int AS weekday,
    COALESCE(c.correct_answers, 0) AS correct_answers,
    COALESCE(c.incorrect_answers, 0) AS incorrect_answers,
    COALESCE(lp.duration_seconds, 0) AS seconds,
    CASE WHEN lp.completed_at IS NULL THEN 0 ELSE 10 END AS brain_power,
    CASE
      WHEN lp.completed_at IS NULL THEN 0
      WHEN c.id IS NULL THEN 0.1
      ELSE ROUND(c.correct_answers * 0.2 - c.incorrect_answers * 0.1, 2)
    END AS energy_delta,
    jsonb_build_object('courseId', ch.course_id, 'legacyChapterId', ch.id, 'legacyLessonId', l.id) AS content_ids,
    COALESCE(l.title, ch.title) AS title_snapshot
  FROM lesson_progress lp
  JOIN lessons l ON l.id = lp.lesson_id
  JOIN chapters ch ON ch.id = l.chapter_id
  LEFT JOIN first_completions fc ON fc.progress_id = lp.id
  LEFT JOIN completions c ON c.id = fc.completion_id
  LEFT JOIN user_offsets uo ON uo.user_id = lp.user_id
  CROSS JOIN LATERAL (
    SELECT COALESCE(lp.completed_at, lp.started_at) + COALESCE(uo.offset_hours, 0) * INTERVAL '1 hour' AS local_at
  ) shifted
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN lp.completed_at IS NULL THEN shifted.local_at::date
        ELSE COALESCE(lp.completed_date, shifted.local_at::date)
      END AS local_date
  ) local_time
),
replay_events AS (
  SELECT
    c.id,
    c.user_id,
    'review'::"LearningEventKind" AS kind,
    l.kind::text AS lesson_kind,
    c.saved_at - c.seconds * INTERVAL '1 second' AS started_at,
    c.saved_at AS ended_at,
    (c.last_answered_at + c.offset_hours * INTERVAL '1 hour')::date AS local_date,
    c.hour,
    c.weekday,
    c.correct_answers,
    c.incorrect_answers,
    c.seconds,
    10 AS brain_power,
    ROUND(c.correct_answers * 0.2 - c.incorrect_answers * 0.1, 2) AS energy_delta,
    jsonb_build_object('courseId', ch.course_id, 'legacyChapterId', ch.id, 'legacyLessonId', l.id) AS content_ids,
    COALESCE(l.title, ch.title) AS title_snapshot
  FROM completions c
  JOIN lessons l ON l.id = c.lesson_id
  JOIN chapters ch ON ch.id = l.chapter_id
  WHERE NOT EXISTS (SELECT 1 FROM first_completions fc WHERE fc.completion_id = c.id)
)
INSERT INTO learning_events (
  id,
  user_id,
  kind,
  lesson_kind,
  started_at,
  ended_at,
  local_date,
  hour,
  weekday,
  correct_answers,
  incorrect_answers,
  seconds,
  brain_power,
  energy_delta,
  content_ids,
  title_snapshot
)
SELECT * FROM progress_events
UNION ALL
SELECT * FROM replay_events
ON CONFLICT (id) DO NOTHING;

-- 2. Suggested goals: each learner's three most recent courses, newest first (where they finished or
--    replayed lessons, the courses they started and their own courses), leaving out courses they
--    completed. Today offers them one at a time ("Continue Physics?").
WITH activity AS (
  SELECT lp.user_id, ch.course_id, COALESCE(lp.completed_at, lp.started_at) AS active_at
  FROM lesson_progress lp
  JOIN lessons l ON l.id = lp.lesson_id
  JOIN chapters ch ON ch.id = l.chapter_id
  UNION ALL
  SELECT sa.user_id, ch.course_id, sa.answered_at
  FROM step_attempts sa
  JOIN steps s ON s.id = sa.step_id
  JOIN lessons l ON l.id = s.lesson_id
  JOIN chapters ch ON ch.id = l.chapter_id
  UNION ALL
  SELECT cu.user_id, cu.course_id, cu.started_at
  FROM course_users cu
  UNION ALL
  SELECT c.user_id, c.id, c.created_at
  FROM courses c
  WHERE c.user_id IS NOT NULL AND c.organization_id IS NULL AND c.visibility = 'public'
),
learner_courses AS (
  SELECT activity.user_id, activity.course_id, MAX(activity.active_at) AS last_active_at
  FROM activity
  WHERE NOT EXISTS (
    SELECT 1
    FROM course_completions cc
    WHERE cc.user_id = activity.user_id AND cc.course_id = activity.course_id
  )
  GROUP BY activity.user_id, activity.course_id
),
ranked AS (
  SELECT
    learner_courses.*,
    ROW_NUMBER() OVER (
      PARTITION BY learner_courses.user_id
      ORDER BY learner_courses.last_active_at DESC, learner_courses.course_id
    ) AS position
  FROM learner_courses
)
INSERT INTO suggested_goals (user_id, course_id, title, last_active_at)
SELECT ranked.user_id, ranked.course_id, c.title, ranked.last_active_at
FROM ranked
JOIN courses c ON c.id = ranked.course_id
WHERE ranked.position <= 3
ON CONFLICT (user_id, course_id) DO NOTHING;

-- 3. Courses a learner made for themselves before the Library (owned by a user, not an organization,
--    and public: private Library courses are never matched). Their suggested goals keep the title.
DELETE FROM courses
WHERE user_id IS NOT NULL AND organization_id IS NULL AND visibility = 'public';

-- 4. The legacy tables, columns and enums, and the legacy tables learning v2 no longer uses
--    (generation quotas and course edition requests).

-- DropForeignKey
ALTER TABLE "chapter_completions" DROP CONSTRAINT "chapter_completions_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "chapter_completions" DROP CONSTRAINT "chapter_completions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "chapter_sentences" DROP CONSTRAINT "chapter_sentences_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "chapter_sentences" DROP CONSTRAINT "chapter_sentences_sentence_id_fkey";

-- DropForeignKey
ALTER TABLE "chapter_sentences" DROP CONSTRAINT "chapter_sentences_source_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "chapter_words" DROP CONSTRAINT "chapter_words_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "chapter_words" DROP CONSTRAINT "chapter_words_source_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "chapter_words" DROP CONSTRAINT "chapter_words_word_id_fkey";

-- DropForeignKey
ALTER TABLE "chapters" DROP CONSTRAINT "chapters_course_id_fkey";

-- DropForeignKey
ALTER TABLE "chapters" DROP CONSTRAINT "chapters_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "course_completions" DROP CONSTRAINT "course_completions_course_id_fkey";

-- DropForeignKey
ALTER TABLE "course_completions" DROP CONSTRAINT "course_completions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "course_edition_requests" DROP CONSTRAINT "course_edition_requests_course_prompt_id_fkey";

-- DropForeignKey
ALTER TABLE "course_edition_requests" DROP CONSTRAINT "course_edition_requests_source_course_id_fkey";

-- DropForeignKey
ALTER TABLE "course_users" DROP CONSTRAINT "course_users_course_id_fkey";

-- DropForeignKey
ALTER TABLE "course_users" DROP CONSTRAINT "course_users_user_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_progress" DROP CONSTRAINT "lesson_progress_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_progress" DROP CONSTRAINT "lesson_progress_user_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_question_threads" DROP CONSTRAINT "lesson_question_threads_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_questions" DROP CONSTRAINT "lesson_questions_step_id_fkey";

-- DropForeignKey
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "step_attempts" DROP CONSTRAINT "step_attempts_step_id_fkey";

-- DropForeignKey
ALTER TABLE "step_attempts" DROP CONSTRAINT "step_attempts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "steps" DROP CONSTRAINT "steps_chapter_sentence_id_fkey";

-- DropForeignKey
ALTER TABLE "steps" DROP CONSTRAINT "steps_chapter_word_id_fkey";

-- DropForeignKey
ALTER TABLE "steps" DROP CONSTRAINT "steps_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "steps" DROP CONSTRAINT "steps_sentence_id_fkey";

-- DropForeignKey
ALTER TABLE "steps" DROP CONSTRAINT "steps_word_id_fkey";

-- DropIndex
DROP INDEX "lesson_question_threads_lesson_id_idx";

-- DropIndex
DROP INDEX "lesson_question_threads_user_id_lesson_id_key";

-- DropIndex
DROP INDEX "lesson_questions_step_id_idx";

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "completed_at",
DROP COLUMN "generation_run_id",
DROP COLUMN "generation_status";

-- AlterTable
ALTER TABLE "lesson_question_threads" DROP COLUMN "lesson_id";

-- AlterTable
ALTER TABLE "lesson_questions" DROP COLUMN "step_id";

-- DropTable
DROP TABLE "chapter_completions";

-- DropTable
DROP TABLE "chapter_sentences";

-- DropTable
DROP TABLE "chapter_words";

-- DropTable
DROP TABLE "chapters";

-- DropTable
DROP TABLE "course_completions";

-- DropTable
DROP TABLE "course_edition_requests";

-- DropTable
DROP TABLE "course_users";

-- DropTable
DROP TABLE "generation_quota_claims";

-- DropTable
DROP TABLE "generation_quota_counters";

-- DropTable
DROP TABLE "lesson_progress";

-- DropTable
DROP TABLE "lessons";

-- DropTable
DROP TABLE "step_attempts";

-- DropTable
DROP TABLE "steps";

-- DropEnum
DROP TYPE "GenerationQuotaPeriod";

-- DropEnum
DROP TYPE "GenerationQuotaResource";

-- DropEnum
DROP TYPE "LessonKind";

-- DropEnum
DROP TYPE "StepKind";

COMMIT;
