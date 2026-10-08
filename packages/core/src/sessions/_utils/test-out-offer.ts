import "server-only";
import { prisma } from "@zoonk/db";
import { loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { countSkippableItems, getChapterSkills } from "../../learner/test-out/_utils/chapter-items";
import { CAPSULE_LEDGER_KIND } from "../../milestones/award-milestones";
import { readFinishedLessonId } from "./lesson-block";

/** Lessons of one chapter in a row with every answer right before its test-out is offered. */
const OFFER_STREAK = 2;

/** A lesson is breezed through with at least this many answers, all of them right. */
const MIN_LESSON_ANSWERS = 3;

/** Fewer lessons to skip than this aren't worth a test: the learner just finishes them. */
const MIN_LESSONS_LEFT = 2;

/**
 * "This is easy? Take the chapter's test and skip the rest": offered once, right after the lesson
 * that made it a streak, for the chapter the lesson is planned in.
 */
export type TestOutOffer = {
  chapterId: string;
  chapterTitle: string;
  goalId: string;
  /**
   * The plan's lessons passing the test can skip: the chapter's still to do, and the ones elsewhere
   * that teach only the same skills.
   */
  lessonsLeft: number;
};

type LessonFinish = { correct: number; incorrect: number; lessonId: string };

function isBreezedThrough(finish: LessonFinish): boolean {
  return finish.incorrect === 0 && finish.correct >= MIN_LESSON_ANSWERS;
}

/**
 * Whether the lesson just finished makes the streak: the chapter's lessons in the order the
 * learner first finished them end with this one and exactly `OFFER_STREAK` breezed through in a
 * row. Exactly, so the offer comes once, not after every easy lesson that follows.
 */
function completesStreak({
  finishes,
  lessonId,
}: {
  finishes: readonly LessonFinish[];
  lessonId: string;
}): boolean {
  if (finishes.at(-1)?.lessonId !== lessonId) {
    return false;
  }

  const lastMiss = finishes.findLastIndex((finish) => !isBreezedThrough(finish));
  return finishes.length - 1 - lastMiss === OFFER_STREAK;
}

/** Each lesson's first finish (a replay is a review), in the order the learner finished them. */
async function loadFirstFinishes({
  lessonIds,
  userId,
}: {
  lessonIds: string[];
  userId: string;
}): Promise<LessonFinish[]> {
  const events = await prisma.learningEvent.findMany({
    orderBy: { endedAt: "asc" },
    select: { contentIds: true, correctAnswers: true, incorrectAnswers: true },
    where: {
      AND: [
        { OR: lessonIds.map((id) => ({ contentIds: { equals: id, path: ["lessonId"] } })) },
        { OR: [{ lessonKind: null }, { lessonKind: { not: CAPSULE_LEDGER_KIND } }] },
      ],
      endedAt: { not: null },
      kind: "lesson",
      userId,
    },
  });

  const finishes = events.flatMap((event) => {
    const lessonId = readFinishedLessonId(event.contentIds);

    return lessonId
      ? [{ correct: event.correctAnswers, incorrect: event.incorrectAnswers, lessonId }]
      : [];
  });

  return finishes.filter(
    (finish, index) => finishes.findIndex((other) => other.lessonId === finish.lessonId) === index,
  );
}

/**
 * The test-out to offer after a lesson finished as one of today's blocks: when the learner got
 * every answer right in the chapter's lessons twice in a row, the chapter has lessons left, and its
 * test can ask about what the chapter teaches. Null otherwise, which is almost always.
 */
export async function findTestOutOffer({
  goalId,
  lessonId,
  userId,
}: {
  goalId: string;
  lessonId: string;
  userId: string;
}): Promise<TestOutOffer | null> {
  const planned = await prisma.planItem.findFirst({
    select: { chapter: { select: { id: true, title: true } } },
    where: { kind: "lesson", lessonId, plan: { goalId } },
  });

  const chapter = planned?.chapter;

  if (!chapter) {
    return null;
  }

  const items = await prisma.planItem.findMany({
    select: { lessonId: true, status: true },
    where: { chapterId: chapter.id, kind: "lesson", plan: { goalId } },
  });

  const chapterLeft = items.filter((item) => item.status === "todo").length;

  const doneIds = items.flatMap((item) =>
    item.status === "done" && item.lessonId ? [item.lessonId] : [],
  );

  if (chapterLeft < MIN_LESSONS_LEFT || doneIds.length < OFFER_STREAK) {
    return null;
  }

  const finishes = await loadFirstFinishes({ lessonIds: doneIds, userId });

  if (!completesStreak({ finishes, lessonId })) {
    return null;
  }

  const plan = await loadGoalPlan(goalId);
  const skills = getChapterSkills({ chapterId: chapter.id, plan });
  const skippable = countSkippableItems({ plan, skills });

  return skills.length > 0 && skippable >= MIN_LESSONS_LEFT
    ? { chapterId: chapter.id, chapterTitle: chapter.title, goalId, lessonsLeft: skippable }
    : null;
}
