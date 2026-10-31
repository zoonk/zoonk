import { type Goal } from "@zoonk/db";
import { type ExamStructure } from "./blueprint-contract";
import { type NoticeFormats, readNoticeFormats } from "./notice-formats";

export function readGoalExamFormats({
  goal,
  structure,
}: {
  goal: Pick<Goal, "details" | "kind">;
  structure: NoticeFormats | null;
}): NoticeFormats | null {
  return structure ?? (goal.kind === "exam" ? readNoticeFormats(goal.details) : null);
}

/** Essays do not enable short typed questions; use the separate written-practice flow for them. */
export function asksShortAnswers(formats: Pick<ExamStructure, "formats"> | null): boolean {
  return formats?.formats.some((format) => format.kind === "shortAnswer") ?? false;
}

export function practicesShortAnswers({
  goal,
  structure,
}: {
  goal: Pick<Goal, "details" | "kind" | "targetLanguage">;
  structure: NoticeFormats | null;
}): boolean {
  return goal.targetLanguage !== null || asksShortAnswers(readGoalExamFormats({ goal, structure }));
}
