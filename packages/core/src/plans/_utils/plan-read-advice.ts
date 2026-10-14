import { once } from "@zoonk/utils/once";
import { type BuildPlanInput, type BuiltPlan } from "../planner/build-plan";
import { type StudyScheduleAt } from "../planner/daily-time-plans";
import { type ExamSubjectShare } from "../planner/feasibility-coverage";
import { type PlanBases } from "../planner/plan-bases";
import { type PlanFeasibility, getPlanFeasibility } from "../planner/plan-feasibility";
import { type PlanAnalysisPurpose, readPlanAnalysis } from "./read-plan-analysis";

/** Read advice stays synchronous to consumers; callbacks and mutation analysis stay local. */
export async function loadPlanReadAdvice({
  advise,
  examSubjects,
  input,
  landing,
  planned,
  readAnalysis,
  reuseReadBuild,
  studyScheduleAt,
  userId,
}: {
  advise: () => PlanBases;
  examSubjects: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
  landing: Pick<BuildPlanInput, "heldSkillsLand" | "landedOnly">;
  planned: BuiltPlan;
  readAnalysis?: PlanAnalysisPurpose;
  reuseReadBuild: boolean;
  studyScheduleAt?: StudyScheduleAt;
  userId: string;
}): Promise<{ bases: () => PlanBases; feasibility: () => PlanFeasibility }> {
  const local = once(() => getPlanFeasibility({ examSubjects, input, planned, studyScheduleAt }));
  const bases = once(advise);

  const analysis =
    reuseReadBuild && readAnalysis && !studyScheduleAt
      ? await readPlanAnalysis({ examSubjects, input, landing, purpose: readAnalysis, userId })
      : null;

  return {
    bases: () => analysis?.bases ?? bases(),
    feasibility: () =>
      analysis
        ? {
            ...analysis.feasibility,
            get coreMinutes() {
              return readAnalysis === "full"
                ? (analysis.feasibility.coreMinutes ?? null)
                : local().coreMinutes;
            },
          }
        : local(),
  };
}
