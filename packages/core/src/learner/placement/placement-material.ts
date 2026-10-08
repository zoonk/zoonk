import { type ExamBlueprint } from "@zoonk/db";

/**
 * A test read from the learner's own material (a private blueprint): every topic of the material
 * is on it, so placement settles only the topics its answers checked (see `answeredOnly`).
 */
export function isOwnMaterialTest(blueprint: Pick<ExamBlueprint, "ownerId"> | null): boolean {
  return Boolean(blueprint?.ownerId);
}
