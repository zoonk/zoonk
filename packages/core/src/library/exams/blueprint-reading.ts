import { type ExamBlueprint } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

export function isCurrentEdition({
  blueprint,
  now,
}: {
  blueprint: Pick<ExamBlueprint, "examDate">;
  now: Date;
}): boolean {
  return !blueprint.examDate || blueprint.examDate.getTime() + MS_PER_DAY > now.getTime();
}
