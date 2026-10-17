import "server-only";
import { prisma } from "@zoonk/db";
import { getRequestPlatform } from "../analytics/request-platform";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { claimAssist } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { loadSkillsToConfirm } from "../learner/_utils/load-skill-claims";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { type PlacementQuickFormat } from "../learner/placement/placement-quick-format";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { getTestSkillIds } from "../sessions/_utils/review-skills";
import { pickPlacementItemSkills } from "./placement-item-skills";

/** A few questions confirm a topic, or find the gap, over the next days' practice. */
const QUESTIONS_PER_TOPIC = 3;

/** At most this many topics get questions per preparation: the next ones get theirs at the next. */
const MAX_TOPICS_PER_RUN = 6;

/**
 * `ready`: every topic the learner was taken to know has a question practice can ask. `start`:
 * the caller writes `questionsPerSkill` questions in `format` for `skillIds`, which join the shared
 * bank. `refused`: the learner's AI help allowance doesn't cover it now.
 */
export type ClaimQuestionsRequest =
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
  | { status: "unauthorized" };

/**
 * Decides whether getting a learner's session ready also writes questions for topics they were
 * taken to know (one right answer, a test-out) that practice has none left to ask: one right answer
 * frees a topic from its lessons, never from practice (see `SkillClaim`), and a topic practice
 * can't ask would stay unconfirmed. Only a few topics a run, a few questions each, in the exam's
 * quick format and its shared bank, so later learners reuse them; claimed as small AI help first.
 * Only the POSTs that build or move a session along ask for it, never a page view.
 */
export async function requestClaimQuestions({
  goalId,
}: {
  goalId: string;
}): Promise<ClaimQuestionsRequest> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const plan = await prisma.plan.findUnique({
    select: { graph: true, settings: true },
    where: { goalId },
  });

  const skillIds = getTestSkillIds({
    graph: parsePlanGraph(plan?.graph),
    planSkillIds: [],
    settings: plan?.settings,
  });

  const toConfirm = await loadSkillsToConfirm({ goalId, skillIds, userId: owned.userId });

  if (toConfirm.size === 0) {
    return { status: "ready" };
  }

  const { quickFormat, skills } = await pickPlacementItemSkills({
    exceptAnswered: true,
    goalId,
    skillIds: [...toConfirm],
  });

  const missing = skills.slice(0, MAX_TOPICS_PER_RUN).map((skill) => skill.id);

  if (missing.length === 0) {
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
    format: quickFormat,
    questionsPerSkill: QUESTIONS_PER_TOPIC,
    skillIds: missing,
    status: "start",
  };
}
