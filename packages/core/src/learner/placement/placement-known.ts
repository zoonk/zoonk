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

/** Whether the learner missed a skill anywhere, or said they don't know it yet. */
function hasMiss({
  evidence,
  skillId,
}: {
  evidence: readonly PlacementEvidence[];
  skillId: string;
}) {
  return evidence.some((answer) => answer.skillId === skillId && answer.outcome !== "correct");
}

/** A placement answer as the known bar reads it (see `meetsKnownBar`). */
function toOwnAnswer(answer: PlacementEvidence): OwnAnswer {
  return { isCorrect: answer.outcome === "correct", trueFalse: answer.format === "trueFalse" };
}

/**
 * The skills placement takes as known: the ones their own answers confirm (see `meetsKnownBar`,
 * the bar the plan's cut and the syllabus read too), and nothing else (the owner's decisions of 10
 * Oct). Right answers to placement's own questions count, a miss on it anywhere rules it out: one
 * right answer that isn't true or false, three that are, two when the learner asked to focus on
 * it. Pedro's organelle table, his focus with the buddy, was skipped the day before his test after
 * a placement answer on another topic. A right answer on what builds on a skill, a subject the
 * learner says they know, or the bands below the level they gave only mark it to confirm (see
 * `readSkillStatuses`).
 */
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

/**
 * The skills a measured level settles: a language level test's answers on calibrated questions
 * place the learner past the bands below their level (as the level's priors read it), so those
 * units are known, with the undo, unless a miss of their own says otherwise. They still get spaced
 * practice, and a miss there brings their lessons back. A stated level never comes here (D9).
 */
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

/** The direct prerequisites of the skills the learner answered right: a right answer points at them. */
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

/**
 * What placement's walk makes of each of the goal's skills. `known` once placement is sure of it
 * and its own answers confirm it (`listKnownSkillIds`): one right quick answer is enough to skip a
 * skill's lessons, and the walk still confirms it with a question that's harder to guess. Two kinds
 * are to confirm, never known before their own answers (the owner's decisions of 10 Oct):
 * `claimed`, what the learner's word alone says they know (a subject they know well, the bands
 * below the level they gave), which placement asks first; and `inferred`, a skill a right answer on
 * what's built directly on it suggests, asked as the walk reaches it. Either stops being one after
 * a miss. The rest from placement's beliefs: `unknown` when it's sure they can't do it yet, else
 * `unsure`.
 */
export function readSkillStatuses({
  answeredOnly = false,
  answers,
  evidence,
  focusedSkillIds,
  knownAreas = [],
  ownLevel = null,
  skills,
}: {
  /** A test from the learner's own material: only answers settle a topic, nothing is on trust. */
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
