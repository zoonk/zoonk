import { type Goal } from "@zoonk/db";
import { type ExamStructure } from "./blueprint-contract";
import { type NoticeFormats, readNoticeFormats } from "./notice-formats";

/**
 * The formats a goal knows its exam asks: its blueprint's (`structure`) once linked, else the ones
 * a first pass over an exam goal's notice read (`readNoticeFormats`); null for other goals.
 */
export function readGoalExamFormats({
  goal,
  structure,
}: {
  goal: Pick<Goal, "details" | "kind">;
  structure: NoticeFormats | null;
}): NoticeFormats | null {
  return structure ?? (goal.kind === "exam" ? readNoticeFormats(goal.details) : null);
}

/**
 * Whether an exam asks short written answers (`shortAnswer`): a word, a value, a sentence, or a
 * blank or a table to fill in, as a public notice or a class test's material announces them.
 * Learners would rather pick than think up and type an answer, so typed questions are a last
 * resort, only where the exam asks them. Its essays and discursive questions have their own
 * written practice (`pickFreeResponseSkills`) and open nothing else: an exam of choices and an
 * essay (ENEM's redação), a hobby and a career ask only what learners pick everywhere else.
 */
export function asksShortAnswers(formats: Pick<ExamStructure, "formats"> | null): boolean {
  return formats?.formats.some((format) => format.kind === "shortAnswer") ?? false;
}

/**
 * Whether practice asks a goal's learner short typed answers: a language goal's own writing
 * practice, or a goal whose exam asks short written answers (`asksShortAnswers`).
 */
export function practicesShortAnswers({
  goal,
  structure,
}: {
  goal: Pick<Goal, "details" | "kind" | "targetLanguage">;
  /** The goal's blueprint's structure once linked (see `readGoalExamFormats`). */
  structure: NoticeFormats | null;
}): boolean {
  return goal.targetLanguage !== null || asksShortAnswers(readGoalExamFormats({ goal, structure }));
}
