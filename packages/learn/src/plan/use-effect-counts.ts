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

/** One way of saying what a change does to the lessons: by a date, or in fewer and more. */
type LessonTexts = {
  addedText: (added: Added) => string;
  bothText: (counts: Counted & Added) => string;
  removedText: (counted: Counted) => string;
};

/** What a change does to the lessons, in `texts`'s words; null when it adds and leaves out none. */
function sayLessons(texts: LessonTexts, counts: Counted & Added): string | null {
  if (counts.added > 0 && counts.removed > 0) {
    return texts.bothText(counts);
  }

  if (counts.added > 0) {
    return texts.addedText(counts);
  }

  return counts.removed > 0 ? texts.removedText(counts) : null;
}

/**
 * The lessons a change gives the goal or takes from it when they don't count against a date still
 * ahead: the plan keeps every lesson, so it has fewer or more of them ("3 fewer lessons: A, B and
 * C.", "4 more lessons and 3 fewer."), never "left out", which is for lessons a date leaves no
 * time for (see `useLessonsEffectText`).
 */
function useFewerLessonsText(): LessonTexts {
  const t = useExtracted();

  /** More lessons and fewer at once, with the names of the ones that go when it has them. */
  const bothText = ({ about, added, names, removed, someOf }: Counted & Added) => {
    if (names && someOf) {
      return about
        ? t(
            "About {added, plural, one {# more lesson} other {# more lessons}} and {removed, number} fewer, such as {names}.",
            { added, names, removed },
          )
        : t(
            "{added, plural, one {# more lesson} other {# more lessons}} and {removed, number} fewer, such as {names}.",
            { added, names, removed },
          );
    }

    if (names) {
      return about
        ? t(
            "About {added, plural, one {# more lesson} other {# more lessons}} and {removed, number} fewer: {names}.",
            { added, names, removed },
          )
        : t(
            "{added, plural, one {# more lesson} other {# more lessons}} and {removed, number} fewer: {names}.",
            { added, names, removed },
          );
    }

    return about
      ? t(
          "About {added, plural, one {# more lesson} other {# more lessons}} and {removed, number} fewer.",
          { added, removed },
        )
      : t(
          "{added, plural, one {# more lesson} other {# more lessons}} and {removed, number} fewer.",
          { added, removed },
        );
  };

  /** More lessons, alone, in the diff's words. */
  const addedText = ({ about, added }: Added) =>
    about
      ? t("About {lessons, plural, one {# more lesson} other {# more lessons}}.", {
          lessons: added,
        })
      : t("{lessons, plural, one {# more lesson} other {# more lessons}}.", { lessons: added });

  /** Fewer lessons, with the names of the ones that go when it has them. */
  const removedText = ({ names, removed, someOf }: Counted) => {
    if (names && someOf) {
      return t(
        "{lessons, plural, one {# fewer lesson} other {# fewer lessons}}, such as {names}.",
        { lessons: removed, names },
      );
    }

    return names
      ? t("{lessons, plural, one {# fewer lesson} other {# fewer lessons}}: {names}.", {
          lessons: removed,
          names,
        })
      : t("{lessons, plural, one {# fewer lesson} other {# fewer lessons}}.", { lessons: removed });
  };

  return { addedText, bothText, removedText };
}

/**
 * The lessons a change adds and leaves out, both when it does both ("Adds 45 lessons and leaves
 * out 21."), with the ones it leaves out whole by name ("Leaves out 3 lessons: Cromatina, Golgi
 * and Lisossomos."), so the card says what the buddy says and nothing leaves the plan unsaid.
 * When the names aren't one per lesson (a topic's lessons not written yet go by its name, and
 * lessons a change only shortens have none), a few of them are examples, never a count of names
 * beside a count of lessons: "Leaves out 304 lessons, such as A, B and C." Lessons not written yet
 * are the plan's estimate: "Adds about 8 lessons."
 */
export function useLessonsEffectText() {
  const t = useExtracted();
  const shortList = useShortList();
  const examples = useExamples();
  const fewer = useFewerLessonsText();

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

  return function lessonsText(
    effect: ChangeEffect,
    {
      byDate = true,
      named = false,
    }: {
      /**
       * Whether its lessons count against a date still ahead, as its diff's (`PlanEffectDiff`).
       * Without one it says fewer or more lessons (see `useFewerLessonsText`).
       */
      byDate?: boolean;
      /**
       * Beside a diff, which counts them first (`PlanEffectDiff`): only a sentence that names the
       * lessons left out says something more. Null otherwise.
       */
      named?: boolean;
    } = {},
  ): string | null {
    const added = {
      about: effect?.lessonsAddedEstimated ?? false,
      added: effect?.lessonsAdded ?? 0,
    };

    const removed = effect?.lessonsRemoved ?? 0;
    const leftOut = effect?.lessonsLeftOut ?? [];
    const someOf = leftOut.length !== removed;
    const listed = someOf ? examples(leftOut) : shortList(leftOut, "lessons");
    const counted = { names: leftOut.length > 0 ? listed : null, removed, someOf };

    if (named && counted.names === null) {
      return null;
    }

    const counts = sayLessons(byDate ? { addedText, bothText, removedText } : fewer, {
      ...counted,
      ...added,
    });

    // The counts go skill by skill, so a lesson swapped for another of its skill nets away: its name
    // still says it, as every lesson a change sets aside is named. "Leaves out" with a date or
    // without: the goal keeps as many lessons, so "fewer" would be untrue.
    const netted =
      removed === 0 && leftOut.length > 0
        ? removedText({
            names: shortList(leftOut, "lessons"),
            removed: leftOut.length,
            someOf: false,
          })
        : null;

    return [counts, netted].filter(Boolean).join(" ") || null;
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
