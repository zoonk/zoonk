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

type NameSpan = { end: number; key: string; start: number };

/** Punctuation ends a word ("Comet Phone:2.0"), except a dot inside a number ("2.0", "12.1.2410"). */
const NAME_WORD = /[\p{L}\p{M}\p{N}]+(?:\.\p{N}+)*/gu;

/** Word runs whose key is no longer than `maxLength`: a word added to a run never shortens its key. */
function listNameSpans({ maxLength, text }: { maxLength: number; text: string }): NameSpan[] {
  const words = text.match(NAME_WORD) ?? [];
  const spans: NameSpan[] = [];

  for (const [start] of words.entries()) {
    for (let end = start + 1; end <= words.length; end += 1) {
      const key = toNameKey(words.slice(start, end).join(" "));

      if (key.length > maxLength) {
        break;
      }

      spans.push({ end, key, start });
    }
  }

  return spans;
}

/**
 * The text names a product by one of `keys` in whole words, unless those words lie inside a name of
 * `own`: the longest name at a place wins ("Orbit Server" never names a sibling called "Orbit", and
 * "Orbit Notes Studio" names it, not a product called "Orbit Notes").
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
  const [wanted, ownKeys] = [new Set(keys), new Set(own.map((name) => toNameKey(name)))];
  const maxLength = Math.max(0, ...[...wanted, ...ownKeys].map((key) => key.length));
  const spans = listNameSpans({ maxLength, text });
  const owned = spans.filter((span) => ownKeys.has(span.key));

  return spans.some(
    (span) =>
      span.key !== "" &&
      wanted.has(span.key) &&
      !owned.some((ownSpan) => ownSpan.start <= span.start && span.end <= ownSpan.end),
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
