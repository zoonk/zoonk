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

/**
 * `coreFits` is about the plan the learner chose; `reachedShare` about the whole exam or goal, where
 * a subject they took out isn't reached.
 */
export function measureReach({
  skills,
  takenOutWorth,
}: {
  skills: readonly { reached: boolean; wholeWorth: number }[];
  takenOutWorth: number;
}) {
  const kept = skills.reduce((sum, skill) => sum + skill.wholeWorth, 0);
  const reached = skills.reduce((sum, skill) => sum + (skill.reached ? skill.wholeWorth : 0), 0);
  const total = kept + takenOutWorth;
  const coreFits = skills.every((skill) => skill.reached);

  return {
    coreFits,
    reachedShare:
      coreFits && takenOutWorth <= 0
        ? 1
        : Math.min(LARGEST_PARTIAL_SHARE, total > 0 ? reached / total : 0),
  };
}
