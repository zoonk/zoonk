"use client";

import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { getLessonShare } from "@zoonk/core/view-models/syllabus/lesson-share";
import { useExtracted } from "next-intl";

export type Preparation = NonNullable<ProgressView["preparation"]>;

/** A goal measured in lessons: its plan's lessons studied or known (the syllabus's `lessons`). */
export type Lessons = SyllabusView["lessons"];

type PreparationPart = {
  /** The evidence behind the number, in a few words. */
  caption: string;
  key: "coverage" | "lessons" | "mastery" | "mocks" | "retention";
  label: string;
  /** Null until there's something to measure: an honest blank, never a made-up number. */
  value: number | null;
};

/** The fourth part's name and evidence: mock exams, full reviews or weekly challenges. */
function useTestCopy(mocks: Preparation["components"]["mocks"]) {
  const t = useExtracted();
  const count = mocks.taken;

  switch (mocks.kind) {
    case "fullReviews":
      return {
        caption: t(
          "{count, plural, =0 {# full reviews done} one {# full review done} other {# full reviews done}}",
          { count },
        ),
        label: t("Full reviews"),
      };
    case "weeklyChallenges":
      return {
        caption: t(
          "{count, plural, =0 {# weekly challenges} one {# weekly challenge} other {# weekly challenges}}",
          { count },
        ),
        label: t("Weekly challenges"),
      };
    case "mockExams":
      return {
        caption: t(
          "{count, plural, =0 {# mock exams taken} one {# mock exam taken} other {# mock exams taken}}",
          { count },
        ),
        label: t("Mock exams"),
      };
    default:
      return mocks.kind satisfies never;
  }
}

/**
 * The four parts of the number, each with its evidence in a few words. An exam's: coverage of the
 * goal's skills, mastery on questions never seen, memory over time, and its mock exams (or full
 * reviews when the learner's plan has none). Another goal's (`lessons`): its progress first, its
 * plan's lessons, then how well they're known: mastery, memory and weekly challenges.
 */
export function usePreparationParts({
  lessons,
  preparation,
}: {
  lessons: Lessons | null;
  preparation: Preparation;
}): PreparationPart[] {
  const t = useExtracted();
  const { coverage, mastery, mocks, retention } = preparation.components;
  const notYet = t("Not yet");
  const test = useTestCopy(mocks);

  const first: PreparationPart = lessons
    ? {
        caption: t(
          "{total, plural, one {{done, number} of # lesson} other {{done, number} of # lessons}}",
          lessons,
        ),
        key: "lessons",
        label: t("Lessons"),
        value: getLessonShare(lessons),
      }
    : {
        // The ring weighs each skill by its importance, as the headline does: the count alone
        // would read as a different share.
        caption: t(
          "{studied, number} of {total, plural, one {# skill} other {# skills}}, weighted by importance",
          { studied: coverage.studiedSkills, total: coverage.totalSkills },
        ),
        key: "coverage",
        label: t("Coverage"),
        value: coverage.value,
      };

  return [
    first,
    {
      // Lesson checks come right after their screens teach the answer: only questions never seen
      // before measure mastery, so 9 of 9 in lessons still says where it comes from.
      caption:
        mastery.value === null
          ? t("Shows after a few practice questions")
          : t("{correct, number} of {answered, number} right", {
              answered: mastery.answered,
              correct: mastery.correct,
            }),
      key: "mastery",
      label: t("Mastery"),
      // What the headline counts: a few right answers say less than many.
      value: mastery.supported,
    },
    {
      caption: retention.value === null ? notYet : t("Of what you studied"),
      key: "retention",
      // Not "Memory": that's the settings feature (what Zoonk remembers about you), and the same
      // English shares one translation across the app.
      label: t("Long-term memory"),
      value: retention.value,
    },
    {
      caption: mocks.taken === 0 ? notYet : test.caption,
      key: "mocks",
      label: test.label,
      value: mocks.value,
    },
  ];
}
