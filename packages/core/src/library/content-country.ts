import { getLanguageCountry } from "@zoonk/utils/countries";

export function getContentCountryScope({
  country,
  language,
}: {
  country?: string | null;
  language: string;
}): string | null {
  return !country || country === getLanguageCountry(language) ? null : country;
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
