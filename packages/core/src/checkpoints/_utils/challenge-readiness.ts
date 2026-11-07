import "server-only";
import { type Goal } from "@zoonk/db";
import { loadGoalListeningSkillIds } from "../../exams/listening/listening-skills";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import {
  type PlanGraph,
  parsePlanGraph,
  parsePlanPhases,
  parsePlanSettings,
} from "../../plans/planner/plan-state";
import { getSkippedSkillIds } from "../../sessions/_utils/review-skills";
import {
  type BossTiming,
  type ChallengeReadiness,
  getBossTimings,
  isBossDue,
} from "./boss-reached";
import { type OwnedChallenge } from "./owned-challenge";

/** GETs only, after ownership authorization. Only a due challenge's readiness reads the learner's skills. */
export async function readChallengeReadiness({
  goal,
  items,
  state: { graph, settings },
  today,
}: {
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind" | "targetLanguage">;
  items: readonly Parameters<typeof isBossDue>[0]["boss"][];
  state: { graph: PlanGraph; settings: unknown };
  today: Date;
}): Promise<ChallengeReadiness> {
  if (!items.some((boss) => isBossDue({ boss, today }))) {
    return {
      graphSkills: graph.skills,
      itemSkillIds: new Map(),
      listeningSkillIds: new Set(),
      movedEvents: [],
      skills: [],
    };
  }

  const [goalPlan, listeningSkillIds] = await Promise.all([
    readGoalPlan(goal.id),
    (goal.examBlueprintId ? readExamBlueprint(goal.examBlueprintId) : Promise.resolve(null)).then(
      (blueprint) => loadGoalListeningSkillIds({ blueprint, goal, graph }),
    ),
  ]);

  const skipped = getSkippedSkillIds({ graph, settings });

  return {
    graphSkills: graph.skills,
    itemSkillIds: new Map(goalPlan.items.map((item) => [item.id, item.skillIds])),
    listeningSkillIds,
    movedEvents: parsePlanSettings(settings).movedEvents,
    skills: goalPlan.skills.filter((skill) => !skipped.has(skill.id)),
  };
}

export async function readChallengeTiming(challenge: OwnedChallenge): Promise<BossTiming> {
  const { goal, item, items, plan, today } = challenge;

  if (item.kind !== "boss") {
    return item.scheduledFor !== null && item.scheduledFor <= today ? "nextSession" : "date";
  }

  const state = { graph: parsePlanGraph(plan.graph), settings: plan.settings };
  const readiness = await readChallengeReadiness({ goal, items, state, today });
  const phases = parsePlanPhases(plan.phases);

  return (
    getBossTimings({ plan: { ...readiness, goal, items, phases }, today }).get(item.id) ?? "date"
  );
}
