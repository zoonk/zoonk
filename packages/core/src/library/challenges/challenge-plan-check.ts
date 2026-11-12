import { assembleChallengeCase, draftEmptyScript } from "@zoonk/ai/tasks/challenge/assemble";
import { type ChallengePlan } from "@zoonk/ai/tasks/challenge/plan";
import { getPlanFactProblems } from "@zoonk/ai/tasks/challenge/plan-paths";
import { checkWrittenChallenge } from "./challenge-case-content";
import { type ChallengeLessonSpec } from "./challenge-lesson-spec";

function getSkillProblems({ given, plan }: { given: number; plan: ChallengePlan }): string[] {
  const expected = given;

  return plan.skills.length < expected
    ? [
        `The plan trains ${plan.skills.length} of the ${expected} skills it must: \`skills\` needs one entry for each skill in SKILLS, in the same order, each trained by a decision`,
      ]
    : [];
}

export function checkChallengePlan({
  plan,
  skills,
  variant,
}: {
  plan: ChallengePlan;
  skills: readonly unknown[];
  variant: ChallengeLessonSpec["variant"];
}): string[] {
  const { written } = assembleChallengeCase({ plan, script: draftEmptyScript(plan) });

  return [
    ...checkWrittenChallenge({ variant, written }).problems,
    ...getSkillProblems({ given: skills.length, plan }),
    ...getPlanFactProblems(plan),
  ];
}
