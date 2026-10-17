import { once } from "@zoonk/utils/once";
import { type BuildPlanInput, type BuiltPlan } from "../planner/build-plan";
import { type StudyScheduleAt } from "../planner/daily-time-plans";
import { type PlanBases } from "../planner/plan-bases";
import { daysBetween } from "../planner/plan-calendar";
import { type PlanFeasibility, getPlanFeasibility } from "../planner/plan-feasibility";
import { type ExamSubjectShare } from "../planner/feasibility-coverage";
import { readPlanAnalysis } from "./read-plan-analysis";

/**
 * Read advice stays synchronous to consumers; callbacks and mutation analysis stay local. A read
 * takes what the plan covers at the learner's own time from the cached analysis; what other daily
 * times or dates would do stays a local, lazy search that no read asks for (the learner asks for
 * it: see `findPlanTimeToCover`).
 */
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
  readAnalysis?: boolean;
  reuseReadBuild: boolean;
  studyScheduleAt?: StudyScheduleAt;
  userId: string;
}): Promise<{ bases: () => PlanBases; feasibility: () => PlanFeasibility }> {
  const local = once(() => getPlanFeasibility({ examSubjects, input, planned, studyScheduleAt }));
  const bases = once(advise);

  const analysis =
    reuseReadBuild && readAnalysis && !studyScheduleAt
      ? await readPlanAnalysis({ examSubjects, input, landing, userId })
      : null;

  return {
    bases: () =>
      analysis
        ? {
            bases: [...analysis.bases],
            daysLeft: input.goal.targetDate
              ? daysBetween(input.today, input.goal.targetDate)
              : null,
            // Plans every base in depth: never read for a page (see `getPlanBasesAdvice`).
            get recommended() {
              return bases().recommended;
            },
          }
        : bases(),
    feasibility: () =>
      analysis
        ? {
            ...analysis.feasibility,
            get alternative() {
              return local().alternative;
            },
            get coreMinutes() {
              return local().coreMinutes;
            },
            get fittingDate() {
              return local().fittingDate;
            },
            get fullCourseEndDate() {
              return local().fullCourseEndDate;
            },
            get maximum() {
              return local().maximum;
            },
            get recommendedMinutes() {
              return local().recommendedMinutes;
            },
          }
        : local(),
  };
}
