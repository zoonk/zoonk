import "server-only";
import { getRequestPlatform } from "../../analytics/request-platform";
import { type AnalyticsPlatform } from "../../analytics/shared-properties";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { type PlacementQuickFormat } from "../../learner/placement/placement-quick-format";
import { loadFocusTest, loadFocusTestShape } from "./_utils/load-focus-test";
import { spreadAreaQuestions } from "./focus-test-rules";

/** `start`: the caller starts the run that writes the questions. */
export type FocusTestQuestionsRequest =
  | { status: "ready" }
  | {
      analytics: { distinctId: string; goalId: string; platform: AnalyticsPlatform | null };
      format: PlacementQuickFormat;
      questionsPerSkill: number;
      skillIds: string[];
      status: "start";
    }
  | { decision: RefusedUsage; status: "refused" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

export async function requestFocusTestQuestions({
  goalId,
}: {
  goalId: string;
}): Promise<FocusTestQuestionsRequest> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const [shape, focusTest] = await Promise.all([
    loadFocusTestShape(owned.goal),
    loadFocusTest({ goal: owned.goal, userId: owned.userId }),
  ]);

  if (!shape || !focusTest) {
    return { status: "unavailable" };
  }

  if (focusTest.needsItems.length === 0) {
    return { status: "ready" };
  }

  const decision = await claimAssist();

  if (decision.status === "unauthorized") {
    return decision;
  }

  if (decision.status !== "allowed") {
    return { decision, status: "refused" };
  }

  const asked = shape.areas.flatMap((area) =>
    spreadAreaQuestions({ count: shape.questionsPerArea, skillIds: area.skillIds }),
  );

  const questionsPerSkill = Math.max(
    1,
    ...focusTest.needsItems.map((skillId) => asked.filter((asks) => asks === skillId).length),
  );

  return {
    analytics: { distinctId: owned.userId, goalId, platform: await getRequestPlatform() },
    format: shape.quickFormat,
    questionsPerSkill,
    skillIds: focusTest.needsItems,
    status: "start",
  };
}
