import { type LessonKind } from "@zoonk/db";
import { shuffle } from "@zoonk/utils/shuffle";

const LANGUAGE_SENTENCE_STEP_LIMIT = 6;

/**
 * Reading and listening lessons are generated as reusable sentence banks, but
 * one player run should feel like a short practice session instead of exposing
 * every stored sentence. Keeping the kind check in one helper lets the payload
 * serializer and completion validator agree on which lessons use the sentence
 * bank cap.
 */
export function isLimitedLanguageSentenceLesson(kind: LessonKind): boolean {
  return kind === "reading" || kind === "listening";
}

/**
 * Chooses the steps that one player session should show. The database can keep
 * more generated sentence steps for reuse, while the player receives a shuffled
 * six-step slice for reading and listening lessons only. Other lesson kinds
 * keep their full ordered step list because their steps are authored as one
 * complete lesson flow.
 */
export function getPlayableLessonSteps<Step>({
  lesson,
}: {
  lesson: { kind: LessonKind; steps: readonly Step[] };
}): Step[] {
  if (!isLimitedLanguageSentenceLesson(lesson.kind)) {
    return [...lesson.steps];
  }

  return shuffle(lesson.steps).slice(0, LANGUAGE_SENTENCE_STEP_LIMIT);
}

/**
 * Completion validation still needs a server-side answer count, because the
 * browser only submits answers for the steps it showed. Reading and listening
 * lessons should require the same capped number the serializer can expose,
 * while shorter banks and all other lesson kinds keep their natural required
 * answer count.
 */
export function getExpectedPlayerAnswerCount({
  answerableStepCount,
  lessonKind,
}: {
  answerableStepCount: number;
  lessonKind: LessonKind;
}): number {
  if (!isLimitedLanguageSentenceLesson(lessonKind)) {
    return answerableStepCount;
  }

  return Math.min(answerableStepCount, LANGUAGE_SENTENCE_STEP_LIMIT);
}
