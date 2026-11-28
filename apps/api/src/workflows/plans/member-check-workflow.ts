import { startOnce } from "../_shared/run-token";
import {
  checkPlanMembersStep,
  claimMemberCheckStep,
  listPlansOwingMemberCheckStep,
  offerMemberSkillsStep,
  toMemberSkillsStep,
} from "./steps/member-check-steps";

export function getMemberCheckToken(planId: string): string {
  return `member-check:${planId}`;
}

/**
 * Checks a saved plan against the complete list its goal names and asks the learner to add the
 * members it leaves out. The claim comes first, so a dismissed offer is never made again.
 */
export async function memberCheckWorkflow({ planId }: { planId: string }): Promise<number> {
  "use workflow";

  const claimed = await claimMemberCheckStep(planId);

  if (!claimed) {
    return 0;
  }

  const check = await checkPlanMembersStep(claimed);

  if (check.coverage.uncovered.length === 0) {
    return 0;
  }

  const skills = await toMemberSkillsStep({ check, claimed });
  await offerMemberSkillsStep({ check, claimed, skills });

  return skills.length;
}

/** Plans whose build couldn't finish the check, and those built before it existed. */
export async function checkOwedPlanMembers(): Promise<number> {
  const planIds = await listPlansOwingMemberCheckStep();

  await Promise.all(
    planIds.map((planId) =>
      startOnce(memberCheckWorkflow, [{ planId }], getMemberCheckToken(planId)),
    ),
  );

  return planIds.length;
}
