import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";
import { loadLessonReviewSkillIds } from "../../learner/_utils/lesson-plan-skills";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { CAPSULE_LEDGER_KIND } from "../../milestones/award-milestones";
import { readBlockPayload } from "../block-payload";
import { capReviewDay, getCapsuleOpening } from "../capsules";
import { oweDaySettlement } from "../settle-owed-session-day";
import { completeLessonPlanItems, scheduleLessonCanDos } from "./plan-items";
import { type StudySessionRow } from "./study-session-access";

const lessonIdsSchema = z.object({ lessonId: z.string() });

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

/** Accepts completed lesson and replay rows; chapter placeholders accept any lesson in that chapter. */
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

  const query = {
    orderBy: { endedAt: "desc" as const },
    where: {
      AND: [
        {
          OR: lessonIds.map((lessonId) => ({
            contentIds: { equals: lessonId, path: ["lessonId"] },
          })),
        },
        // Capsule reviews name their lesson but do not complete a lesson run.
        { OR: [{ lessonKind: null }, { lessonKind: { not: CAPSULE_LEDGER_KIND } }] },
      ],
      endedAt: { gte: since },
      kind: { in: ["lesson", "review"] },
      userId,
    },
  } satisfies Parameters<typeof prisma.learningEvent.findFirst>[0];

  const bound = await prisma.learningEvent.findFirst({
    ...query,
    where: {
      ...query.where,
      AND: [
        ...query.where.AND,
        { contentIds: { equals: block.id, path: ["studySessionBlockId"] } },
      ],
    },
  });

  // A bound completion must not be reassigned to a different replay of the same lesson.
  if (bound) {
    return bound;
  }

  const legacy = await prisma.learningEvent.findMany(query);

  return (
    legacy.find((event) => getString(event.contentIds, "studySessionBlockId") === null) ?? null
  );
}

/** Call in the transaction that closes the block's lesson run, or under the learner's mark for a block that run missed. Returns false when it was already done. */
export async function completeLessonBlock(
  tx: TransactionClient,
  {
    block,
    brainPower,
    lessonId,
    now,
    timeZone,
    userId,
  }: {
    block: Pick<StudySessionBlock, "id" | "lessonId" | "sessionId">;
    brainPower: number;
    lessonId: string | null;
    now: Date;
    timeZone: string;
    userId: string;
  },
): Promise<boolean> {
  const { count } = await tx.studySessionBlock.updateMany({
    data: {
      brainPower,
      completedAt: now,
      lessonId: block.lessonId ?? lessonId,
      status: "completed",
    },
    where: { id: block.id, status: { in: ["active", "pending"] } },
  });

  if (count === 0) {
    return false;
  }

  await oweDaySettlement(tx, { block, timeZone, userId });
  return true;
}

/** For a block its lesson's run didn't complete. That run checked off only its own learner's plans, so a guest's run linked to this account later still checks off the account's. */
export async function markLessonBlockDone(input: {
  block: StudySessionBlock;
  brainPower: number;
  lessonId: string | null;
  timeZone: string;
  userId: string;
}): Promise<boolean> {
  const { lessonId, userId } = input;

  const languageGoals = await writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    const now = new Date();

    if (!(await completeLessonBlock(tx, { ...input, now }))) {
      return unchanged(null);
    }

    return lessonId ? completeLessonPlanItems(tx, { lessonId, now, userId }) : [];
  });

  if (!languageGoals) {
    return false;
  }

  if (lessonId) {
    scheduleLessonCanDos({ goals: languageGoals, lessonId, userId });
  }

  return true;
}

/** Returns a learner-local UTC-midnight label, never later than the goal's date. */
export async function getLessonComesBack({
  lessonId,
  targetDate,
  timeZone,
  userId,
}: {
  lessonId: string | null;
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

  const skillIds = await loadLessonReviewSkillIds({
    lessonId,
    ownSkillIds: skills.map((skill) => skill.skillId),
    userId,
  });

  const memories = await prisma.learnerSkill.findMany({
    select: { due: true },
    where: { skillId: { in: skillIds }, userId },
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
