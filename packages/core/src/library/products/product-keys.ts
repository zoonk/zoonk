import { removeAccents } from "@zoonk/utils/string";
import { getDomain } from "tldts";

const SEPARATORS = /[^\p{L}\p{M}\p{N}]+/gu;
const DIGIT = /^\p{N}$/u;
const VERSION_PREFIX = /^v(?=\p{N})/u;

function isBetweenDigits({ end, start, text }: { end: number; start: number; text: string }) {
  return DIGIT.test(text.charAt(start - 1)) && DIGIT.test(text.charAt(end));
}

/**
 * "Next.js", "next js" and "NextJS" share one key, while a dot or space between digits stays as one
 * dot, so "Python 3.12" and "Python 3.1.2" keep apart.
 */
export function toNameKey(name: string): string {
  const text = removeAccents(name).toLowerCase();

  return text.replaceAll(SEPARATORS, (separator, start: number) =>
    isBetweenDigits({ end: start + separator.length, start, text }) ? "." : "",
  );
}

/** Enough words for a product's name, such as "Microsoft Dynamics 365 Business Central". */
const MAX_NAME_WORDS = 5;

type NameSpan = { end: number; key: string; start: number };

function listNameSpans(text: string): NameSpan[] {
  const words = text.split(/\s+/u).filter(Boolean);

  return words.flatMap((_, start) =>
    Array.from({ length: Math.min(MAX_NAME_WORDS, words.length - start) }, (__, size) => ({
      end: start + size + 1,
      key: toNameKey(words.slice(start, start + size + 1).join(" ")),
      start,
    })),
  );
}

/**
 * The text names a product by one of `keys` in whole words, outside the words that name `own`
 * ("Orbit Server" never names a sibling called "Orbit").
 */
export function namesAnyProduct({
  keys,
  own,
  text,
}: {
  keys: readonly string[];
  own: readonly string[];
  text: string;
}): boolean {
  const spans = listNameSpans(text);
  const [wanted, ownKeys] = [new Set(keys), new Set(own.map((name) => toNameKey(name)))];
  const owned = spans.filter((span) => ownKeys.has(span.key));

  return spans.some(
    (span) =>
      span.key !== "" &&
      wanted.has(span.key) &&
      !owned.some((ownSpan) => ownSpan.start < span.end && span.start < ownSpan.end),
  );
}

/** A product is named by its own name's key or one of its aliases. */
export function whereProductNamed(nameKey: string) {
  return { OR: [{ normalizedName: nameKey }, { aliases: { has: nameKey } }] };
}

/** "v16" and "16" are the same version. */
export function toVersionKey(version: string): string {
  return toNameKey(version).replace(VERSION_PREFIX, "");
}

/**
 * Private suffixes count (github.io, vercel.app), so two sites hosted on one platform are two
 * brands. Null for an IP address, a bare suffix or anything that isn't a host.
 */
export function toRegistrableDomain(hostOrUrl: string): string | null {
  return getDomain(hostOrUrl.trim(), { allowPrivateDomains: true });
}
