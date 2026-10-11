"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useExamples, useShortList } from "./use-short-list";

type ChangeEffect = PlanChangeView["effect"];

/**
 * The lessons a change leaves out (`removed`), the ones it names, and whether those names are only
 * some of them (see `useLessonsEffectText`).
 */
type Counted = { names: string | null; removed: number; someOf: boolean };

/**
 * The lessons a change adds, and whether that count is an estimate: some of them aren't written
 * yet (`lessonsAddedEstimated`), so it says "about".
 */
type Added = { about: boolean; added: number };

/**
 * The lessons a change adds and leaves out, both when it does both ("Adds 45 lessons and leaves
 * out 21."), with the ones it leaves out whole by name ("Leaves out 3 lessons: Cromatina, Golgi
 * and Lisossomos."), so the card says what the buddy says and nothing leaves the plan unsaid.
 * When the names aren't one per lesson (a topic's lessons not written yet go by its name, and
 * lessons a change only shortens have none), a few of them are examples: "Leaves out 304 lessons,
 * such as A, B and C." Ana read "Leaves out 304 lessons, among them: A, B, C and 182 more", a count
 * of names beside a count of lessons. Lessons not written yet are the plan's estimate: "Adds about
 * 8 lessons." (Pedro's card said 8 for a topic the Library wrote 5 for.)
 */
export function useLessonsEffectText() {
  const t = useExtracted();
  const shortList = useShortList();
  const examples = useExamples();

  /** The lessons it adds and the ones it leaves out, with their names when it has them. */
  const bothText = ({ about, added, names, removed, someOf }: Counted & Added) => {
    if (names && someOf) {
      return about
        ? t(
            "Adds about {added, plural, one {# lesson} other {# lessons}} and leaves out {removed, number}, such as {names}.",
            { added, names, removed },
          )
        : t(
            "Adds {added, plural, one {# lesson} other {# lessons}} and leaves out {removed, number}, such as {names}.",
            { added, names, removed },
          );
    }

    if (names) {
      return about
        ? t(
            "Adds about {added, plural, one {# lesson} other {# lessons}} and leaves out {removed, number}: {names}.",
            { added, names, removed },
          )
        : t(
            "Adds {added, plural, one {# lesson} other {# lessons}} and leaves out {removed, number}: {names}.",
            { added, names, removed },
          );
    }

    return about
      ? t(
          "Adds about {added, plural, one {# lesson} other {# lessons}} and leaves out {removed, number}.",
          { added, removed },
        )
      : t(
          "Adds {added, plural, one {# lesson} other {# lessons}} and leaves out {removed, number}.",
          { added, removed },
        );
  };

  /** The lessons it adds, alone. */
  const addedText = ({ about, added }: Added) =>
    about
      ? t("Adds about {lessons, plural, one {# lesson} other {# lessons}}.", { lessons: added })
      : t("Adds {lessons, plural, one {# lesson} other {# lessons}}.", { lessons: added });

  /** The lessons it leaves out, with their names when it has them. */
  const removedText = ({ names, removed, someOf }: Counted) => {
    if (names && someOf) {
      return t("Leaves out {lessons, plural, one {# lesson} other {# lessons}}, such as {names}.", {
        lessons: removed,
        names,
      });
    }

    return names
      ? t("Leaves out {lessons, plural, one {# lesson} other {# lessons}}: {names}.", {
          lessons: removed,
          names,
        })
      : t("Leaves out {lessons, plural, one {# lesson} other {# lessons}}.", { lessons: removed });
  };

  return function lessonsText(effect: ChangeEffect): string | null {
    const added = {
      about: effect?.lessonsAddedEstimated ?? false,
      added: effect?.lessonsAdded ?? 0,
    };

    const removed = effect?.lessonsRemoved ?? 0;
    const leftOut = effect?.lessonsLeftOut ?? [];
    const someOf = leftOut.length !== removed;
    const listed = someOf ? examples(leftOut) : shortList(leftOut, "lessons");
    const counted = { names: leftOut.length > 0 ? listed : null, removed, someOf };

    if (added.added > 0 && removed > 0) {
      return bothText({ ...counted, ...added });
    }

    if (added.added > 0) {
      return addedText(added);
    }

    return removed > 0 ? removedText(counted) : null;
  };
}

/** "1 topic leaves: Origin and evolution." for a change that leaves notice topics out; null otherwise. */
export function useTopicsEffectText() {
  const t = useExtracted();
  const shortList = useShortList();

  return function topicsText(effect: ChangeEffect): string | null {
    const topics = (effect?.topicsLeftOut ?? []).flatMap((area) => area.topics);

    return topics.length > 0
      ? t("{count, plural, one {# topic leaves: {topics}.} other {# topics leave: {topics}.}}", {
          count: topics.length,
          topics: shortList(topics, "topics"),
        })
      : null;
  };
}
