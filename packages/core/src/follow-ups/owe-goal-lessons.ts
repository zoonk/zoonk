import "server-only";
import { prisma } from "@zoonk/db";
import { askForLessons } from "../lookahead/lessons-ask";
import { type FollowUp } from "./follow-up-contract";
import { oweFollowUps } from "./owe-follow-ups";

/**
 * A plan write can bring in topics whose lessons nobody started writing: the day reads as getting
 * them from now on, and the preparation that ends the ask runs after the response. `also` is other
 * work the same write owes.
 */
export async function oweGoalLessons({
  also = [],
  goalId,
  userId,
}: {
  also?: readonly FollowUp[];
  goalId: string;
  userId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lessonsAskedAt = await askForLessons({ db: tx, goalId });

    await oweFollowUps({
      db: tx,
      followUps: [{ input: { goalId, lessonsAskedAt }, kind: "prepareGoalLessons" }, ...also],
      userId,
    });
  });
}
