import {
  type ProductReading,
  type ProductReleaseClaim,
} from "@zoonk/ai/tasks/research/read-product-pages";
import { findNamesInDocument, isPassageExactlyInDocument } from "../exams/passage-check";
import { hasVersionToken, isDateStated, isMonthStated, isVersionStated } from "./release-claims";

/** A page's language names its months ("21 de outubro de 2025"). */
export type ReadProductPage = { language: string; text: string };

type CheckedProductRelease = {
  name: string;
  version: string | null;
  releasedAt: Date | null;
  /** The pages state only its month: `releasedAt` is that month's first day. */
  releasedMonthOnly: boolean;
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

/** "2025-10-21", or "2025-10" for a date the pages give only by month. */
const ISO_DATE = /^(?<year>\d{4})-(?<month>\d{2})(?:-(?<day>\d{2}))?$/u;

/** The date a claim gives, with its day only when it gives one; null for an invalid date. */
function parseIsoDate(value: string | null): { date: Date; hasDay: boolean } | null {
  const groups = value?.match(ISO_DATE)?.groups;

  if (!groups) {
    return null;
  }

  const date = new Date(
    Date.UTC(Number(groups.year), Number(groups.month) - 1, Number(groups.day ?? 1)),
  );

  return date.toISOString().startsWith(value ?? "")
    ? { date, hasDay: groups.day !== undefined }
    : null;
}

type StatedDate = { language: string; passage: string; value: string | null };

function toStatedDate({ language, passage, value }: StatedDate): Date | null {
  const parsed = parseIsoDate(value);

  return parsed?.hasDay && isDateStated({ date: parsed.date, language, passage })
    ? parsed.date
    : null;
}

/** The whole date when the passage states it, else its month when the passage states that. */
function toReleaseDate(stated: StatedDate): {
  releasedAt: Date | null;
  releasedMonthOnly: boolean;
} {
  const day = toStatedDate(stated);
  const parsed = parseIsoDate(stated.value);

  if (day || !parsed) {
    return { releasedAt: day, releasedMonthOnly: false };
  }

  const month = new Date(Date.UTC(parsed.date.getUTCFullYear(), parsed.date.getUTCMonth(), 1));

  const isStated = isMonthStated({
    date: month,
    language: stated.language,
    passage: stated.passage,
  });

  return { releasedAt: isStated ? month : null, releasedMonthOnly: isStated };
}

function isQuoted({
  claim,
  pages,
}: {
  claim: { document: number; passage: string };
  pages: readonly ReadProductPage[];
}): boolean {
  const page = pages[claim.document - 1];

  return (
    page !== undefined && isPassageExactlyInDocument({ passage: claim.passage, text: page.text })
  );
}

function isNamed({ name, passage }: { name: string; passage: string }): boolean {
  return findNamesInDocument({ names: [name], text: passage }).size > 0;
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
  return isQuoted({ claim, pages }) && isNamed({ name, passage: claim.passage });
}

/**
 * A release keeps its version only when its name and passage state it, so a year in its date never
 * passes for one. A row naming no product counts by its version alone when the release's name names
 * the product and the version opens its line or sits beside the product's name (`isVersionStated`),
 * so another product's row can't pass.
 */
function checkRelease({
  pages,
  productNames,
  release,
}: {
  pages: readonly ReadProductPage[];
  productNames: readonly string[];
  release: ProductReleaseClaim;
}): CheckedProductRelease | null {
  const page = pages[release.document - 1];

  const isVersionOfProduct =
    isVersionStated({ ...release, productNames }) &&
    findNamesInDocument({ names: productNames, text: release.name }).size > 0;

  if (
    !page ||
    !isQuoted({ claim: release, pages }) ||
    !(isNamed({ name: release.name, passage: release.passage }) || isVersionOfProduct)
  ) {
    return null;
  }

  const dated = { language: page.language, passage: release.passage };
  const { version } = release;

  return {
    document: release.document,
    name: release.name,
    passage: release.passage,
    ...toReleaseDate({ ...dated, value: release.releasedOn }),
    supportEndsAt: toStatedDate({ ...dated, value: release.supportEndsOn }),
    version:
      version && [release.name, release.passage].every((text) => hasVersionToken({ text, version }))
        ? version
        : null,
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
  productName,
  reading,
}: {
  pages: readonly ReadProductPage[];
  /** A known product's stored name, which its releases name when the reading has no product. */
  productName: string;
  reading: ProductReading;
}): CheckedProductReading {
  const { brand } = reading;
  const product = checkProduct({ pages, product: reading.product });
  const productNames = product ? [product.name, ...product.aliases] : [productName];

  const releases = reading.releases.flatMap(
    (release) => checkRelease({ pages, productNames, release }) ?? [],
  );

  return {
    brand:
      brand && !brand.steward && isClaimStated({ claim: brand, name: brand.name, pages })
        ? brand
        : null,
    learnerRelease: releases.some((release) => release.name === reading.learnerRelease)
      ? reading.learnerRelease
      : null,
    product,
    releases,
  };
}
