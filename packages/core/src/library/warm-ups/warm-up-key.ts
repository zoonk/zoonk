import { type GoalKind } from "@zoonk/db";
import { buildSkillIdentityKey, normalizeIdentityText } from "@zoonk/utils/identity-key";
import { countryIdentityKey, getContentCountryScope } from "../content-country";
import { type CurriculumScope } from "../curriculum/curriculum-scope";

export function getWarmUpKey({
  country,
  language,
  generalGoal,
  kind,
  ownerId,
  targetLanguage,
}: Pick<CurriculumScope, "country" | "generalGoal" | "ownerId" | "targetLanguage"> & {
  language?: string;
} & { kind: GoalKind }): string | null {
  if (ownerId || !generalGoal || !normalizeIdentityText(generalGoal) || kind === "explain") {
    return null;
  }

  return countryIdentityKey({
    country: getContentCountryScope({ country, language: language ?? "" }),
    key: `${kind}:${buildSkillIdentityKey({ name: generalGoal, targetLanguage })}`,
  });
}
