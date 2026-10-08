import { interleave } from "@zoonk/utils/interleave";

/**
 * Phase checkpoints (the Trickster boss): about ten mixed questions from the whole phase in the exam's
 * format, with no hints, favoring classic traps. Seven of ten wins. Losing costs nothing: two short
 * reinforcement lessons and a rematch the next day, and the next phase is never locked. A final
 * boss closes the plan. Weekly challenges use the same questions and pass mark rules.
 */
export const CHECKPOINT_QUESTIONS = 10;

/** Fewer questions than this can't fairly judge a phase, so the boss waits for more items. */
export const MIN_CHECKPOINT_QUESTIONS = 5;

/** Seven of ten: most of the phase, not perfection. Admin stats count passes with it too. */
export const PASS_SHARE = 0.7;

/** Reinforcement before a rematch: two short lessons on the skills the duel missed most. */
export const REINFORCEMENT_LESSONS = 2;

/** A duel of ten questions takes about fifteen minutes, like any exam-format practice. */
export const CHECKPOINT_MINUTES_PER_QUESTION = 1.5;

export function getPassMark(questions: number): number {
  return Math.ceil(questions * PASS_SHARE);
}

export function hasPassedCheckpoint({
  correct,
  passMark,
}: {
  correct: number;
  passMark: number;
}): boolean {
  return correct >= passMark;
}

export type CheckpointItemCandidate = {
  hasMisconceptions: boolean;
  id: string;
  seen: boolean;
  skillId: string;
};

/** Classic traps first (wrong options with a misconception), then questions never seen. */
function rankCandidate(candidate: CheckpointItemCandidate): number {
  const trapRank = candidate.hasMisconceptions ? 0 : 2;
  const seenRank = candidate.seen ? 1 : 0;

  return trapRank + seenRank;
}

/**
 * Picks a checkpoint's questions: mixed across the phase's skills, one skill after another in
 * turn, and within each skill the trap questions the learner hasn't seen first.
 */
export function selectCheckpointItems({
  candidates,
  skillIds,
}: {
  candidates: readonly CheckpointItemCandidate[];
  skillIds: readonly string[];
}): string[] {
  const perSkill = skillIds.map((skillId) =>
    candidates
      .filter((candidate) => candidate.skillId === skillId)
      .toSorted((a, b) => rankCandidate(a) - rankCandidate(b)),
  );

  return interleave(perSkill)
    .slice(0, CHECKPOINT_QUESTIONS)
    .map((candidate) => candidate.id);
}

/** The skills a lost duel missed, the most missed first, for the reinforcement lessons. */
export function getMissedSkills(
  answers: readonly { isCorrect: boolean; skillId: string | null }[],
): string[] {
  const misses = answers.flatMap((answer) =>
    !answer.isCorrect && answer.skillId ? [answer.skillId] : [],
  );

  return [...new Set(misses)]
    .map((skillId) => ({ count: misses.filter((miss) => miss === skillId).length, skillId }))
    .toSorted((a, b) => b.count - a.count)
    .map((entry) => entry.skillId);
}
