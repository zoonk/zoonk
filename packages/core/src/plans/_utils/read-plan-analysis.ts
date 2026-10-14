import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { chooseBases } from "../planner/base-choices";
import { type BuildPlanInput } from "../planner/build-plan";
import { type ExamSubjectShare } from "../planner/feasibility-coverage";
import { getPlanFeasibility } from "../planner/plan-feasibility";
import { readBuiltPlan } from "./read-built-plan";

export type PlanAnalysisPurpose = "screen" | "full";

/** Pure read analysis, with explicit fields so serialization never invokes unused lazy searches. */
export async function readPlanAnalysis({
  examSubjects,
  input,
  landing,
  purpose,
  userId,
}: {
  examSubjects: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
  landing: Pick<BuildPlanInput, "heldSkillsLand" | "landedOnly">;
  purpose: PlanAnalysisPurpose;
  userId: string;
}) {
  "use cache";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  const planned = await readBuiltPlan({ input: { ...input, ...landing }, userId });
  const feasibility = getPlanFeasibility({ examSubjects, input, planned });

  return {
    bases: chooseBases(input).advise(),
    feasibility: {
      alternative: feasibility.alternative,
      coreFits: feasibility.coreFits,
      ...(purpose === "full" ? { coreMinutes: feasibility.coreMinutes } : {}),
      coveredShare: feasibility.coveredShare,
      deadline: feasibility.deadline,
      deepensMostAsked: feasibility.deepensMostAsked,
      endDate: feasibility.endDate,
      fits: feasibility.fits,
      fittingDate: feasibility.fittingDate,
      fullCourseEndDate: feasibility.fullCourseEndDate,
      maximum: feasibility.maximum,
      measure: feasibility.measure,
      recommendedMinutes: feasibility.recommendedMinutes,
      skillFits: feasibility.skillFits,
      timeCovers: feasibility.timeCovers,
    },
  };
}
