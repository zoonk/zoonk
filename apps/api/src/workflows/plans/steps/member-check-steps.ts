import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { type AddedSkill } from "@zoonk/core/plans/contract";
import {
  type ClaimedMemberCheck,
  type PlanMemberCheck,
  checkPlanMembers,
  claimMemberCheck,
  listPlansOwingMemberCheck,
  offerMemberSkills,
  toMemberSkills,
} from "@zoonk/core/plans/member-check";
import { toContentAnalytics } from "../../_shared/content-analytics";
import {
  type MemberCheckInputs,
  toMemberCheckRequest,
} from "../../goals/steps/goal-curriculum-steps";

export async function listPlansOwingMemberCheckStep(): Promise<string[]> {
  "use step";

  return listPlansOwingMemberCheck();
}

export async function claimMemberCheckStep(planId: string): Promise<ClaimedMemberCheck | null> {
  "use step";

  return claimMemberCheck(planId);
}

export async function checkPlanMembersStep({
  claimed,
  ...input
}: MemberCheckInputs & { claimed: ClaimedMemberCheck }): Promise<PlanMemberCheck> {
  "use step";

  return checkPlanMembers({ claimed, request: toMemberCheckRequest(input) });
}

export async function toMemberSkillsStep({
  analytics,
  scope,
  workflowRunId,
  ...input
}: Pick<MemberCheckInputs, "analytics" | "workflowRunId"> & {
  check: PlanMemberCheck;
  claimed: ClaimedMemberCheck;
  scope: CurriculumScope;
}): Promise<AddedSkill[]> {
  "use step";

  return toMemberSkills({
    ...input,
    analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
    scope,
  });
}

export async function offerMemberSkillsStep(
  input: Parameters<typeof offerMemberSkills>[0],
): Promise<void> {
  "use step";

  await offerMemberSkills(input);
}
