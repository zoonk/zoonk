"use client";

import { useExtracted, useFormatter } from "next-intl";
import { toTopicWords } from "../syllabus/topic-number";

const NAMED = 3;

/** Topics drop the notice's numbering ("12 Noções…" read as a count), and a lesson list counts the rest without a unit, since a name can stand for many unwritten lessons. */
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

export function useExamples() {
  const format = useFormatter();

  return (names: readonly string[]): string =>
    format.list(names.slice(0, NAMED), { type: "conjunction" });
}
