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

const PASS_SCORE = 0.5;

const METER_MIN = 0;
const METER_MAX = 100;

export type ChallengeMeterState = ChallengeMeter & { change: number; value: number };

type ChallengeDebrief = {
  good: ChallengeNote[];
  improve: ChallengeNote[];
  practice: ChallengeContent["skills"][number] | null;
  skills: ChallengeContent["skills"];
};

type ChallengeResult = {
  ending: ChallengeEnding;
  isCorrect: boolean;
  score: number;
  steps: ChallengeStep[];
};

function scoreChallengeSteps(steps: readonly ChallengeStep[]): number {
  if (steps.length === 0) {
    return 0;
  }

  const total = steps.reduce((sum, step) => sum + QUALITY_SCORES[step.choice.quality], 0);
  return total / steps.length;
}

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
