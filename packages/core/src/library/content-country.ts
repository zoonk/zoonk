import { getLanguageCountry, isCountryCode } from "@zoonk/utils/countries";

export function getContentCountryScope({
  country,
  language,
}: {
  country?: string | null;
  language: string;
}): string | null {
  return !country || !isCountryCode(country) || country === getLanguageCountry(language)
    ? null
    : country;
}

export function countryIdentityKey({
  country,
  key,
}: {
  country: string | null;
  key: string;
}): string {
  return country ? `${country}:${key}` : key;
}

export function getLessonCountry({
  course,
  skill,
}: {
  course?: { country: string | null } | null;
  skill?: { country: string | null } | null;
}): string | null {
  return course ? course.country : (skill?.country ?? null);
}
