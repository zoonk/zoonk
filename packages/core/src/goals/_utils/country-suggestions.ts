import "server-only";
import { prisma } from "@zoonk/db";
import { getLanguageCountry, isCountryCode } from "@zoonk/utils/countries";
import { isJsonObject } from "@zoonk/utils/json";
import { getRegionChoices } from "@zoonk/utils/language-regions";
import { MAX_SUGGESTED_COUNTRIES, type SuggestedCountry } from "../country-contract";
import { getLessonVariety, toCountryChoice } from "./content-country-view";

const MAX_RECENT_COUNTRIES = 3;

export async function loadRecentCountries(userId: string) {
  return prisma.goal.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      contentCountry: true,
      details: true,
      examBlueprint: { select: { country: true } },
      id: true,
      kind: true,
      language: true,
    },
    where: { userId },
  });
}

export type RecentCountries = Awaited<ReturnType<typeof loadRecentCountries>>;

function recentCountry(goal: RecentCountries[number]): string | null {
  if (goal.examBlueprint?.country || goal.contentCountry) {
    return goal.examBlueprint?.country ?? goal.contentCountry;
  }

  const details = isJsonObject(goal.details) ? goal.details : {};
  const answered = Array.isArray(details.answered) && details.answered.includes("contentCountry");

  return goal.kind === "learn" &&
    details.countryDependent === true &&
    (answered || details.contentCountrySource === "picked")
    ? getLanguageCountry(goal.language)
    : null;
}

export function getCountrySuggestions({
  goalId,
  homeCountry,
  language,
  recent,
}: {
  goalId?: string;
  homeCountry: string | null;
  language: string;
  recent: RecentCountries;
}): SuggestedCountry[] {
  const earlier = [
    ...new Set(
      recent
        .filter((goal) => goal.id !== goalId)
        .map((goal) => recentCountry(goal))
        .filter((code): code is string => code !== null && isCountryCode(code)),
    ),
  ].slice(0, MAX_RECENT_COUNTRIES);

  const own = getLanguageCountry(language);
  const regions = getRegionChoices({ language, userLanguage: language });

  const codes = [
    ...new Set([
      ...earlier,
      ...(homeCountry ? [homeCountry] : []),
      ...(own ? [own] : []),
      ...regions.map((choice) => choice.code),
    ]),
  ].slice(0, MAX_SUGGESTED_COUNTRIES);

  return codes.flatMap((code) => {
    const choice = toCountryChoice({ code, language });

    return choice
      ? [
          {
            ...choice,
            lessonVariety: getLessonVariety({ code, language }),
            tag: choice.code === homeCountry ? ("home" as const) : null,
          },
        ]
      : [];
  });
}
