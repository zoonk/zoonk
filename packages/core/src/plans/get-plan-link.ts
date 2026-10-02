import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { getLinkSubject, keepPublicGraph, loadLinkedPlan } from "./_utils/linked-plan";
import { type PlanLinkOutline } from "./plan-link-contract";
import { getLearningShare } from "./planner/plan-phases";
import { type PlanGraph, parsePlanGraph } from "./planner/plan-state";
import { DEFAULT_LESSON_MINUTES } from "./planner/plan-units";

export type PlanLinkResult =
  | { outline: PlanLinkOutline; owner: { goalId: string } | null; status: "ready" }
  | { status: "notFound" };

const MINUTES_PER_HOUR = 60;

/** Hours from the plan's size: each lesson with the reviews and practice around it. */
function toHours({ graph, phase }: { graph: PlanGraph; phase?: number }): number {
  const lessons = graph.skills
    .filter((skill) => phase === undefined || skill.phase === phase)
    .reduce((total, skill) => total + skill.lessons, 0);

  const share = getLearningShare({ phaseKind: "learn", practiceBias: "balanced" });
  return Math.round(((lessons * DEFAULT_LESSON_MINUTES) / share / MINUTES_PER_HOUR) * 10) / 10;
}

/**
 * What a plan's link shows. Plans are private, but a learner can send the URL to a friend: anyone
 * who opens it sees the subject and the plan's shape and can start their own plan from it. The
 * owner is told the link is theirs, so the app can show their own plan instead.
 */
export async function getPlanLink(planId: string): Promise<PlanLinkResult> {
  "use cache: private";

  if (!isUuid(planId)) {
    return { status: "notFound" };
  }

  const [plan, session] = await Promise.all([loadLinkedPlan(planId), getSession()]);

  if (!plan) {
    return { status: "notFound" };
  }

  const isOwner = session?.user.id === plan.goal.userId;

  /** The owner's changes to the plan revalidate every open link. */
  cacheTag(getGoalsCacheTag(plan.goal.userId));

  const graph = await keepPublicGraph(parsePlanGraph(plan.graph));

  return {
    outline: {
      goalKind: plan.goal.kind,
      hours: toHours({ graph }),
      language: plan.goal.language,
      phases: graph.phases.map((phase, index) => ({
        hours: toHours({ graph, phase: index }),
        milestone: phase.milestone,
        name: phase.name,
      })),
      skillCount: graph.skills.length,
      subject: getLinkSubject(plan.goal),
      targetLanguage: plan.goal.targetLanguage,
    },
    owner: isOwner ? { goalId: plan.goal.id } : null,
    status: "ready",
  };
}
