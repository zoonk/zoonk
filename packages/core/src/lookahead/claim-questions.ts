import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { claimUsageFor } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { loadSkillsToConfirm } from "../learner/_utils/load-skill-claims";
import { findGoalFor } from "../learner/_utils/owned-goal";
import { loadCourseStarts, priorityCourseStarts } from "../plans/_utils/course-starts";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { getTestSkillIds } from "../sessions/_utils/review-skills";
import { pickPlacementItemSkills } from "./placement-item-skills";

const MAX_TOPICS_PER_RUN = 6;

/** On start, the caller must write each skillId's missing low-guess tap questions. */
export type ClaimQuestionsRequest =
  | { status: "ready" }
  | {
      analytics: { distinctId: string; goalId: string; platform: AnalyticsPlatform | null };
      skillIds: string[];
      status: "start";
    }
  | { decision: RefusedUsage; status: "refused" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Internal, for a session's preparation: `userId` must come from the learner's own write. Claims AI help before writing the tap questions needed to confirm unstudied claims. */
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

  const starts = owned.goal.kind === "learn" ? await loadCourseStarts(goalId) : new Map();
  const nearest = await priorityCourseStarts(goalId, starts);

  const ordered = [
    ...new Set([
      ...nearest.filter((id) => toConfirm.has(id)),
      ...[...toConfirm].filter((id) => starts.has(id)).toReversed(),
      ...toConfirm,
    ]),
  ];

  const { skills } = await pickPlacementItemSkills({
    exceptAnswered: true,
    formats: ["tap"],
    goalId,
    skillIds: ordered,
  });

  const missing = skills.slice(0, MAX_TOPICS_PER_RUN).map((skill) => skill.id);

  if (missing.length === 0) {
    return { status: "ready" };
  }

  const courseMissing = missing.filter((id) => starts.has(id));

  if (courseMissing.length > 0) {
    return {
      analytics: { distinctId: userId, goalId, platform: null },
      skillIds: courseMissing,
      status: "start",
    };
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
    skillIds: missing,
    status: "start",
  };
}
