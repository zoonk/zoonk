import {
  type ChallengeChoice,
  type ChallengeContent,
  type ChallengeEnding,
  type ChallengeMeter,
  type ChallengeNote,
} from "../steps/contract/challenge-content";
import { type ChallengeStep, walkChallenge } from "./challenge-graph";

const QUALITY_SCORES: Record<ChallengeChoice["quality"], number> = {
  fair: 0.5,
  strong: 1,
  weak: 0,
};

/** Half the best score or more counts as right: the learner always finishes the case either way. */
const PASS_SCORE = 0.5;

const METER_MIN = 0;
const METER_MAX = 100;

export type ChallengeMeterState = ChallengeMeter & {
  /** How the last decision moved it, 0 when it didn't. */
  change: number;
  value: number;
};

/** What the case says after it ends: what went well, what to improve and what to practice. */
type ChallengeDebrief = {
  good: ChallengeNote[];
  improve: ChallengeNote[];
  /** The skill with the most to improve on this path, with its practice line; null when none. */
  practice: ChallengeContent["skills"][number] | null;
  skills: ChallengeContent["skills"];
};

type ChallengeResult = {
  ending: ChallengeEnding;
  isCorrect: boolean;
  /** From 0 to 1: strong decisions count 1, fair ones half and weak ones 0. */
  score: number;
  steps: ChallengeStep[];
};

/** The share of good decisions on a path, from 0 to 1. */
function scoreChallengeSteps(steps: readonly ChallengeStep[]): number {
  if (steps.length === 0) {
    return 0;
  }

  const total = steps.reduce((sum, step) => sum + QUALITY_SCORES[step.choice.quality], 0);
  return total / steps.length;
}

/** Grades a finished path: null when the picks don't make a path that ends. */
export function gradeChallengePath(
  content: ChallengeContent,
  choiceIds: readonly string[],
): ChallengeResult | null {
  const walk = walkChallenge(content, choiceIds);

  if (walk.status !== "ended") {
    return null;
  }

  const score = scoreChallengeSteps(walk.steps);

  return { ending: walk.ending, isCorrect: score >= PASS_SCORE, score, steps: walk.steps };
}

function clampMeter(value: number): number {
  return Math.min(METER_MAX, Math.max(METER_MIN, value));
}

/** Each meter after the decisions so far, with how the last one moved it. */
export function getChallengeMeters(
  content: ChallengeContent,
  steps: readonly ChallengeStep[],
): ChallengeMeterState[] {
  const last = steps.at(-1);

  return content.meters.map((meter) => {
    const value = steps.reduce((current, step) => {
      const effect = step.choice.effects.find((item) => item.meter === meter.id);
      return clampMeter(current + (effect?.change ?? 0));
    }, meter.start);

    const change = last?.choice.effects.find((item) => item.meter === meter.id)?.change ?? 0;

    return { ...meter, change, value };
  });
}

function countImprovements(notes: readonly ChallengeNote[], skillId: string): number {
  return notes.filter((note) => note.skill === skillId).length;
}

/**
 * The debrief of a path: the notes its decisions earned, the skills the case trains and, when
 * something needs work, the practice for the skill with the most to improve (the first listed on
 * a tie). It praises the strategy, since the notes describe decisions, not the learner.
 */
export function getChallengeDebrief(
  content: ChallengeContent,
  steps: readonly ChallengeStep[],
): ChallengeDebrief {
  const notes = steps.flatMap((step) => step.choice.notes);
  const improve = notes.filter((note) => note.kind === "improve");

  const practice = content.skills.reduce<ChallengeContent["skills"][number] | null>(
    (weakest, skill) => {
      const count = countImprovements(improve, skill.id);
      const best = weakest ? countImprovements(improve, weakest.id) : 0;
      return count > best ? skill : weakest;
    },
    null,
  );

  return {
    good: notes.filter((note) => note.kind === "good"),
    improve,
    practice,
    skills: content.skills,
  };
}
