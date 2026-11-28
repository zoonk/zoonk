import { type OptionSelect } from "@zoonk/ai/tasks/items/schemas";
import { type Goal } from "@zoonk/db";
import { type NoticeFormats } from "./notice-formats";
import { readGoalExamFormats } from "./short-answers";

/**
 * How many options practice may ask a learner to pick: always one, plus each larger pick ("select
 * all that apply", "choose two") the learner's exam asks, so its practice feels like the exam.
 * Anywhere else, judging every option of a long list makes the screen the work instead of the skill.
 */
export function getPracticePicks({
  goal,
  structure,
}: {
  goal: Pick<Goal, "details" | "kind"> | null;
  structure: NoticeFormats | null;
}): OptionSelect[] {
  const formats = (goal ? readGoalExamFormats({ goal, structure }) : structure)?.formats ?? [];

  const examPicks = formats.flatMap((format) =>
    format.kind === "multipleChoice" && format.select && format.select !== 1 ? [format.select] : [],
  );

  return [...new Set<OptionSelect>([1, ...examPicks])];
}
