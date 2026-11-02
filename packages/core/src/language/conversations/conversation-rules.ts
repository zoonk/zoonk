import { type CefrLevel } from "@zoonk/utils/cefr";
import { getPassMark, hasPassedCheckpoint } from "../../checkpoints/checkpoint-rules";
import { EMPTY_OUTCOME, getOutcomeBonus } from "../../sessions/brain-power";

const CHECKPOINT_MINUTES: Readonly<Record<CefrLevel, number>> = {
  A1: 1,
  A2: 1,
  B1: 2,
  B2: 2,
  C1: 3,
  C2: 4,
};

export const CHECKPOINT_CALL_BLOCK_MINUTES = 6;

const POINTS_PER_OBJECTIVE = 10;

export function getCheckpointMinutes(level: CefrLevel): number {
  return CHECKPOINT_MINUTES[level];
}

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

export function getConversationBrainPower({
  checkpoint,
  objectivesMet,
}: {
  checkpoint: { kind: "boss" | "finalBoss"; passed: boolean } | null;
  objectivesMet: number;
}): number {
  return objectivesMet * POINTS_PER_OBJECTIVE + getOutcomeBonus({ ...EMPTY_OUTCOME, checkpoint });
}
