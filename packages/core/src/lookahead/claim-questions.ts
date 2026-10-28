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

const QUESTIONS_PER_TOPIC = 3;

const MAX_TOPICS_PER_RUN = 6;

/** On start, the caller must write questionsPerSkill in format for each skillId. */
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

/** Session POSTs only; claims AI help before writing questions needed to confirm unstudied claims. */
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
