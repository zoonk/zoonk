import { type UsageKind, prisma } from "@zoonk/db";
import { getUsageRule } from "../entitlements/limits";

/**
 * The named states a screen's scenario needs and no learner's day reaches by itself: written on a
 * persona's copy after it's laid out, by `createE2EPersona` and `pnpm dev:persona --state` alike.
 * A state a learner's answer decides is reached by a scenario's steps, not written here.
 */
export const SCENARIO_STATES = ["reveal", "lessons-used-up", "maps-used-up"] as const;

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

  await spendAllowance({ kind: state === "lessons-used-up" ? "lessonStart" : "mindMap", userId });
}
