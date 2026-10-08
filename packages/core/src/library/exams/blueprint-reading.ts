import { EXAM_BLUEPRINT_PROMPT_VERSION } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint-version";
import { type ExamBlueprint } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

type StoredReading = Pick<ExamBlueprint, "examDate" | "promptVersion">;

/** A stored edition stays current until a day after its exam; one without a date always is. */
export function isCurrentEdition({
  blueprint,
  now,
}: {
  blueprint: Pick<ExamBlueprint, "examDate">;
  now: Date;
}): boolean {
  return !blueprint.examDate || blueprint.examDate.getTime() + MS_PER_DAY > now.getTime();
}

/**
 * Whether research reads a stored notice again for a new goal: its edition is still ahead, but
 * older reading instructions read it. What newer instructions read (the notice's groups of
 * subjects, short names, every numbered topic) then reaches the next learner instead of waiting
 * for the next edition, and that goal's plan is built from the new reading.
 */
export function isNoticeReadAgain({
  blueprint,
  now,
}: {
  blueprint: StoredReading;
  now: Date;
}): boolean {
  return (
    isCurrentEdition({ blueprint, now }) &&
    blueprint.promptVersion !== EXAM_BLUEPRINT_PROMPT_VERSION
  );
}
