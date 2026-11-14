"use client";

import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted } from "next-intl";
import { useFormatShare } from "../../_utils/percent";

export type Preparation = NonNullable<ProgressView["preparation"]>;

export type Lessons = SyllabusView["lessons"];

type PreparationPart = {
  key: "coverage" | "lessons" | "mastery" | "mocks" | "retention";
  label: string;
  value: string;
};

/** What the number is made of. A part with nothing to show yet has no row. */
export function usePreparationParts({
  lessons,
  preparation,
}: {
  lessons: Lessons | null;
  preparation: Preparation;
}): PreparationPart[] {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { coverage, mastery, mocks, retention } = preparation.components;

  const first: PreparationPart = lessons
    ? {
        key: "lessons",
        label: t("Lessons"),
        value: t("{done, number} of {total, number}", lessons),
      }
    : {
        key: "coverage",
        label: t("Topics studied"),
        value: t("{done, number} of {total, number}", {
          done: coverage.studiedSkills,
          total: coverage.totalSkills,
        }),
      };

  return [
    first,
    ...(mastery.value === null
      ? []
      : [
          {
            key: "mastery" as const,
            label: t("Right answers"),
            value: t("{done, number} of {total, number}", {
              done: mastery.correct,
              total: mastery.answered,
            }),
          },
        ]),
    ...(retention.value === null
      ? []
      : [
          {
            key: "retention" as const,
            label: t("Remembered"),
            value: formatShare(retention.value),
          },
        ]),
    ...(mocks.taken === 0
      ? []
      : [
          {
            key: "mocks" as const,
            label: {
              fullReviews: t("Reviews of every topic"),
              mockExams: t("Mock exams"),
              weeklyChallenges: t("Weekly challenges"),
            }[mocks.kind],
            value:
              mocks.kind === "fullReviews"
                ? t({
                    description:
                      'How many reviews of every topic the learner has done, beside the label "Reviews of every topic". The count is of reviews.',
                    message: "{reviews, plural, one {# done} other {# done}}",
                    values: { reviews: mocks.taken },
                  })
                : t("{count, plural, one {# taken} other {# taken}}", { count: mocks.taken }),
          },
        ]),
  ];
}
