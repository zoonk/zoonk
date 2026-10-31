/**
 * Ages from the Terms: an account needs 13 (14 in Italy and Korea), and a learner is an adult at 18
 * (19 in Korea). Zoonk keeps the birth year only, never the date.
 */
const MINIMUM_AGE = 13;
const ADULT_AGE = 18;

const MINIMUM_AGE_BY_COUNTRY: Record<string, number> = { IT: 14, KR: 14 };
const ADULT_AGE_BY_COUNTRY: Record<string, number> = { KR: 19 };

/** Without a country, as in a background job, the oldest adult age anywhere applies. */
const STRICTEST_ADULT_AGE = Math.max(ADULT_AGE, ...Object.values(ADULT_AGE_BY_COUNTRY));

/** Older years are typos, not real answers. */
const MAX_AGE_YEARS = 120;

export function getMinimumAge(country: string): number {
  return MINIMUM_AGE_BY_COUNTRY[country.toUpperCase()] ?? MINIMUM_AGE;
}

function getAdultAge(country: string | null): number {
  return country ? (ADULT_AGE_BY_COUNTRY[country.toUpperCase()] ?? ADULT_AGE) : STRICTEST_ADULT_AGE;
}

/** This year's birthday may not have come yet, so a learner is never taken for older than they might be. */
function getYoungestAge({ birthYear, now }: { birthYear: number; now: Date }): number {
  return now.getUTCFullYear() - birthYear - 1;
}

export function isValidBirthYear({ birthYear, now }: { birthYear: number; now: Date }): boolean {
  const year = now.getUTCFullYear();
  return Number.isInteger(birthYear) && birthYear <= year && birthYear >= year - MAX_AGE_YEARS;
}

export function isBelowMinimumAge({
  birthYear,
  country,
  now,
}: {
  birthYear: number;
  country: string;
  now: Date;
}): boolean {
  return getYoungestAge({ birthYear, now }) < getMinimumAge(country);
}

/** An unknown birth year is never an adult's. */
export function isAdult({
  birthYear,
  country,
  now,
}: {
  birthYear: number | null;
  country: string | null;
  now: Date;
}): boolean {
  return birthYear !== null && getYoungestAge({ birthYear, now }) >= getAdultAge(country);
}
