/**
 * Zoonk asks for birth month and year only: the least data that tells who is under 13 (no account),
 * under 18 (protective defaults and the guardian link) or an adult.
 */
export type AgeGroup = "child" | "teen" | "adult" | "unknown";

type BirthMonthYear = { birthMonth: number; birthYear: number };

const MINIMUM_ACCOUNT_AGE = 13;
const ADULT_AGE = 18;

const FIRST_MONTH = 1;
const LAST_MONTH = 12;

/** Nobody alive was born earlier, so older years are typos rather than real answers. */
const MAX_AGE_YEARS = 120;

/** Months are compared in UTC so the same answer gives the same age on every server. */
function getCurrentMonthYear(now: Date) {
  return { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
}

/** Accepts a real calendar month that isn't in the future and isn't older than any living person. */
export function isValidBirthMonthYear({
  birthMonth,
  birthYear,
  now = new Date(),
}: BirthMonthYear & { now?: Date }): boolean {
  const current = getCurrentMonthYear(now);

  if (!Number.isInteger(birthMonth) || !Number.isInteger(birthYear)) {
    return false;
  }

  if (birthMonth < FIRST_MONTH || birthMonth > LAST_MONTH) {
    return false;
  }

  if (birthYear < current.year - MAX_AGE_YEARS) {
    return false;
  }

  return birthYear < current.year || (birthYear === current.year && birthMonth <= current.month);
}

/**
 * Without the day, someone in their birth month may or may not have had their birthday yet. The
 * lower age is used, so a learner is never treated as older than they might be.
 */
function getAgeInYears({
  birthMonth,
  birthYear,
  now = new Date(),
}: BirthMonthYear & { now?: Date }): number {
  const current = getCurrentMonthYear(now);
  const birthdayMayNotHavePassed = current.month <= birthMonth;

  return current.year - birthYear - (birthdayMayNotHavePassed ? 1 : 0);
}

/** Months since year zero, so two answers compare as one number. */
function toMonthIndex({ birthMonth, birthYear }: BirthMonthYear): number {
  return birthYear * LAST_MONTH + birthMonth;
}

/**
 * Whether a new age answer is the same as the saved one or makes the learner younger. Learners
 * correct their own answer only this way, since a younger answer can only add protections. An
 * answer that makes them older could lift a minor's protections, so it goes through support:
 * self-declaration is only as good as the age screen it can't be retried on (ICO age assurance
 * opinion; FTC COPPA FAQ H.3), and when signals disagree the more protective one wins (Decreto
 * 12.880/2026 art. 25 §4).
 */
export function isSameOrYoungerBirth({
  next,
  saved,
}: {
  next: BirthMonthYear;
  saved: BirthMonthYear;
}): boolean {
  return toMonthIndex(next) >= toMonthIndex(saved);
}

/** Groups a learner by the age rules that apply to them; missing answers stay `unknown`. */
export function getAgeGroup({
  birthMonth,
  birthYear,
  now = new Date(),
}: {
  birthMonth: number | null;
  birthYear: number | null;
  now?: Date;
}): AgeGroup {
  if (birthMonth === null || birthYear === null) {
    return "unknown";
  }

  const age = getAgeInYears({ birthMonth, birthYear, now });

  if (age < MINIMUM_ACCOUNT_AGE) {
    return "child";
  }

  return age < ADULT_AGE ? "teen" : "adult";
}
