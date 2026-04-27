import { prisma, sql } from "@zoonk/db";
import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { safeAsync } from "@zoonk/utils/error";
import { buildStepImageCountMap, toNumber } from "./ai-cost-estimate-helpers";
import {
  type LanguageAudioUsageRow,
  type StepImageUsageRow,
  type StructureStats,
} from "./ai-cost-estimate-types";

type DateWindow = {
  endExclusive: Date;
  startAt: Date;
};

/**
 * The workflow estimates depend on a handful of aggregate counts. This loader
 * gathers the persisted content shape for the selected period so the cost math
 * can stay focused on translating those averages into workflow estimates.
 */
export async function getStructureStats({
  endDate,
  startDate,
}: {
  endDate: string;
  startDate: string;
}): Promise<StructureStats> {
  const dateWindow = buildDateWindow({ endDate, startDate });
  const [lessonAndActivityCounts, courseShapeCounts, stepImageRows, languageAudioUsage] =
    await Promise.all([
      getLessonAndActivityCounts({ dateWindow }),
      getCourseShapeCounts({ dateWindow }),
      getStepImageUsageRows({ dateWindow }),
      getLanguageAudioUsage({ dateWindow }),
    ]);

  return {
    ...lessonAndActivityCounts,
    ...courseShapeCounts,
    languageAudioSentenceWordCount: toNumber(languageAudioUsage.sentenceWordCount),
    languageAudioWordClipCount: toNumber(languageAudioUsage.wordClipCount),
    stepImageCountsByActivityKind: buildStepImageCountMap(stepImageRows),
  };
}

/**
 * Content records use full timestamps while the AI stats filters work with
 * whole UTC dates. Converting the selected day range into an inclusive start
 * and exclusive end keeps the database queries aligned with the Gateway report
 * window.
 */
function buildDateWindow({
  endDate,
  startDate,
}: {
  endDate: string;
  startDate: string;
}): DateWindow {
  const startAt = parseLocalDate(startDate);
  const endExclusive = new Date(parseLocalDate(endDate).getTime() + MS_PER_DAY);

  return { endExclusive, startAt };
}

/**
 * Lesson-level estimates care about how many activities of each kind actually
 * got created inside completed AI-managed lessons during the selected period.
 */
async function getLessonAndActivityCounts({ dateWindow }: { dateWindow: DateWindow }) {
  const completedLessonWhere = buildCompletedLessonWhere({ dateWindow });

  const [
    coreLessonCount,
    customLessonCount,
    languageLessonCount,
    coreLessonExplanationCount,
    coreLessonPracticeCount,
    coreLessonQuizCount,
    customActivityCount,
  ] = await Promise.all([
    prisma.lesson.count({ where: { ...completedLessonWhere, kind: "core" } }),
    prisma.lesson.count({ where: { ...completedLessonWhere, kind: "custom" } }),
    prisma.lesson.count({ where: { ...completedLessonWhere, kind: "language" } }),
    countActivities({
      activityKind: "explanation",
      lessonKind: "core",
      where: completedLessonWhere,
    }),
    countActivities({ activityKind: "practice", lessonKind: "core", where: completedLessonWhere }),
    countActivities({ activityKind: "quiz", lessonKind: "core", where: completedLessonWhere }),
    countActivities({ activityKind: "custom", lessonKind: "custom", where: completedLessonWhere }),
  ]);

  return {
    coreLessonCount,
    coreLessonExplanationCount,
    coreLessonPracticeCount,
    coreLessonQuizCount,
    customActivityCount,
    customLessonCount,
    languageLessonCount,
  };
}

/**
 * Course estimates need both the course shell counts and the generated
 * curriculum shape beneath them so full-course totals can extend beyond the
 * first chapter that the workflow creates immediately.
 */
async function getCourseShapeCounts({ dateWindow }: { dateWindow: DateWindow }) {
  const completedLessonWhere = buildCompletedLessonWhere({ dateWindow });
  const regularCourseWhere = buildCompletedCourseWhere({ dateWindow, targetLanguage: null });
  const languageCourseWhere = buildCompletedCourseWhere({
    dateWindow,
    targetLanguage: { not: null },
  });
  const chapterShellWhere = buildChapterShellWhere({ dateWindow });
  const completedChapterWhere = buildCompletedChapterWhere({ dateWindow });

  const [
    regularCourseCount,
    languageCourseCount,
    regularCourseChapterCount,
    languageCourseChapterCount,
    completedRegularChapterCount,
    completedLanguageChapterCount,
    regularCoreLessonCountInCourses,
    regularCustomLessonCountInCourses,
    languageLessonCountInCourses,
  ] = await Promise.all([
    prisma.course.count({ where: regularCourseWhere }),
    prisma.course.count({ where: languageCourseWhere }),
    prisma.chapter.count({ where: { ...chapterShellWhere, course: regularCourseWhere } }),
    prisma.chapter.count({ where: { ...chapterShellWhere, course: languageCourseWhere } }),
    prisma.chapter.count({ where: { ...completedChapterWhere, course: { targetLanguage: null } } }),
    prisma.chapter.count({
      where: { ...completedChapterWhere, course: { targetLanguage: { not: null } } },
    }),
    prisma.lesson.count({
      where: {
        ...completedLessonWhere,
        chapter: { course: { targetLanguage: null } },
        kind: "core",
      },
    }),
    prisma.lesson.count({
      where: {
        ...completedLessonWhere,
        chapter: { course: { targetLanguage: null } },
        kind: "custom",
      },
    }),
    prisma.lesson.count({
      where: {
        ...completedLessonWhere,
        chapter: { course: { targetLanguage: { not: null } } },
        kind: "language",
      },
    }),
  ]);

  return {
    completedLanguageChapterCount,
    completedRegularChapterCount,
    languageCourseChapterCount,
    languageCourseCount,
    languageLessonCountInCourses,
    regularCoreLessonCountInCourses,
    regularCourseChapterCount,
    regularCourseCount,
    regularCustomLessonCountInCourses,
  };
}

/**
 * Explanation and custom activities share the same step-image task family, so
 * Gateway counts alone cannot tell us which workflow those requests belonged
 * to. Grouping persisted readable steps with embedded images by parent activity
 * kind lets each lesson estimate claim only its own image workload.
 */
async function getStepImageUsageRows({
  dateWindow,
}: {
  dateWindow: DateWindow;
}): Promise<StepImageUsageRow[]> {
  const { data, error } = await safeAsync(() =>
    prisma.$queryRaw<StepImageUsageRow[]>(sql`
      SELECT
        a.kind AS "activityKind",
        COUNT(*)::bigint AS "count"
      FROM steps s
      JOIN activities a ON a.id = s.activity_id
      JOIN lessons l ON l.id = a.lesson_id
      WHERE s.kind = 'static'
        AND s.content->'image' IS NOT NULL
        AND s.archived_at IS NULL
        AND a.archived_at IS NULL
        AND l.archived_at IS NULL
        AND l.generation_run_id IS NOT NULL
        AND l.generation_status = 'completed'
        AND l.created_at >= ${dateWindow.startAt}
        AND l.created_at < ${dateWindow.endExclusive}
        AND a.kind IN ('explanation', 'custom')
      GROUP BY a.kind
    `),
  );

  if (error) {
    throw new Error("Failed to load step image usage for AI estimates", { cause: error });
  }

  return data;
}

/**
 * Language audio is stored outside Gateway reporting, and the workflow reuses
 * any existing word or sentence audio it can find. Counting only newly created
 * audio assets linked to selected-period lessons keeps the TTS estimate closer
 * to the spend that actually happened.
 */
async function getLanguageAudioUsage({
  dateWindow,
}: {
  dateWindow: DateWindow;
}): Promise<LanguageAudioUsageRow> {
  const { data, error } = await safeAsync(() =>
    prisma.$queryRaw<LanguageAudioUsageRow[]>(sql`
      WITH language_lessons AS (
        SELECT l.id
        FROM lessons l
        JOIN chapters ch ON ch.id = l.chapter_id
        JOIN courses c ON c.id = ch.course_id
        WHERE l.kind = 'language'
          AND l.archived_at IS NULL
          AND l.generation_run_id IS NOT NULL
          AND l.generation_status = 'completed'
          AND l.created_at >= ${dateWindow.startAt}
          AND l.created_at < ${dateWindow.endExclusive}
          AND c.target_language IS NOT NULL
      ),
      generated_word_audio AS (
        SELECT DISTINCT w.id
        FROM lesson_words lw
        JOIN words w ON w.id = lw.word_id
        WHERE lw.lesson_id IN (SELECT id FROM language_lessons)
          AND w.audio_url IS NOT NULL
          AND w.created_at >= ${dateWindow.startAt}
          AND w.created_at < ${dateWindow.endExclusive}
      ),
      generated_sentence_audio AS (
        SELECT DISTINCT s.id, s.sentence
        FROM lesson_sentences ls
        JOIN sentences s ON s.id = ls.sentence_id
        WHERE ls.lesson_id IN (SELECT id FROM language_lessons)
          AND s.audio_url IS NOT NULL
          AND s.created_at >= ${dateWindow.startAt}
          AND s.created_at < ${dateWindow.endExclusive}
      ),
      sentence_audio AS (
        SELECT
          COALESCE(
            SUM(
              GREATEST(
                COALESCE(array_length(regexp_split_to_array(TRIM(generated_sentence_audio.sentence), E'\\s+'), 1), 0),
                1
              )
            ),
            0
          )::bigint AS "sentenceWordCount"
        FROM generated_sentence_audio
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM generated_word_audio) AS "wordClipCount",
        sentence_audio."sentenceWordCount" AS "sentenceWordCount"
      FROM sentence_audio
    `),
  );

  if (error) {
    throw new Error("Failed to load language audio usage for AI estimates", { cause: error });
  }

  return data[0] ?? { sentenceWordCount: 0n, wordClipCount: 0n };
}

/**
 * Activity counts all follow the same "completed generated activity inside a
 * completed generated lesson" rule. Centralizing it keeps the main aggregate
 * query readable.
 */
function countActivities({
  activityKind,
  lessonKind,
  where,
}: {
  activityKind: "custom" | "explanation" | "practice" | "quiz";
  lessonKind: "core" | "custom";
  where: ReturnType<typeof buildCompletedLessonWhere>;
}) {
  return prisma.activity.count({
    where: {
      archivedAt: null,
      generationRunId: { not: null },
      generationStatus: "completed",
      kind: activityKind,
      lesson: { ...where, kind: lessonKind },
    },
  });
}

/**
 * A row counts as "AI-generated" only when it carries a workflow run id. That
 * id is written when the generation workflow marks the entity as running, so
 * it cleanly excludes seed data, fixtures, and manually-added content — all of
 * which can share the same `management_mode` or `generation_status` values but
 * never flow through a workflow. Pairing the run id with `generation_status =
 * 'completed'` narrows further to runs that finished successfully, which is
 * the only shape the cost-per-unit math can divide against honestly.
 */
function buildCompletedLessonWhere({ dateWindow }: { dateWindow: DateWindow }) {
  return {
    archivedAt: null,
    createdAt: { gte: dateWindow.startAt, lt: dateWindow.endExclusive },
    generationRunId: { not: null },
    generationStatus: "completed" as const,
  };
}

function buildCompletedCourseWhere({
  dateWindow,
  targetLanguage,
}: {
  dateWindow: DateWindow;
  targetLanguage: null | { not: null };
}) {
  return {
    archivedAt: null,
    createdAt: { gte: dateWindow.startAt, lt: dateWindow.endExclusive },
    generationRunId: { not: null },
    generationStatus: "completed" as const,
    targetLanguage,
  };
}

function buildChapterShellWhere({ dateWindow }: { dateWindow: DateWindow }) {
  return {
    archivedAt: null,
    createdAt: { gte: dateWindow.startAt, lt: dateWindow.endExclusive },
    generationRunId: { not: null },
  };
}

function buildCompletedChapterWhere({ dateWindow }: { dateWindow: DateWindow }) {
  return {
    ...buildChapterShellWhere({ dateWindow }),
    generationStatus: "completed" as const,
  };
}
