import "server-only";
import { getRequestPlatform } from "../../analytics/request-platform";
import { type AnalyticsPlatform } from "../../analytics/shared-properties";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { findOwnedGoal } from "../_utils/owned-goal";
import { loadChapterTestOut } from "./get-chapter-test-out";

/**
 * `ready`: every sampled skill has a question, so the test-out can start. `start`: the caller
 * starts a run writing questions for `skillIds`, whose analytics name the learner, their goal and
 * the client that asked. `refused`: the learner's AI help allowance doesn't cover it now.
 */
export type TestOutQuestionsRequest =
  | { status: "ready" }
  | {
      analytics: { distinctId: string; goalId: string; platform: AnalyticsPlatform | null };
      /** How many questions each of those skills needs: several in a chapter of few skills. */
      questionsPerSkill: number;
      skillIds: string[];
      status: "start";
    }
  | { decision: RefusedUsage; status: "refused" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * Decides what asking for a chapter's test-out questions does, when the learner taps to get the
 * test ready: skills the test-out samples without their share of questions get some written
 * (shared with placement, reviews and practice), claimed as small AI help first. Nothing is written
 * when the test-out already has every skill's share.
 */
export async function requestTestOutQuestions({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId: string;
}): Promise<TestOutQuestionsRequest> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const testOut = await loadChapterTestOut({ chapterId, goal: owned.goal, userId: owned.userId });

  if (!testOut) {
    return { status: "notFound" };
  }

  if (testOut.needsItems.length === 0) {
    return { status: "ready" };
  }

  const decision = await claimAssist();

  if (decision.status === "unauthorized") {
    return decision;
  }

  if (decision.status !== "allowed") {
    return { decision, status: "refused" };
  }

  return {
    analytics: { distinctId: owned.userId, goalId, platform: await getRequestPlatform() },
    questionsPerSkill: testOut.questionsPerSkill,
    skillIds: testOut.needsItems,
    status: "start",
  };
}
