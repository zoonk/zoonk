"use client";

import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted } from "next-intl";

/**
 * How far a subject is, in one phrase and as a share for its bar (null: no bar to draw), from what
 * the learner studied. The bar is always the subject's lessons studied, so it moves with every
 * lesson; a topic is ticked only once all its lessons are. `known`: what they skipped because they
 * showed they know it, apart, so taking that credit back never lowers what they studied.
 */
export type SubjectProgress = { known: string | null; label: string; share: number | null };

function lessonShare(subject: SyllabusSubject): number {
  return subject.lessonsTotal > 0 ? subject.lessonsDone / subject.lessonsTotal : 0;
}

/**
 * "25 lessons skipped because you already know them", or the topics the learner knows where the
 * plan maps them; null when there are none.
 */
export function useKnownLine() {
  const t = useExtracted();

  return function knownLine(subject: SyllabusSubject): string | null {
    if (subject.topicsKnown !== null && subject.topics.length > 0) {
      return subject.topicsKnown > 0
        ? t(
            "{count, plural, one {# topic skipped because you already know it} other {# topics skipped because you already know them}}",
            { count: subject.topicsKnown },
          )
        : null;
    }

    return subject.lessonsKnown > 0
      ? t(
          "{count, plural, one {# lesson skipped because you already know it} other {# lessons skipped because you already know them}}",
          { count: subject.lessonsKnown },
        )
      : null;
  };
}

/**
 * A subject's progress in the learner's terms: topics ticked when the plan maps them ("2 of 12
 * topics"), the notice's topic count with the lessons' share when it doesn't, lessons for modules,
 * and "Not in your plan" when it isn't.
 */
export function useSubjectProgress() {
  const t = useExtracted();
  const knownLine = useKnownLine();

  return (subject: SyllabusSubject): SubjectProgress => {
    const total = subject.topics.length;

    if (subject.notPlannedReason) {
      return { known: null, label: t("Not in your plan"), share: null };
    }

    const known = knownLine(subject);

    if (total > 0 && subject.topicsStudied !== null) {
      return {
        known,
        label: t(
          "{total, plural, one {{done, number} of # topic} other {{done, number} of # topics}}",
          { done: subject.topicsStudied, total },
        ),
        share: lessonShare(subject),
      };
    }

    if (total > 0) {
      return {
        known,
        label: t("{total, plural, one {# topic} other {# topics}}", { total }),
        share: lessonShare(subject),
      };
    }

    return {
      known,
      label: t(
        "{total, plural, one {{done, number} of # lesson} other {{done, number} of # lessons}}",
        { done: subject.lessonsDone, total: subject.lessonsTotal },
      ),
      share: lessonShare(subject),
    };
  };
}
