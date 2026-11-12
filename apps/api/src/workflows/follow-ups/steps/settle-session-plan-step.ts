import { settleSessionPlan } from "@zoonk/core/sessions/settle-plan";

export async function settleSessionPlanStep(input: Parameters<typeof settleSessionPlan>[0]) {
  "use step";
  await settleSessionPlan(input);
}
