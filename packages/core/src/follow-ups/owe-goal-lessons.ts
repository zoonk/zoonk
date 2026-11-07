import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { askForLessons } from "../lookahead/lessons-ask";
import { type FollowUp } from "./follow-up-contract";
import { getFirstLessonWrite } from "./owe-asked-lessons";
import { oweFollowUps } from "./owe-follow-ups";

/**
 * A plan write can bring in topics whose lessons nobody started writing: the day reads as getting
 * them from now on, and the preparation that ends the ask runs after the response. `also` is other
 * work the same write owes. Pass the write's transaction when it has one, so a request that fails
 * after the write still owes the work.
 */
export async function oweGoalLessons({
  also = [],
  db,
  goalId,
  userId,
}: {
  also?: readonly FollowUp[];
  db?: TransactionClient;
  goalId: string;
  userId: string;
}): Promise<void> {
  if (!db) {
    await prisma.$transaction((tx) => oweGoalLessons({ also, db: tx, goalId, userId }));
    return;
  }

  const lessonsAskedAt = await askForLessons({ db, goalId });

  await oweFollowUps({
    db,
    followUps: [{ input: { goalId, lessonsAskedAt }, kind: "prepareGoalLessons" }, ...also],
    userId,
  });
}

/**
 * For a plan change that today's session follows after it commits: owes the preparation in the
 * change's transaction without asking, because a fresh ask would save today as waiting while it
 * follows. Call `oweGoalLessons` once today has followed; it asks and owes the work again under it.
 *
 * The work carries the plan's pending ask, which its run then ends, or else the change's moment:
 * either way the run waits for the learner's other preparation, as an ask's does, and ending an ask
 * nobody wrote clears nothing.
 */
export async function owePlanChangeLessons({
  db,
  goalId,
  userId,
}: {
  db: TransactionClient;
  goalId: string;
  userId: string;
}): Promise<void> {
  const plan = await db.plan.findUnique({ select: { lessonsAskedAt: true }, where: { goalId } });
  const lessonsAskedAt = (plan?.lessonsAskedAt ?? new Date()).getTime();

  await oweFollowUps({
    db,
    followUps: [{ input: { goalId, lessonsAskedAt }, kind: "prepareGoalLessons" }],
    userId,
  });
}

/** For a write that moved where the plan starts, such as a placement; pass its transaction when it has one. */
export async function owePlanStartLessons({
  db,
  goalId,
  userId,
}: {
  db?: TransactionClient;
  goalId: string;
  userId: string;
}): Promise<void> {
  if (!db) {
    await prisma.$transaction((tx) => owePlanStartLessons({ db: tx, goalId, userId }));
    return;
  }

  await oweGoalLessons({ also: await getFirstLessonWrite({ db, goalId }), db, goalId, userId });
}
