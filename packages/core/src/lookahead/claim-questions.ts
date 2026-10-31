import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { claimUsageFor } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { loadSkillsToConfirm } from "../learner/_utils/load-skill-claims";
import { findGoalFor } from "../learner/_utils/owned-goal";
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

/** Internal, for a session's preparation: `userId` must come from the learner's own write. Claims AI help before writing questions needed to confirm unstudied claims. */
export async function requestClaimQuestionsFor({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<ClaimQuestionsRequest> {
  const owned = await findGoalFor({ goalId, userId });

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

  const toConfirm = await loadSkillsToConfirm({ goalId, skillIds, userId });

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

  const decision = await claimUsageFor({ kind: "assist", targetId: randomUUID(), userId });

  if (decision.status === "unauthorized") {
    return decision;
  }

  if (decision.status !== "allowed") {
    return { decision, status: "refused" };
  }

  return {
    analytics: { distinctId: userId, goalId, platform: null },
    format: quickFormat,
    questionsPerSkill: QUESTIONS_PER_TOPIC,
    skillIds: missing,
    status: "start",
  };
}
