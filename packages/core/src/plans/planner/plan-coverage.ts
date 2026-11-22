import { type SelectedCoverage } from "../_utils/selected-summary-contract";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { toIsoDate } from "./plan-calendar";
import { type ExamSubjectShare, getCoverage } from "./selected-coverage";
import { listSettled, readRequirement } from "./selected-requirement";

export function getCoverageDeadline({ built, input }: { built: BuiltPlan; input: BuildPlanInput }) {
  const { targetDate } = input.goal;

  if (!targetDate) {
    return null;
  }

  const finalStretch = built.phases.find((phase) => phase.kind === "finalStretch");
  return finalStretch?.startDate ?? toIsoDate(targetDate);
}

export function getSelectedCoverage({
  built,
  examSubjects,
  input,
}: {
  built: BuiltPlan;
  examSubjects: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
}): SelectedCoverage | null {
  const deadline = getCoverageDeadline({ built, input });
  const { targetDate } = input.goal;

  return deadline && targetDate
    ? getCoverage({
        built,
        deadline,
        examSubjects,
        input,
        requirement: readRequirement({ built, input }),
        settled: listSettled(input),
        targetDate: toIsoDate(targetDate),
      })
    : null;
}
