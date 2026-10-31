"use client";

import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted } from "next-intl";
import { type SyllabusSectionSubject } from "./syllabus-section-view";

export type SubjectBar = { known: number; studied: number };

type SubjectProgress = { bar: SubjectBar | null; known: string | null; label: string };

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

export function getSubjectShare(bar: SubjectBar): number {
  return Math.min(1, Math.max(0, bar.studied + bar.known));
}

export function useKnownLine() {
  const t = useExtracted();

  return function knownLine(subject: SyllabusSectionSubject): string | null {
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

export function useSubjectProgress() {
  const t = useExtracted();
  const knownLine = useKnownLine();

  return (subject: SyllabusSectionSubject): SubjectProgress => {
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
