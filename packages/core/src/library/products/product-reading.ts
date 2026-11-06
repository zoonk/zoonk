import {
  type ProductReading,
  type ProductReleaseClaim,
} from "@zoonk/ai/tasks/research/read-product-pages";
import { findNamesInDocument, isPassageExactlyInDocument } from "../exams/passage-check";
import { isDateStated, isVersionStated } from "./release-claims";

/** A page's language names its months ("21 de outubro de 2025"). */
export type ReadProductPage = { language: string; text: string };

type CheckedProductRelease = {
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

const ISO_DATE = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u;

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

function checkRelease({
  pages,
  release,
}: {
  pages: readonly ReadProductPage[];
  release: ProductReleaseClaim;
}): CheckedProductRelease | null {
  const page = pages[release.document - 1];

  if (
    !page ||
    !isQuoted({ claim: release, pages }) ||
    !(isNamed({ name: release.name, passage: release.passage }) || isVersionStated(release))
  ) {
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
