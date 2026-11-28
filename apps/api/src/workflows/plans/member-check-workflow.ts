import { needsMemberCheck } from "@zoonk/core/library/curriculum/add-member-skills";
import { getWorkflowMetadata } from "workflow";
import { startOnce } from "../_shared/run-token";
import {
  decideGoalScopeStep,
  loadGoalCurriculumStep,
  toPrivateScope,
} from "../goals/steps/goal-curriculum-steps";
import {
  checkPlanMembersStep,
  claimMemberCheckStep,
  listPlansOwingMemberCheckStep,
  offerMemberSkillsStep,
  toMemberSkillsStep,
} from "./steps/member-check-steps";

/** @internal */
export function getMemberCheckToken(planId: string): string {
  return `member-check:${planId}`;
}

/**
 * Checks a saved plan against the complete list its goal names and asks the learner to add the
 * members it leaves out. The claim comes first, so a dismissed offer is never made again. The check
 * reads the goal and writes its skills the way the build did: a learner's own skills keep the new
 * ones theirs, and a shared graph never reads the learner's words. @internal
 */
export async function memberCheckWorkflow({ planId }: { planId: string }): Promise<number> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const claimed = await claimMemberCheckStep(planId);
  const inputs = claimed ? await loadGoalCurriculumStep(claimed.goalId) : null;

  if (!claimed || !inputs || !needsMemberCheck(inputs)) {
    return 0;
  }

  const context = {
    analytics: { distinctId: claimed.userId, goalId: claimed.goalId },
    workflowRunId,
  };

  const scope = claimed.ownSkills
    ? toPrivateScope(inputs.goal)
    : await decideGoalScopeStep({ ...context, inputs });

  const check = await checkPlanMembersStep({ ...context, claimed, inputs, scope });

  if (check.coverage.uncovered.length === 0) {
    return 0;
  }

  const skills = await toMemberSkillsStep({ ...context, check, claimed, scope });
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
