import {
  type ProductReading,
  type ProductReleaseClaim,
} from "@zoonk/ai/tasks/research/read-product-pages";
import { findNamesInDocument, isPassageExactlyInDocument } from "../exams/passage-check";

/** A page's language names its months ("21 de outubro de 2025"). */
export type ReadProductPage = { language: string; text: string };

export type CheckedProductRelease = {
  name: string;
  version: string | null;
  releasedAt: Date | null;
  supportEndsAt: Date | null;
  document: number;
  passage: string;
};

export type CheckedProductReading = {
  brand: ProductReading["brand"];
  product: ProductReading["product"];
  releases: CheckedProductRelease[];
  learnerRelease: string | null;
};

/** "October 21st, 2025" and "21 de outubro de 2025" fit; dates further apart are two facts. */
const DATE_SPAN = 6;
const MIN_MONTH_PREFIX = 3;
const MONTHS = 12;
/** Any year: only the month names are read. */
const NAMING_YEAR = 2000;
const ISO_DATE = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u;
const TOKEN = /\p{L}+|\p{N}+/gu;
const SHORT_NUMBER = /^\d{1,2}$/u;

function toTokens(text: string): string[] {
  return text.normalize("NFKC").toLowerCase().match(TOKEN) ?? [];
}

function listMonthNames(language: string): string[] {
  const format = new Intl.DateTimeFormat(language, { month: "long", timeZone: "UTC" });

  return Array.from({ length: MONTHS }, (_, index) =>
    format
      .format(new Date(Date.UTC(NAMING_YEAR, index, 1)))
      .normalize("NFKC")
      .toLowerCase(),
  );
}

/** A month's long name, or an abbreviation no other month's name starts with ("oct", "sept"). */
function isMonthName({ month, names, token }: { month: number; names: string[]; token: string }) {
  if (token.length < MIN_MONTH_PREFIX) {
    return false;
  }

  const matches = names.flatMap((name, index) => (name.startsWith(token) ? [index + 1] : []));
  return matches.length === 1 && matches[0] === month;
}

function isShortNumber({ token, value }: { token: string; value: number }): boolean {
  return SHORT_NUMBER.test(token) && Number(token) === value;
}

type DateRole = { day: boolean; monthName: boolean; monthNumber: boolean; year: boolean };

type DateParts = { day: number; month: number };

/**
 * A month named in words reads in any order. In numbers, "05/10/2025" is May or October depending
 * on the page's country, so only a year-first date or a day above 12 says which number is the day.
 */
function isReadable({
  date,
  indexes,
  roles,
}: {
  date: DateParts;
  indexes: { day: number; month: number; year: number };
  roles: DateRole[];
}): boolean {
  const { day, month, year } = indexes;

  return (
    roles[month]?.monthName === true ||
    (year < month && month < day) ||
    date.day > MONTHS ||
    date.day === date.month
  );
}

function hasWholeDate({ date, roles }: { date: DateParts; roles: DateRole[] }): boolean {
  const indexes = roles.map((_, index) => index);

  return indexes.some(
    (year) =>
      roles[year]?.year &&
      indexes.some(
        (month) =>
          month !== year &&
          (roles[month]?.monthName || roles[month]?.monthNumber) &&
          indexes.some(
            (day) =>
              day !== year &&
              day !== month &&
              roles[day]?.day &&
              isReadable({ date, indexes: { day, month, year }, roles }),
          ),
      ),
  );
}

/**
 * The passage states the date's year, month and day close together, the month as a number or a
 * name in `language`, so a passage stating another day or month never confirms it.
 */
export function isDateStated({
  date,
  language,
  passage,
}: {
  date: Date;
  language: string;
  passage: string;
}): boolean {
  const year = String(date.getUTCFullYear());
  const parts = { day: date.getUTCDate(), month: date.getUTCMonth() + 1 };
  const names = listMonthNames(language);

  const roles = toTokens(passage).map((token) => ({
    day: isShortNumber({ token, value: parts.day }),
    monthName: isMonthName({ month: parts.month, names, token }),
    monthNumber: isShortNumber({ token, value: parts.month }),
    year: token === year,
  }));

  return roles.some((_, start) =>
    hasWholeDate({ date: parts, roles: roles.slice(start, start + DATE_SPAN) }),
  );
}

function parseIsoDate(value: string | null): Date | null {
  const groups = value?.match(ISO_DATE)?.groups;

  if (!groups) {
    return null;
  }

  const date = new Date(
    Date.UTC(Number(groups.year), Number(groups.month) - 1, Number(groups.day)),
  );

  return date.toISOString().startsWith(value ?? "") ? date : null;
}

function toStatedDate({
  language,
  passage,
  value,
}: {
  language: string;
  passage: string;
  value: string | null;
}): Date | null {
  const date = parseIsoDate(value);
  return date && isDateStated({ date, language, passage }) ? date : null;
}

/** The cited page holds the passage word for word, and the passage names what the claim names. */
function isClaimStated({
  claim,
  name,
  pages,
}: {
  claim: { document: number; passage: string };
  name: string;
  pages: readonly ReadProductPage[];
}): boolean {
  const page = pages[claim.document - 1];

  return (
    page !== undefined &&
    isPassageExactlyInDocument({ passage: claim.passage, text: page.text }) &&
    findNamesInDocument({ names: [name], text: claim.passage }).size > 0
  );
}

function checkRelease({
  pages,
  release,
}: {
  pages: readonly ReadProductPage[];
  release: ProductReleaseClaim;
}): CheckedProductRelease | null {
  const page = pages[release.document - 1];

  if (!page || !isClaimStated({ claim: release, name: release.name, pages })) {
    return null;
  }

  const dated = { language: page.language, passage: release.passage };

  return {
    document: release.document,
    name: release.name,
    passage: release.passage,
    releasedAt: toStatedDate({ ...dated, value: release.releasedOn }),
    supportEndsAt: toStatedDate({ ...dated, value: release.supportEndsOn }),
    version: release.version,
  };
}

function checkProduct({
  pages,
  product,
}: {
  pages: readonly ReadProductPage[];
  product: ProductReading["product"];
}): ProductReading["product"] {
  if (!product || !isClaimStated({ claim: product, name: product.name, pages })) {
    return null;
  }

  const found = findNamesInDocument({
    names: product.aliases,
    text: pages.map((page) => page.text).join("\n"),
  });

  return { ...product, aliases: product.aliases.filter((alias) => found.has(alias)) };
}

/**
 * Keeps only what the fetched pages state: model output is a claim until its passage is found.
 * A release keeps its dates only when its own passage states them whole.
 */
export function checkProductReading({
  pages,
  reading,
}: {
  pages: readonly ReadProductPage[];
  reading: ProductReading;
}): CheckedProductReading {
  const { brand } = reading;
  const releases = reading.releases.flatMap((release) => checkRelease({ pages, release }) ?? []);

  return {
    brand:
      brand && !brand.steward && isClaimStated({ claim: brand, name: brand.name, pages })
        ? brand
        : null,
    learnerRelease: releases.some((release) => release.name === reading.learnerRelease)
      ? reading.learnerRelease
      : null,
    product: checkProduct({ pages, product: reading.product }),
    releases,
  };
}
