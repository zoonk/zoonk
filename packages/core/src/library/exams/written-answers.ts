import { type Goal } from "@zoonk/db";
import { type ExamStructure } from "./blueprint-contract";
import { type NoticeFormats, readNoticeFormats } from "./notice-formats";

type ExamFormat = ExamStructure["formats"][number];

/**
 * The formats a candidate answers by writing: an essay or a discursive question in their own
 * words, or a short written answer (a word, a value, a sentence, a blank or a table to fill in).
 */
const WRITTEN_ANSWER_KINDS: ReadonlySet<ExamFormat["kind"]> = new Set(["essay", "shortAnswer"]);

export function isWrittenAnswerFormat(format: Pick<ExamFormat, "kind">): boolean {
  return WRITTEN_ANSWER_KINDS.has(format.kind);
}

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
 * Whether an exam asks written answers (`isWrittenAnswerFormat`): a public exam's discursive
 * questions or short written answers, or a class test whose material announces them. Learners
 * would rather pick than think up and type an answer, so questions answered in writing are a last
 * resort, only for these exams; a hobby, a career and an exam of choices, statements or numbers
 * ask only what learners pick.
 */
export function asksWrittenAnswers(formats: Pick<ExamStructure, "formats"> | null): boolean {
  return formats?.formats.some((format) => isWrittenAnswerFormat(format)) ?? false;
}

/**
 * Whether a goal's learner meets typed questions outside its lessons (placement's confirmation,
 * practice's short written answers): a language goal's own writing practice, or a goal whose exam
 * asks written answers (`asksWrittenAnswers`).
 */
export function allowsTypedQuestions({
  goal,
  structure,
}: {
  goal: Pick<Goal, "details" | "kind" | "targetLanguage">;
  /** The goal's blueprint's structure once linked (see `readGoalExamFormats`). */
  structure: NoticeFormats | null;
}): boolean {
  return (
    goal.targetLanguage !== null || asksWrittenAnswers(readGoalExamFormats({ goal, structure }))
  );
}
