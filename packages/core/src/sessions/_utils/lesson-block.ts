import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { CAPSULE_LEDGER_KIND } from "../../milestones/award-milestones";
import { readBlockPayload } from "../block-payload";
import { capReviewDay, getCapsuleOpening } from "../capsules";
import {
  type CheckedLanguageGoal,
  completeLessonPlanItems,
  scheduleLessonCanDos,
} from "./plan-items";
import { type StudySessionRow } from "./study-session-access";

const lessonIdsSchema = z.object({ lessonId: z.string() });

/** The lesson a ledger row finished, from its plain content ids. */
export function readFinishedLessonId(contentIds: unknown): string | null {
  return lessonIdsSchema.safeParse(contentIds).data?.lessonId ?? null;
}

async function getAcceptedLessonIds(block: StudySessionBlock): Promise<string[]> {
  if (block.lessonId) {
    return [block.lessonId];
  }

  const chapterId = readBlockPayload(block).chapterId;

  if (!chapterId) {
    return [];
  }

  const rows = await prisma.chapterLesson.findMany({
    select: { lessonId: true },
    where: { chapterId },
  });

  return rows.map((row) => row.lessonId);
}

/**
 * The lesson finish a learn block waits for. The lesson player writes a `lesson` ledger row with
 * `contentIds.lessonId` when a lesson ends (a replay may be a `review` row); a block for a chapter
 * whose lesson was written just in time accepts any of that chapter's lessons.
 */
export async function findLessonFinish({
  block,
  session,
  timeZone,
  userId,
}: {
  block: StudySessionBlock;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}) {
  const lessonIds = await getAcceptedLessonIds(block);

  if (lessonIds.length === 0) {
    return null;
  }

  const since = block.startedAt ?? getStartOfLocalDay({ localDate: session.localDate, timeZone });

  return prisma.learningEvent.findFirst({
    orderBy: { endedAt: "desc" },
    where: {
      AND: [
        {
          OR: lessonIds.map((lessonId) => ({
            contentIds: { equals: lessonId, path: ["lessonId"] },
          })),
        },
        // Capsule rows also name their lesson; they are reviews of it, not the lesson itself.
        { OR: [{ lessonKind: null }, { lessonKind: { not: CAPSULE_LEDGER_KIND } }] },
      ],
      endedAt: { gte: since },
      kind: { in: ["lesson", "review"] },
      userId,
    },
  });
}

/**
 * Marks a learn block done with the Brain Power its lesson earned (already added to the learner's
 * totals by the lesson's own completion) and checks the lesson off in every plan that has it.
 * Returns false when the block was already done.
 */
export async function markLessonBlockDone({
  block,
  brainPower,
  lessonId,
  userId,
}: {
  block: StudySessionBlock;
  brainPower: number;
  lessonId: string | null;
  userId: string;
}): Promise<boolean> {
  const { done, languageGoals } = await prisma.$transaction(async (tx) => {
    const now = new Date();

    const { count } = await tx.studySessionBlock.updateMany({
      data: {
        brainPower,
        completedAt: now,
        lessonId: block.lessonId ?? lessonId,
        status: "completed",
      },
      where: { id: block.id, status: { in: ["active", "pending"] } },
    });

    const goals: CheckedLanguageGoal[] =
      count === 1 && lessonId ? await completeLessonPlanItems(tx, { lessonId, now, userId }) : [];

    return { done: count === 1, languageGoals: goals };
  });

  if (lessonId) {
    scheduleLessonCanDos({ goals: languageGoals, lessonId, userId });
  }

  return done;
}

/**
 * The learner-local day the lesson's capsule opens: the first of its skills FSRS says is due,
 * never after the goal's date (see `capReviewDay`), as a UTC-midnight date label.
 */
export async function getLessonComesBack({
  lessonId,
  targetDate,
  timeZone,
  userId,
}: {
  lessonId: string | null;
  /** The goal's date, when it has one. */
  targetDate: Date | null;
  timeZone: string;
  userId: string;
}): Promise<Date | null> {
  if (!lessonId) {
    return null;
  }

  const skills = await prisma.lessonSkill.findMany({
    select: { skillId: true },
    where: { lessonId },
  });

  const memories = await prisma.learnerSkill.findMany({
    select: { due: true },
    where: { skillId: { in: skills.map((skill) => skill.skillId) }, userId },
  });

  const opening = getCapsuleOpening(memories);

  if (!opening) {
    return null;
  }

  return capReviewDay({
    day: getDateInTimeZone({ date: opening, timeZone }),
    targetDate,
    today: getDateInTimeZone({ date: new Date(), timeZone }),
  });
}
