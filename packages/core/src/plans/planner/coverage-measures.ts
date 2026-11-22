import { type SelectedCoverage } from "../_utils/selected-summary-contract";
import { PLAN_EPSILON } from "./plan-precision";

type SelectedSkill = SelectedCoverage["skills"][number];

// A missing topic can carry no weight, so the weighted ratio alone can reach 1.
const LARGEST_PARTIAL_SHARE = 1 - Number.EPSILON / 2;

export function getSkillValue(skill: SelectedSkill): number {
  if (skill.state === "settled") {
    return 1;
  }

  return skill.state === "unknown" ? 0 : Math.min(1, skill.coveredRaw / skill.requiredRaw);
}

/** How much of each skill's lessons the plan holds before the deadline. */
export function measureDepth({
  coreFits,
  skills,
}: {
  coreFits: boolean;
  skills: readonly SelectedSkill[];
}) {
  const total = skills.reduce((sum, skill) => sum + skill.worth, 0);
  const covered = skills.reduce((sum, skill) => sum + skill.worth * getSkillValue(skill), 0);
  const limit = coreFits ? 1 : LARGEST_PARTIAL_SHARE;

  const whole = skills.every(
    (skill) =>
      skill.state === "settled" ||
      (skill.state === "measured" && skill.coveredRaw >= skill.requiredRaw - PLAN_EPSILON),
  );

  return {
    coveredShare: total > 0 ? Math.min(limit, Math.max(0, covered / total)) : null,
    fits: coreFits && total > 0 && whole,
  };
}
