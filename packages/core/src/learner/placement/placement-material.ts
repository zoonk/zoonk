import { type ExamBlueprint } from "@zoonk/db";

export function isOwnMaterialTest(blueprint: Pick<ExamBlueprint, "ownerId"> | null): boolean {
  return Boolean(blueprint?.ownerId);
}
