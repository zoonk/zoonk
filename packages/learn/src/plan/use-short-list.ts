"use client";

import { useExtracted, useFormatter } from "next-intl";
import { toTopicWords } from "../syllabus/topic-number";

/** At most this many names are said; the rest are counted. */
const NAMED = 3;

/**
 * "Ecology, Heat and 2 more topics": what a change moves, by name, the first few and a count of
 * what they are (`kind`), so a list of lessons never reads as topics. Topics go by their words,
 * without the notice's numbering ("12 Noções…" read as a count). A lesson list counts the rest
 * without a unit: a name can stand for a topic's lessons not written yet, so "and 2 more lessons"
 * could be many more. A card already long names fewer (`named`).
 */
export function useShortList() {
  const t = useExtracted();
  const format = useFormatter();

  return (
    listed: readonly string[],
    kind: "lessons" | "topics",
    { named: limit = NAMED }: { named?: number } = {},
  ): string => {
    const names = kind === "topics" ? listed.map((name) => toTopicWords(name)) : listed;
    const named = names.slice(0, limit);
    const count = names.length - named.length;
    const first = named.join(", ");

    if (count === 0) {
      return format.list(named, { type: "conjunction" });
    }

    return kind === "lessons"
      ? t("{names} and {count, number} more", { count, names: first })
      : t("{names} and {count, plural, one {# more topic} other {# more topics}}", {
          count,
          names: first,
        });
  };
}

/**
 * "Ecology, Heat and Osmosis": a few of the names, as examples of what they stand for, for a count
 * they aren't one per (`useShortList` would add "and 182 more" beside "304 lessons").
 */
export function useExamples() {
  const format = useFormatter();

  return (names: readonly string[]): string =>
    format.list(names.slice(0, NAMED), { type: "conjunction" });
}
