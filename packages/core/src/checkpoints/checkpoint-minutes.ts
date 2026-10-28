import { type GoalKind } from "@zoonk/db";
import { CHECKPOINT_CALL_BLOCK_MINUTES } from "../language/conversations/conversation-rules";
import {
  CHECKPOINT_MINUTES_PER_QUESTION,
  CHECKPOINT_QUESTIONS,
  MIN_CHECKPOINT_QUESTIONS,
  getPlannedQuestions,
} from "./checkpoint-rules";

export function getCheckpointMinutes(questions: number): number {
  return Math.round(questions * CHECKPOINT_MINUTES_PER_QUESTION);
}

export type RecordingSet = { itemIds: string[]; skillIds: string[]; whole: boolean };

export type BossBankFacts = {
  recordingSets: readonly RecordingSet[];
  textCounts: ReadonlyMap<string, number>;
};

export function getBossQuestionSkills({
  listeningSkillIds,
  skillIds,
}: {
  listeningSkillIds: ReadonlySet<string>;
  skillIds: readonly string[];
}): { recordings: boolean; skillIds: string[] } {
  const textSkillIds = skillIds.filter((skillId) => !listeningSkillIds.has(skillId));

  return textSkillIds.length > 0
    ? { recordings: false, skillIds: textSkillIds }
    : { recordings: true, skillIds: [...skillIds] };
}

export function pickWholeRecordingSets(sets: readonly RecordingSet[]): string[] {
  const whole = sets.filter((set) => set.whole);

  const enough = whole.findIndex(
    (_, index) =>
      whole.slice(0, index + 1).flatMap((set) => set.itemIds).length >= MIN_CHECKPOINT_QUESTIONS,
  );

  return enough === -1 ? [] : whole.slice(0, enough + 1).flatMap((set) => set.itemIds);
}

/** Null means no playable boss; text bosses retain their planned size while missing questions are written. */
export function getBossSize({
  facts,
  goalKind,
  listeningSkillIds,
  skillIds,
}: {
  facts: BossBankFacts;
  goalKind: GoalKind;
  listeningSkillIds: ReadonlySet<string>;
  skillIds: readonly string[];
}): { minutes: number; questions: number } | null {
  if (goalKind === "language") {
    return { minutes: CHECKPOINT_CALL_BLOCK_MINUTES, questions: 0 };
  }

  const asked = getBossQuestionSkills({ listeningSkillIds, skillIds });

  if (asked.recordings) {
    const onSkills = new Set(asked.skillIds);

    const questions = pickWholeRecordingSets(
      facts.recordingSets.filter((set) => set.skillIds.some((skillId) => onSkills.has(skillId))),
    ).length;

    return questions < MIN_CHECKPOINT_QUESTIONS
      ? null
      : { minutes: getCheckpointMinutes(questions), questions };
  }

  const available = asked.skillIds.reduce(
    (sum, skillId) => sum + (facts.textCounts.get(skillId) ?? 0),
    0,
  );

  const questions = getPlannedQuestions(Math.min(CHECKPOINT_QUESTIONS, available));

  return { minutes: getCheckpointMinutes(questions), questions };
}
