"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { useExamples, useShortList } from "./use-short-list";

type ChangeEffect = PlanChangeView["effect"];

type Counted = { names: string | null; removed: number; someOf: boolean };

type Added = { about: boolean; added: number };

type LessonTexts = {
  addedText: (added: Added) => string;
  bothText: (counts: Counted & Added) => string;
  removedText: (counted: Counted) => string;
};

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
 * Without a date the plan keeps every lesson, so it has fewer or more of them, never "left out".
 */
function useFewerLessonsText(): LessonTexts {
  const t = useExtracted();

  const bothText = ({ about, added, names, removed, someOf }: Counted & Added) => {
    if (names && someOf) {
      return about
        ? t(
            "About {added, plural, one {# more lesson} other {# more lessons}} and {removed, plural, one {# fewer} other {# fewer}}, such as {names}.",
            { added, names, removed },
          )
        : t(
            "{added, plural, one {# more lesson} other {# more lessons}} and {removed, plural, one {# fewer} other {# fewer}}, such as {names}.",
            { added, names, removed },
          );
    }

    if (names) {
      return about
        ? t(
            "About {added, plural, one {# more lesson} other {# more lessons}} and {removed, plural, one {# fewer} other {# fewer}}: {names}.",
            { added, names, removed },
          )
        : t(
            "{added, plural, one {# more lesson} other {# more lessons}} and {removed, plural, one {# fewer} other {# fewer}}: {names}.",
            { added, names, removed },
          );
    }

    return about
      ? t(
          "About {added, plural, one {# more lesson} other {# more lessons}} and {removed, plural, one {# fewer} other {# fewer}}.",
          { added, removed },
        )
      : t(
          "{added, plural, one {# more lesson} other {# more lessons}} and {removed, plural, one {# fewer} other {# fewer}}.",
          { added, removed },
        );
  };

  const addedText = ({ about, added }: Added) =>
    about
      ? t("About {lessons, plural, one {# more lesson} other {# more lessons}}.", {
          lessons: added,
        })
      : t("{lessons, plural, one {# more lesson} other {# more lessons}}.", { lessons: added });

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
 * When names aren't one per lesson, a few are examples ("such as A, B and C"), never a count of
 * names beside a count of lessons.
 */
export function useLessonsEffectText() {
  const t = useExtracted();
  const format = useFormatter();
  const shortList = useShortList();
  const examples = useExamples();
  const fewer = useFewerLessonsText();

  /** By topic: a stand-in that only shrinks has no title of its own. */
  const unwrittenText = (effect: ChangeEffect): string | null => {
    const skills = (effect?.unwrittenLeftOut ?? []).map(({ lessons, skill }) =>
      t("{skill} (about {lessons, number})", { lessons, skill }),
    );

    return skills.length > 0
      ? t("Lessons not written yet: {skills}.", {
          skills: format.list(skills, { type: "conjunction" }),
        })
      : null;
  };

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

  const addedText = ({ about, added }: Added) =>
    about
      ? t("Adds about {lessons, plural, one {# lesson} other {# lessons}}.", { lessons: added })
      : t("Adds {lessons, plural, one {# lesson} other {# lessons}}.", { lessons: added });

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
      byDate?: boolean;
      /**
       * Beside a diff, which counts them first: only a sentence that names the lessons left out
       * says more. Null otherwise.
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

    const unwritten = unwrittenText(effect);

    if (named && counted.names === null) {
      return unwritten;
    }

    const counts = sayLessons(byDate ? { addedText, bothText, removedText } : fewer, {
      ...counted,
      ...added,
    });

    // Counts net skill by skill, so a lesson swapped within its skill still needs its name; it's
    // "leaves out" either way, since "fewer" would be untrue.
    const netted =
      removed === 0 && leftOut.length > 0
        ? removedText({
            names: shortList(leftOut, "lessons"),
            removed: leftOut.length,
            someOf: false,
          })
        : null;

    return [counts, netted, unwritten].filter(Boolean).join(" ") || null;
  };
}

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
