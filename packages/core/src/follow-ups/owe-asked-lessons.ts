import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { getOutlineStaleBefore } from "../lookahead/outline-ahead";
import { findPlanFirstLessonId } from "../plans/_utils/plan-first-lesson";
import { type FollowUp } from "./follow-up-contract";
import { oweFollowUps } from "./owe-follow-ups";

/** The learner opens the plan's first lesson next, so it's written on its own, ahead of the rest of the day. */
export async function getFirstLessonWrite({
  db,
  goalId,
}: {
  db: TransactionClient;
  goalId: string;
}): Promise<FollowUp[]> {
  const lessonId = await findPlanFirstLessonId({ db, goalId });
  return lessonId ? [{ input: { lessonId }, kind: "writeLesson" }] : [];
}

/**
 * For a plan write that brought in lessons the learner's ask waited on while their outline was
 * written. They're owed under that same ask, which this never renews, so background re-plans can't
 * keep an ask alive past its window.
 */
export async function oweAskedLessons({
  db,
  goalId,
}: {
  db: TransactionClient;
  goalId: string;
}): Promise<void> {
  const plan = await db.plan.findFirst({
    select: { goal: { select: { userId: true } }, lessonsAskedAt: true },
    where: { goalId, lessonsAskedAt: { gt: getOutlineStaleBefore(new Date()) } },
  });

  if (!plan?.lessonsAskedAt) {
    return;
  }

  const lessonsAskedAt = plan.lessonsAskedAt.getTime();

  await oweFollowUps({
    db,
    followUps: [
      { input: { goalId, lessonsAskedAt }, kind: "prepareGoalLessons" },
      ...(await getFirstLessonWrite({ db, goalId })),
    ],
    userId: plan.goal.userId,
  });
}
