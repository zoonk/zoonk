import { type ExamBlueprint } from "@zoonk/db";
import { isEnemExam } from "../scoring/exam-scales";

const OAB_PATTERN = /\boab\b/iu;

export function getNamedEssayRubric(
  blueprint: Pick<ExamBlueprint, "identityKey" | "name"> | null,
): "enem" | "oab" | null {
  if (isEnemExam({ blueprint, goal: null })) {
    return "enem";
  }

  const names = blueprint ? `${blueprint.identityKey} ${blueprint.name}` : "";
  return OAB_PATTERN.test(names) ? "oab" : null;
}
