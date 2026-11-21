import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";

export async function oweLevelTestNotice({
  db,
  goalId,
  unannounced,
  userId,
}: {
  db: TransactionClient;
  goalId: string;
  unannounced: readonly string[];
  userId: string;
}) {
  await oweFollowUps({
    db,
    followUps:
      unannounced.length > 0
        ? [
            {
              input: { goalId, lessonsAskedAt: null, levelTestNotice: true },
              kind: "prepareGoalLessons",
            },
          ]
        : [],
    userId,
  });
}
