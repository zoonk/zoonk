"use client";

import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted } from "next-intl";

/**
 * A subject's bar, in its goal's one measure: an exam subject's preparation (`studied`, nothing
 * `known`), or another goal's lessons as shares of its size: the ones studied, and apart the ones
 * skipped because the learner showed they know them.
 */
export type SubjectBar = { known: number; studied: number };

/**
 * How far a subject is, in one phrase and as shares for its bar (null: no bar to draw). An exam's
 * subject reads its preparation, on the same scale as the goal's number above it. Another goal's
 * module reads its lessons studied, so it moves with every lesson, with the ones skipped as known
 * beside them, so taking that credit back never lowers what they studied; a topic is ticked only
 * once all its lessons are. `known`: what they skipped because they showed they know it.
 */
export type SubjectProgress = { bar: SubjectBar | null; known: string | null; label: string };

/** The subject's bar in its goal's measure (see `SubjectBar`). */
export function getSubjectBar(
  subject: Pick<SyllabusSubject, "lessonsDone" | "lessonsKnown" | "lessonsTotal" | "preparation">,
): SubjectBar {
  if (subject.preparation !== null) {
    return { known: 0, studied: subject.preparation };
  }

  if (subject.lessonsTotal === 0) {
    return { known: 0, studied: 0 };
  }

  return {
    known: subject.lessonsKnown / subject.lessonsTotal,
    studied: subject.lessonsDone / subject.lessonsTotal,
  };
}

/**
 * The share beside a subject's bar, wherever its row is (the Plan's subjects, Today's aside, its
 * page): an exam subject's preparation, or another goal's lessons studied or known of its size.
 */
export function getSubjectShare(bar: SubjectBar): number {
  return Math.min(1, Math.max(0, bar.studied + bar.known));
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
      return { bar: null, known: null, label: t("Not in your plan") };
    }

    const known = knownLine(subject);

    if (total > 0 && subject.topicsStudied !== null) {
      return {
        bar: getSubjectBar(subject),
        known,
        label: t(
          "{total, plural, one {{done, number} of # topic} other {{done, number} of # topics}}",
          { done: subject.topicsStudied, total },
        ),
      };
    }

    if (total > 0) {
      return {
        bar: getSubjectBar(subject),
        known,
        label: t("{total, plural, one {# topic} other {# topics}}", { total }),
      };
    }

    return {
      bar: getSubjectBar(subject),
      known,
      label: t(
        "{total, plural, one {{done, number} of # lesson} other {{done, number} of # lessons}}",
        { done: subject.lessonsDone, total: subject.lessonsTotal },
      ),
    };
  };
}
