import { type ExamBlueprint } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

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
