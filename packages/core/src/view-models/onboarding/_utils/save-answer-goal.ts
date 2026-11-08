import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, type Plan, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { type OnboardingAnswerInput } from "../onboarding-contract";

function withoutAnswered(details: unknown) {
  return isJsonObject(details)
    ? Object.fromEntries(Object.entries(details).filter(([key]) => key !== "answered"))
    : {};
}

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

  if (!own || current.planRevealedAt) {
    return true;
  }

  const placement = input.question === "level" && current.plan;

  const rebuild =
    current.curriculumQuestions.includes(input.question) &&
    Object.entries(data).some(([key, value]) =>
      key === "details"
        ? !isDeepStrictEqual(withoutAnswered(value), withoutAnswered(current.details))
        : !isDeepStrictEqual(value, Reflect.get(current, key)),
    );

  if (placement) {
    await tx.plan.update({ data: { placementPreparedAt: null }, where: { id: placement.id } });
  }

  await oweFollowUps({
    db: tx,
    followUps: [
      ...(placement
        ? [
            {
              input: { goalId: current.id, waitsForNotice: current.kind === "exam" },
              kind: "preparePlacementItems" as const,
            },
          ]
        : []),
      ...(rebuild
        ? [{ input: { goalId: current.id }, kind: "rebuildGoalCurriculum" as const }]
        : []),
    ],
    userId: current.userId,
  });

  return true;
}
