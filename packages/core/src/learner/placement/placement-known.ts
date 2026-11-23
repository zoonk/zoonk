import { type OwnAnswer, isSkillConfirmed } from "../_utils/skill-claims";
import {
  type PlacementEvidence,
  getOwnBeliefs,
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
  return { ...answer, isCorrect: answer.outcome === "correct", itemId: answer.itemId ?? null };
}

/** Only own answers justify skipping; any miss rules it out even if prerequisite inference is confident. */
export function listKnownSkillIds({
  answers,
  evidence,
  skillIds,
}: {
  /** The answers to placement's own questions (see `isPlacementAnswer`). */
  answers: readonly PlacementEvidence[];
  evidence: readonly PlacementEvidence[];
  skillIds: readonly string[];
}): string[] {
  const eligible = new Set(answers);

  return skillIds.filter((skillId) =>
    isSkillConfirmed({
      answers: evidence
        .filter((answer) => answer.skillId === skillId && eligible.has(answer))
        .map((answer) => toOwnAnswer(answer)),
    }),
  );
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

/** claimed and inferred remain to confirm until own answers support known; claimed skills are asked first. Once a skill's own answers decide it, other skills' answers can't reopen it. */
export function readSkillStatuses({
  answeredOnly = false,
  answers,
  evidence,
  knownAreas = [],
  ownLevel = null,
  skills,
}: {
  /** For full-material tests, settle topics only from their own answers. */
  answeredOnly?: boolean;
  /** The answers to placement's own questions (see `isPlacementAnswer`). */
  answers: readonly PlacementEvidence[];
  evidence: readonly PlacementEvidence[];
  knownAreas?: readonly string[];
  ownLevel?: OwnLevel | null;
  skills: readonly PlacementSkill[];
}): SkillStatuses {
  const beliefs = getPlacementBeliefs({ answeredOnly, evidence, knownAreas, ownLevel, skills });
  const priors = getPlacementPriors({ answeredOnly, knownAreas, ownLevel, skills });
  const ownBeliefs = getOwnBeliefs({ evidence, priors });
  const skillIds = skills.map((skill) => skill.id);
  const confirmed = new Set(listKnownSkillIds({ answers, evidence, skillIds }));
  const pointedAt = answeredOnly ? new Set<string>() : listPointedAt({ evidence, skills });

  const statusOf = (skillId: string): SkillPlacementStatus => {
    if (confirmed.has(skillId)) {
      return "known";
    }

    const decided = [ownBeliefs, beliefs]
      .map((skillBeliefs) => getSkillPlacementStatus(skillBeliefs.get(skillId)))
      .find((status) => status === "unknown");

    if (decided) {
      return decided;
    }

    const open = !confirmed.has(skillId) && !hasMiss({ evidence, skillId });

    if (open && getSkillPlacementStatus(priors.get(skillId)) === "known") {
      return "claimed";
    }

    return open && pointedAt.has(skillId) ? "inferred" : "unsure";
  };

  return new Map(skillIds.map((skillId) => [skillId, statusOf(skillId)]));
}
