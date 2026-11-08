import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, type Plan, type TransactionClient } from "@zoonk/db";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { type OnboardingAnswerInput } from "../onboarding-contract";

export async function saveAnswerGoal({
  current,
  data,
  input,
  own,
  tx,
}: {
  current: Goal & { plan: Plan | null };
  data: Parameters<TransactionClient["goal"]["update"]>[0]["data"];
  input: OnboardingAnswerInput;
  own: boolean;
  tx: TransactionClient;
}): Promise<boolean> {
  if (
    !Object.entries(data).some(
      ([key, value]) => !isDeepStrictEqual(value, Reflect.get(current, key)),
    )
  ) {
    return false;
  }

  await tx.goal.update({ data, where: { id: current.id } });

  if (own && input.question === "level" && current.plan && !current.planRevealedAt) {
    await tx.plan.update({ data: { placementPreparedAt: null }, where: { id: current.plan.id } });

    await oweFollowUps({
      db: tx,
      followUps: [
        {
          input: { goalId: current.id, waitsForNotice: current.kind === "exam" },
          kind: "preparePlacementItems",
        },
      ],
      userId: current.userId,
    });
  }

  return true;
}
