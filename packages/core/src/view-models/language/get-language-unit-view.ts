import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { findLearnerLanguageGoal } from "../../language/_utils/language-goal";
import { getSpeakingLevel } from "../../language/conversations/_utils/conversation-goal";
import { loadPracticeCall } from "../../language/conversations/_utils/practice-call";
import { CEFR_BANDS } from "../../language/levels/skill-level-rules";
import { findFreshMistakePattern } from "../../language/patterns/find-fresh-pattern";
import { loadDuePronunciation } from "../../language/pronunciation/load-due-pronunciation";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { loadBlockedTestOutChapters } from "../../learner/test-out/_utils/offer-eligibility";
import { loadTestOutPlan } from "../../learner/test-out/_utils/test-out-plan";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { toSummaryIdeas } from "../../library/lessons/_utils/summary-ideas";
import { getSession } from "../../users/get-session";
import { loadTodayLearnBlocks } from "../_utils/today-lesson-order";
import { findUpNextLessonId } from "../_utils/up-next-lesson";
import { loadGrammarTips, loadUnitMistakes, loadUnitWords } from "./_utils/unit-content";
import { type LanguageUnitView } from "./language-view-contract";

export type LanguageUnitViewResult =
  | { status: "notFound" | "notLanguage" | "unauthorized" }
  | { status: "ready"; unit: LanguageUnitView };

function findVisibleUnit({ chapterId, userId }: { chapterId: string; userId: string }) {
  return prisma.chapter.findFirst({
    include: {
      lessons: {
        include: {
          lesson: {
            select: {
              contentStatus: true,
              estimatedMinutes: true,
              id: true,
              summary: true,
              title: true,
            },
          },
        },
        orderBy: { position: "asc" },
      },
    },
    where: { ...libraryRowsVisibleTo(userId), id: chapterId },
  });
}

function getLessonState({ done, next }: { done: boolean; next: boolean }) {
  if (done) {
    return "done" as const;
  }

  return next ? ("next" as const) : ("upcoming" as const);
}

/**
 * A language unit's page: its "I can" objectives and lessons with the summaries the finished ones
 * left, the grammar tips pinned from its lessons, the words it teaches, the learner's open mistakes
 * on it by skill with a pattern noticed in them, the words to say again today, and the
 * conversation to practice, with the lengths the learner's call time holds now.
 */
export async function getLanguageUnitView({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId?: string;
}): Promise<LanguageUnitViewResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const chapter = isUuid(chapterId) ? await findVisibleUnit({ chapterId, userId }) : null;

  if (!chapter) {
    return { status: "notFound" };
  }

  const { targetLanguage } = chapter;

  if (!targetLanguage) {
    return { status: "notLanguage" };
  }

  const goal = await findLearnerLanguageGoal({ goalId, targetLanguage, userId });
  const lessonIds = chapter.lessons.map(({ lesson }) => lesson.id);

  const plan = goal
    ? await loadTestOutPlan(goal.id, { goal, source: readSavedPlan(userId, goal.id) })
    : null;

  const [todayBlocks, level, grammarTips, words, mistakes, pronunciation, blockedTestOutChapters] =
    await Promise.all([
      goal ? loadTodayLearnBlocks(goal) : [],
      getSpeakingLevel({ goal, targetLanguage, userId }),
      loadGrammarTips(lessonIds),
      loadUnitWords(lessonIds),
      loadUnitMistakes({ lessonIds, userId }),
      loadDuePronunciation({ language: targetLanguage, userId }),
      goal
        ? loadBlockedTestOutChapters({
            chapterIds: [chapter.id],
            goalId: goal.id,
            known: { goal, ...(plan && { plan }) },
            now: new Date(),
            timeZone: getAnswerTimeZone({ goal }),
            userId,
          })
        : new Set<string>(),
    ]);

  const chapterIds = [...new Set(plan?.items.flatMap((item) => item.chapterId ?? []))];
  const unitIndex = chapterIds.indexOf(chapter.id);

  const done = new Set(
    plan?.items.flatMap((item) =>
      item.lessonId && (item.status === "done" || item.status === "testedOut")
        ? [item.lessonId]
        : [],
    ),
  );

  const nextId = findUpNextLessonId({
    lessons: lessonIds.map((lessonId) => ({ done: done.has(lessonId), lessonId })),
    planLessonIds:
      plan?.items.flatMap((item) =>
        item.status === "todo" && item.lessonId ? [item.lessonId] : [],
      ) ?? [],
    sessionLessonIds: todayBlocks.flatMap((block) => block.lessonId ?? []),
  });

  const pattern =
    mistakes.length > 0
      ? await findFreshMistakePattern({
          language: targetLanguage,
          mistakeIds: mistakes.map((mistake) => mistake.id),
          userId,
        })
      : null;

  const summaries = chapter.lessons.flatMap(({ lesson }) => {
    const ideas = done.has(lesson.id) ? toSummaryIdeas(lesson.summary) : [];
    return ideas.length > 0 ? [{ ideas, lessonId: lesson.id, title: lesson.title }] : [];
  });

  return {
    status: "ready",
    unit: {
      canTestOut: Boolean(goal) && !blockedTestOutChapters.has(chapter.id),
      conversation: await loadPracticeCall({ chapterId: chapter.id, level }),
      goalId: goal?.id ?? null,
      grammarTips,
      lessons: chapter.lessons.map(({ lesson }) => ({
        done: done.has(lesson.id),
        lessonId: lesson.id,
        minutes: lesson.estimatedMinutes,
        state: getLessonState({ done: done.has(lesson.id), next: lesson.id === nextId }),
        title: lesson.title,
        written: lesson.contentStatus === "completed",
      })),
      mistakes,
      pattern,
      pronunciation,
      summaries,
      unit: {
        chapterId: chapter.id,
        description: chapter.description,
        levelRange: CEFR_BANDS[chapter.level],
        objectives: chapter.objectives,
        position: unitIndex === -1 ? null : unitIndex + 1,
        title: chapter.title,
      },
      words,
    },
  };
}
