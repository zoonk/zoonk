import { type OwnAnswer, meetsKnownBar } from "../_utils/skill-claims";
import {
  type PlacementEvidence,
  getPlacementBeliefs,
  getPlacementPriors,
} from "./placement-beliefs";
import { type PlacementSkill } from "./placement-graph";
import {
  type SkillPlacementStatus,
  type SkillStatuses,
  getSkillPlacementStatus,
} from "./placement-status";
import { type OwnLevel } from "./placement-steps";

function hasMiss({
  evidence,
  skillId,
}: {
  evidence: readonly PlacementEvidence[];
  skillId: string;
}) {
  return evidence.some((answer) => answer.skillId === skillId && answer.outcome !== "correct");
}

function toOwnAnswer(answer: PlacementEvidence): OwnAnswer {
  return { isCorrect: answer.outcome === "correct", trueFalse: answer.format === "trueFalse" };
}

/** Only own answers justify skipping; any miss rules it out even if prerequisite inference is confident. */
export function listKnownSkillIds({
  answers,
  evidence,
  focusedSkillIds,
  skillIds,
}: {
  /** The answers to placement's own questions (see `isPlacementAnswer`). */
  answers: readonly PlacementEvidence[];
  evidence: readonly PlacementEvidence[];
  focusedSkillIds: ReadonlySet<string>;
  skillIds: readonly string[];
}): string[] {
  return skillIds.filter((skillId) =>
    meetsKnownBar({
      answers: [
        ...evidence.filter((answer) => answer.skillId === skillId && answer.outcome !== "correct"),
        ...answers.filter((answer) => answer.skillId === skillId && answer.outcome === "correct"),
      ].map((answer) => toOwnAnswer(answer)),
      focused: focusedSkillIds.has(skillId),
    }),
  );
}

/** Use only measured levels, never self-reported ones; a skill's own miss still overrides the level. */
export function listKnownByMeasuredLevel({
  evidence,
  level,
  skills,
}: {
  evidence: readonly PlacementEvidence[];
  level: OwnLevel | null;
  skills: readonly PlacementSkill[];
}): string[] {
  if (!level) {
    return [];
  }

  const priors = getPlacementPriors({ ownLevel: level, skills });

  return skills
    .filter(
      (skill) =>
        getSkillPlacementStatus(priors.get(skill.id)) === "known" &&
        !hasMiss({ evidence, skillId: skill.id }),
    )
    .map((skill) => skill.id);
}

function listPointedAt({
  evidence,
  skills,
}: {
  evidence: readonly PlacementEvidence[];
  skills: readonly PlacementSkill[];
}): Set<string> {
  const right = new Set(
    evidence.filter((answer) => answer.outcome === "correct").map((answer) => answer.skillId),
  );

  return new Set(
    skills.filter((skill) => right.has(skill.id)).flatMap((skill) => skill.prerequisiteIds),
  );
}

/** claimed and inferred remain to confirm until own answers support known; claimed skills are asked first. */
export function readSkillStatuses({
  answeredOnly = false,
  answers,
  evidence,
  focusedSkillIds,
  knownAreas = [],
  ownLevel = null,
  skills,
}: {
  /** For full-material tests, settle topics only from their own answers. */
  answeredOnly?: boolean;
  /** The answers to placement's own questions (see `isPlacementAnswer`). */
  answers: readonly PlacementEvidence[];
  evidence: readonly PlacementEvidence[];
  focusedSkillIds: ReadonlySet<string>;
  knownAreas?: readonly string[];
  ownLevel?: OwnLevel | null;
  skills: readonly PlacementSkill[];
}): SkillStatuses {
  const beliefs = getPlacementBeliefs({ answeredOnly, evidence, knownAreas, ownLevel, skills });
  const priors = getPlacementPriors({ answeredOnly, knownAreas, ownLevel, skills });
  const skillIds = skills.map((skill) => skill.id);
  const confirmed = new Set(listKnownSkillIds({ answers, evidence, focusedSkillIds, skillIds }));
  const pointedAt = answeredOnly ? new Set<string>() : listPointedAt({ evidence, skills });

  const statusOf = (skillId: string): SkillPlacementStatus => {
    const believed = getSkillPlacementStatus(beliefs.get(skillId));
    const open = !confirmed.has(skillId) && !hasMiss({ evidence, skillId });

    if (believed === "unknown" || (believed === "known" && confirmed.has(skillId))) {
      return believed;
    }

    if (open && getSkillPlacementStatus(priors.get(skillId)) === "known") {
      return "claimed";
    }

    return open && pointedAt.has(skillId) ? "inferred" : "unsure";
  };

  return new Map(skillIds.map((skillId) => [skillId, statusOf(skillId)]));
}
