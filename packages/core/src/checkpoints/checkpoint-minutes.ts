import { type GoalKind } from "@zoonk/db";
import { CHECKPOINT_CALL_BLOCK_MINUTES } from "../language/conversations/conversation-rules";
import {
  CHECKPOINT_MINUTES_PER_QUESTION,
  CHECKPOINT_QUESTIONS,
  MIN_CHECKPOINT_QUESTIONS,
  getPlannedQuestions,
} from "./checkpoint-rules";

/**
 * How long a checkpoint of `questions` runs, the whole minutes its card shows, its session block
 * bills and the plan reserves for it: one clock, rounded once.
 */
export function getCheckpointMinutes(questions: number): number {
  return Math.round(questions * CHECKPOINT_MINUTES_PER_QUESTION);
}

/**
 * A voiced recording a boss can play (see `listRecordingSets`): its questions in the order they're
 * heard, the skills they're on, and whether a duel can ask every one of them.
 */
export type RecordingSet = { itemIds: string[]; skillIds: string[]; whole: boolean };

/**
 * What the question bank holds for a goal's bosses, as the learner meets it: each skill's questions
 * a duel can ask (`textCounts`), and the voiced recordings in the order the learner hears them
 * next (`recordingSets`). What a boss asks follows from these (see `getBossSize`).
 */
export type BossBankFacts = {
  recordingSets: readonly RecordingSet[];
  textCounts: ReadonlyMap<string, number>;
};

/**
 * The skills a boss's questions are on: its phase's skills that text questions can ask, or, for a
 * phase practiced only with recordings (an exam's Listening), every one of them, on recordings.
 */
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

/**
 * The questions of the recordings a boss plays: whole recordings in the order the learner hears
 * them next, each only when the duel can ask every one of its questions, until the duel has
 * enough. Empty while none can make one: the boss waits.
 */
export function pickWholeRecordingSets(sets: readonly RecordingSet[]): string[] {
  const whole = sets.filter((set) => set.whole);

  const enough = whole.findIndex(
    (_, index) =>
      whole.slice(0, index + 1).flatMap((set) => set.itemIds).length >= MIN_CHECKPOINT_QUESTIONS,
  );

  return enough === -1 ? [] : whole.slice(0, enough + 1).flatMap((set) => set.itemIds);
}

/**
 * What a boss asks and how long it runs, as its session plays it: a language goal's live call; a
 * phase's text questions, ten at most and its full ten while the bank holds too few (they're
 * written when it starts); or a listening phase's whole recordings, as many questions as they
 * hold. Null for a boss that can't be asked yet: a listening phase with too few voiced recordings,
 * or a phase with no skills to ask.
 */
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
