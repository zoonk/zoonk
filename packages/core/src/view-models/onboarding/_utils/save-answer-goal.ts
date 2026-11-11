import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, type Plan, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { hasCountryReading } from "../../../goals/_utils/goal-content-country";
import { saveMetadataInTransaction } from "../../../goals/_utils/goal-metadata";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { type OnboardingAnswerInput } from "../onboarding-contract";
import { getAnsweredQuestions } from "../onboarding-steps";

function withoutAnswered(details: unknown) {
  return isJsonObject(details)
    ? Object.fromEntries(Object.entries(details).filter(([key]) => key !== "answered"))
    : {};
}

type AnswerGoal = {
  current: Goal & { plan: Plan | null };
  data: Parameters<TransactionClient["goal"]["update"]>[0]["data"];
  input: OnboardingAnswerInput;
  own: boolean;
  tx: TransactionClient;
};

function needsCurriculumRebuild({
  current,
  data,
  input,
}: Pick<AnswerGoal, "current" | "data" | "input">): boolean {
  if (
    input.question === "contentCountry" &&
    current.curriculumQuestions.includes("contentCountry") &&
    !getAnsweredQuestions(isJsonObject(current.details) ? current.details : {}).includes(
      "contentCountry",
    )
  ) {
    return true;
  }

  return (
    (current.curriculumQuestions.includes(input.question) ||
      (input.question === "contentCountry" &&
        parsePlanGraph(current.plan?.graph).skills.length > 0)) &&
    Object.entries(data).some(([key, value]) =>
      key === "details"
        ? !isDeepStrictEqual(withoutAnswered(value), withoutAnswered(current.details))
        : !isDeepStrictEqual(value, Reflect.get(current, key)),
    )
  );
}

export async function saveAnswerGoal({
  current,
  data,
  input,
  own,
  tx,
}: AnswerGoal): Promise<boolean> {
  if (
    own &&
    input.question === "contentCountry" &&
    (current.planRevealedAt !== null || !hasCountryReading(current))
  ) {
    const saved = await saveMetadataInTransaction(tx, {
      goal: current,
      input: { contentCountry: input.country },
      userId: current.userId,
    });

    return saved.changed;
  }

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

  const placement =
    input.question === "level" &&
    current.plan &&
    parsePlanGraph(current.plan.graph).skills.length > 0
      ? current.plan
      : null;

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
      ...(needsCurriculumRebuild({ current, data, input })
        ? [{ input: { goalId: current.id }, kind: "rebuildGoalCurriculum" as const }]
        : []),
    ],
    userId: current.userId,
  });

  return true;
}
