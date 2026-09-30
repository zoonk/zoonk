import { type CefrLevel } from "@zoonk/utils/cefr";
import { getPassMark, hasPassedCheckpoint } from "../../checkpoints/checkpoint-rules";
import { EMPTY_OUTCOME, getOutcomeBonus } from "../../sessions/brain-power";

/**
 * A unit's conversation is short at first and grows with the learner: a minute at A1 and A2, two
 * at B1 and B2, three at C1 and four at C2.
 */
const CHECKPOINT_MINUTES: Readonly<Record<CefrLevel, number>> = {
  A1: 1,
  A2: 1,
  B1: 2,
  B2: 2,
  C1: 3,
  C2: 4,
};

/** A unit's call in today's session: up to four minutes of talk, the intro and the feedback. */
export const CHECKPOINT_CALL_BLOCK_MINUTES = 6;

/** A speaking mock: IELTS's three parts or TOEFL's two tasks, shortened to about five minutes. */
export const SPEAKING_MOCK_MINUTES = 5;

/** Each goal of the call met earns what finishing a lesson does. */
const POINTS_PER_OBJECTIVE = 10;

export function getCheckpointMinutes(level: CefrLevel): number {
  return CHECKPOINT_MINUTES[level];
}

/**
 * A checkpoint call is won like any checkpoint: most of what the call asked for (seven in ten,
 * rounded up), since getting the point across matters, not every word.
 */
export function hasPassedConversation({
  objectives,
  objectivesMet,
}: {
  objectives: number;
  objectivesMet: number;
}): boolean {
  return (
    objectives > 0 &&
    hasPassedCheckpoint({ correct: objectivesMet, passMark: getPassMark(objectives) })
  );
}

/**
 * Three stars in Fun: one for finishing the call, one for every objective, one for doing it
 * without Help. Nothing is random, and Focus shows the same facts as a list.
 */
export function getConversationStars({
  objectives,
  objectivesMet,
  usedHelp,
}: {
  objectives: number;
  objectivesMet: number;
  usedHelp: boolean;
}): number {
  const allMet = objectives > 0 && objectivesMet >= objectives;
  return 1 + (allMet ? 1 : 0) + (usedHelp ? 0 : 1);
}

/** The scenario's objectives among the labels, once each and in the scenario's order. */
export function getMetObjectives({
  labels,
  objectives,
}: {
  labels: readonly string[];
  objectives: readonly { label: string }[];
}): string[] {
  const met = new Set(labels);

  return objectives.map((objective) => objective.label).filter((label) => met.has(label));
}

/**
 * Brain Power for a finished call: each objective met, plus the boss bonus when a checkpoint call
 * is won. Losing a checkpoint call costs nothing.
 */
export function getConversationBrainPower({
  checkpoint,
  objectivesMet,
}: {
  checkpoint: { kind: "boss" | "finalBoss"; passed: boolean } | null;
  objectivesMet: number;
}): number {
  return objectivesMet * POINTS_PER_OBJECTIVE + getOutcomeBonus({ ...EMPTY_OUTCOME, checkpoint });
}
