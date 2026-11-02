import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { askForLessons } from "../lookahead/lessons-ask";
import { type FollowUp } from "./follow-up-contract";
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
