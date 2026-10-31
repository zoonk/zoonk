import "server-only";
import { type SkillStateCounts } from "../learner/mastery-state";
import { loadGoalPreparation } from "./_utils/load-goal-preparation";
import { type AreaPreparation } from "./area-preparation";
import { type EstimatedScore } from "./estimated-score";
import { type PlanStatus } from "./plan-status";
import { type PreparationComponents, type PreparationStage } from "./preparation-math";
import { type SectionPreparation } from "./section-preparation";

/** `value` and every part run from 0 to 1. */
type GoalPreparation = {
  areas: AreaPreparation[];
  components: PreparationComponents;
  estimatedScore: EstimatedScore | null;
  goalId: string;
  sections: SectionPreparation[];
  skills: SkillStateCounts;
  stage: PreparationStage;
  status: PlanStatus | null;
  value: number;
  weakestAreaId: string | null;
  /** Since Monday 00:00 in the learner's time zone. */
  weekGain: number;
};

export type GoalPreparationResult =
  | { preparation: GoalPreparation; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

export async function getGoalPreparation(goalId: string): Promise<GoalPreparationResult> {
  "use cache: private";

  return loadGoalPreparation({ goalId });
}
