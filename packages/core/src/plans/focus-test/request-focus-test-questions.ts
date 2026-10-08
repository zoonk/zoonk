import "server-only";
import { getRequestPlatform } from "../../analytics/request-platform";
import { type AnalyticsPlatform } from "../../analytics/shared-properties";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { type PlacementQuickFormat } from "../../learner/placement/placement-quick-format";
import { loadFocusTest, loadFocusTestShape } from "./_utils/load-focus-test";
import { spreadAreaQuestions } from "./focus-test-rules";

/**
 * `ready`: every area has its questions, so the test can start. `start`: the caller starts a run
 * writing `questionsPerSkill` questions in `format` for `skillIds`, whose analytics name the
 * learner, their goal and the client that asked. `refused`: the learner's AI help allowance
 * doesn't cover it now.
 */
export type FocusTestQuestionsRequest =
  | { status: "ready" }
  | {
      analytics: { distinctId: string; goalId: string; platform: AnalyticsPlatform | null };
      format: PlacementQuickFormat;
      /** How many questions each of those skills needs: more for an area of few skills. */
      questionsPerSkill: number;
      skillIds: string[];
      status: "start";
    }
  | { decision: RefusedUsage; status: "refused" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

/**
 * Decides what asking for the focus test's questions does, when the learner taps to start it:
 * skills the test asks about without a question in its format get some written (shared with
 * placement, reviews and practice), claimed as small AI help first. Nothing is written when the
 * test already has every question.
 */
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
