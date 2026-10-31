import "server-only";
import { type Goal } from "@zoonk/db";
import { listCurrentUserSkills } from "../../learner/list-current-user-skills";
import { listCurrentUserMistakes } from "../../mistakes/list-current-user-mistakes";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { loadStillNeededWork } from "../../preparation/_utils/load-still-needed-work";
import {
  type GoalPreparationResult,
  getGoalPreparation,
} from "../../preparation/get-goal-preparation";
import { type StillNeeded, buildStillNeeded } from "../../preparation/still-needed";
import { resolveViewGoal } from "../_utils/resolve-view-goal";

type Preparation = Extract<GoalPreparationResult, { status: "ready" }>["preparation"];

/** Estimated exam scores require a completed mock. */
export type ProgressView = {
  goal: Pick<Goal, "id" | "kind" | "title"> & { targetDate: string | null };
  mistakes: { open: number };
  /** Null for a quick explanation: one answer, not a goal to prepare for. */
  preparation: Preparation | null;
  stillNeeded: StillNeeded;
};

export type ProgressViewResult =
  | { progress: ProgressView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

/** Requires ownership of the requested or default active goal. */
export async function getProgressView(
  input: { goalId?: string } = {},
): Promise<ProgressViewResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;

  const isExplanation = goal.kind === "explain";

  const [preparation, skills, mistakes, work] = await Promise.all([
    isExplanation ? null : getGoalPreparation(goal.id),
    listCurrentUserSkills({ goalId: goal.id }),
    listCurrentUserMistakes({ goalId: goal.id, limit: 1, offset: 0 }),
    loadStillNeededWork({ goalId: goal.id, now: new Date() }),
  ]);

  if ((preparation && preparation.status !== "ready") || skills.status !== "ready") {
    return { status: "notFound" };
  }

  return {
    progress: {
      goal: {
        id: goal.id,
        kind: goal.kind,
        targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
        title: goal.title,
      },
      mistakes: { open: mistakes.status === "ready" ? mistakes.counts.open : 0 },
      preparation: preparation?.status === "ready" ? preparation.preparation : null,
      stillNeeded: buildStillNeeded({
        goalKind: goal.kind,
        skills: isExplanation ? [] : skills.skills,
        ...work,
      }),
    },
    status: "ready",
  };
}
