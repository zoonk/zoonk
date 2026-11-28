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

export async function listPlansOwingMemberCheckStep(): Promise<string[]> {
  "use step";

  return listPlansOwingMemberCheck();
}

export async function claimMemberCheckStep(planId: string): Promise<ClaimedMemberCheck | null> {
  "use step";

  return claimMemberCheck(planId);
}

export async function checkPlanMembersStep(claimed: ClaimedMemberCheck): Promise<PlanMemberCheck> {
  "use step";

  return checkPlanMembers(claimed);
}

export async function toMemberSkillsStep(input: {
  check: PlanMemberCheck;
  claimed: ClaimedMemberCheck;
}): Promise<AddedSkill[]> {
  "use step";

  return toMemberSkills(input);
}

export async function offerMemberSkillsStep(
  input: Parameters<typeof offerMemberSkills>[0],
): Promise<void> {
  "use step";

  await offerMemberSkills(input);
}
