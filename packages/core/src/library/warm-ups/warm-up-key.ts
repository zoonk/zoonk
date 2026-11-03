import { type GoalKind } from "@zoonk/db";
import { buildSkillIdentityKey, normalizeIdentityText } from "@zoonk/utils/identity-key";
import { type CurriculumScope } from "../curriculum/curriculum-scope";

export function getWarmUpKey({
  generalGoal,
  kind,
  ownerId,
  targetLanguage,
}: Pick<CurriculumScope, "generalGoal" | "ownerId" | "targetLanguage"> & { kind: GoalKind }):
  | string
  | null {
  if (ownerId || !generalGoal || !normalizeIdentityText(generalGoal) || kind === "explain") {
    return null;
  }

  return `${kind}:${buildSkillIdentityKey({ name: generalGoal, targetLanguage })}`;
}
