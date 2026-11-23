import { refreshTestedOutPlan } from "@zoonk/core/plans/refresh-tested-out-plan";

export async function refreshTestedOutPlanStep(input: Parameters<typeof refreshTestedOutPlan>[0]) {
  "use step";

  await refreshTestedOutPlan(input);
}
