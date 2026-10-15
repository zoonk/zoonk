import "server-only";
import { type SkillStateCounts } from "../learner/mastery-state";
import { loadGoalPreparation } from "./_utils/load-goal-preparation";
import { type AreaPreparation } from "./area-preparation";
import { type EstimatedScore } from "./estimated-score";
import { type PlanStatus } from "./plan-status";
import { type PreparationComponents, type PreparationStage } from "./preparation-math";
import { type SectionPreparation } from "./section-preparation";

/**
 * Preparation for one goal, overall, per area (its chapters, which rebalancing reads) and per
 * section (its subjects, which the syllabus shows; `value` is theirs together, see
 * `measurePreparation`). `value` and every part run from 0 to 1. `estimatedScore` exists only once
 * recent mock exams hold enough of the exam (see `canEstimateScore`) and is a range, labeled
 * "Estimated" wherever it shows.
 */
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
  /** Gained since the learner's week began (Monday 00:00 in their time zone): "+3 this week". */
  weekGain: number;
};

export type GoalPreparationResult =
  | { preparation: GoalPreparation; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * Builds the preparation view model for one of the learner's goals: the four parts with their
 * evidence (the fourth is an exam's mock exams, or another goal's weekly challenges), the overall
 * number and its gain this week, the plan status, the estimated score after an exam's mock, and
 * each area with its skill states and whether it needs practice. Explanations have none.
 */
export async function getGoalPreparation(goalId: string): Promise<GoalPreparationResult> {
  "use cache: private";

  return loadGoalPreparation({ goalId });
}
