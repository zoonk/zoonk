import { type UsageKind, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getUsageRule } from "../entitlements/limits";
import { PROFILE_QUESTIONS } from "../profile/questions/profile-question-contract";
import { getAnsweredQuestions } from "../view-models/onboarding/onboarding-steps";

/**
 * The named states a screen's scenario needs and no learner's day reaches by itself: written on a
 * persona's copy after it's laid out, by `createE2EPersona` and `pnpm dev:persona --state` alike.
 * A state a learner's answer decides is reached by a scenario's steps, not written here.
 */
export const SCENARIO_STATES = ["reveal", "placement", "lessons-used-up", "maps-used-up"] as const;

export type ScenarioState = (typeof SCENARIO_STATES)[number];

/** A free learner's whole allowance of `kind` counted now: the product's own limit, read here. */
async function spendAllowance({ kind, userId }: { kind: UsageKind; userId: string }) {
  const rule = getUsageRule({ kind, tier: "free" });
  const count = rule.day ?? rule.rolling30Days ?? 0;
  const now = new Date();

  await prisma.usageRecord.createMany({
    data: Array.from({ length: count }, () => ({
      countedAt: now,
      kind,
      targetId: crypto.randomUUID(),
      userId,
    })),
  });
}

/** Onboarding owes the level check again, and the plan's reveal after it; nothing comes before it. */
async function owePlacement(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({
    select: { details: true },
    where: { id: goalId },
  });

  const details = isJsonObject(goal.details) ? goal.details : {};

  const answered = [...new Set([...getAnsweredQuestions(details), ...PROFILE_QUESTIONS])].filter(
    (question) => question !== "placement",
  );

  await prisma.goal.update({
    data: { details: { ...details, answered }, planRevealedAt: null },
    where: { id: goalId },
  });
}

export async function writeScenarioState({
  goalId,
  state,
  userId,
}: {
  goalId: string;
  state: ScenarioState;
  userId: string;
}): Promise<void> {
  if (state === "reveal") {
    // Onboarding owes the plan's reveal until the learner presses its action.
    await prisma.goal.update({ data: { planRevealedAt: null }, where: { id: goalId } });
    return;
  }

  if (state === "placement") {
    await owePlacement(goalId);
    return;
  }

  await spendAllowance({ kind: state === "lessons-used-up" ? "lessonStart" : "mindMap", userId });
}
