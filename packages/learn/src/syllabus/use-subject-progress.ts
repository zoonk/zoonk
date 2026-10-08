"use client";

import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted } from "next-intl";

/**
 * How far a subject is, in one phrase and as a share for its bar (null: no bar to draw). The bar is
 * always the subject's lessons done, so it moves with every lesson; a topic is ticked only once
 * all its lessons are.
 */
export type SubjectProgress = { label: string; share: number | null };

function lessonShare(subject: SyllabusSubject): number {
  return subject.lessonsTotal > 0 ? subject.lessonsDone / subject.lessonsTotal : 0;
}

/**
 * A subject's progress in the learner's terms: topics ticked when the plan maps them ("2 of 12
 * topics"), the notice's topic count with the lessons' share when it doesn't, lessons for modules,
 * and "Not in your plan" when it isn't.
 */
export function useSubjectProgress() {
  const t = useExtracted();

  return (subject: SyllabusSubject): SubjectProgress => {
    const total = subject.topics.length;

    if (subject.notPlannedReason) {
      return { label: t("Not in your plan"), share: null };
    }

    if (total > 0 && subject.topicsStudied !== null) {
      return {
        label: t(
          "{total, plural, one {{done, number} of # topic} other {{done, number} of # topics}}",
          { done: subject.topicsStudied, total },
        ),
        share: lessonShare(subject),
      };
    }

    if (total > 0) {
      return {
        label: t("{total, plural, one {# topic} other {# topics}}", { total }),
        share: lessonShare(subject),
      };
    }

    return {
      label: t(
        "{total, plural, one {{done, number} of # lesson} other {{done, number} of # lessons}}",
        { done: subject.lessonsDone, total: subject.lessonsTotal },
      ),
      share: lessonShare(subject),
    };
  };
}
