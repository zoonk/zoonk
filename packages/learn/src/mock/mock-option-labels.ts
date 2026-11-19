"use client";

import { type MockOptionView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";

export function useMockOptionName() {
  const t = useExtracted();
  const format = useFormatter();

  return ({ option, severalDays }: { option: MockOptionView; severalDays: boolean }): string => {
    const day = String(option.day ?? 1);

    if (option.kind === "area") {
      return option.areas[0] ?? option.area ?? t("One subject");
    }

    if (option.kind === "half") {
      return severalDays ? t("Half of day {day}", { day }) : t("Half the exam");
    }

    const unpicked = option.leftOut.flatMap((part) =>
      part.part === "choice" && part.name ? [part.name] : [],
    );

    if (unpicked.length > 0) {
      const names = format.list(unpicked, { type: "conjunction" });

      return severalDays
        ? t("Day {day}, without {names}", { day, names })
        : t("The full exam, without {names}", { names });
    }

    return severalDays ? t("Day {day}", { day }) : t("The full exam");
  };
}

/** A row's one line: what the mock exam asks. */
export function useMockOptionDetail() {
  const t = useExtracted();
  const format = useFormatter();

  return ({ option, severalDays }: { option: MockOptionView; severalDays: boolean }): string => {
    const subjects = severalDays && option.kind !== "area" ? option.areas : [];
    const parts = option.covers ?? [...subjects, ...option.written];

    if (parts.length > 0) {
      return format.list(parts, { type: "conjunction" });
    }

    return option.objectiveOnly ? t("No written part") : "";
  };
}

const ESTIMATE_STEP_MINUTES = 5;

/**
 * How long learners usually take, to the nearest five minutes, when that's under the time limit.
 * Core gives the limit itself when no estimate covers the whole mock (an essay, too few answers).
 */
export function usualMinutes({
  estimatedMinutes,
  minutes,
}: Pick<MockOptionView, "estimatedMinutes" | "minutes">): number | null {
  const rounded = Math.max(
    ESTIMATE_STEP_MINUTES,
    Math.round(estimatedMinutes / ESTIMATE_STEP_MINUTES) * ESTIMATE_STEP_MINUTES,
  );

  return estimatedMinutes < minutes && rounded < minutes ? rounded : null;
}

/** The mock's questions and time limit, as the exam page and the plan show them. */
export function useMockOptionSize() {
  const t = useExtracted();
  const duration = useFormatDuration();

  return (option: Pick<MockOptionView, "minutes" | "questions">): string =>
    t({
      description: "A mock exam's size: its number of questions, then its time limit.",
      id: "mockQuestionsAndTime",
      message: "{count, plural, one {# question} other {# questions}} · {time}",
      values: { count: option.questions, time: duration(option.minutes) },
    });
}

/** The chooser's row's facts: the size, then how long learners usually take when it's less. */
export function useMockOptionSizeFacts() {
  const t = useExtracted();
  const duration = useFormatDuration();
  const size = useMockOptionSize();

  return (option: Pick<MockOptionView, "estimatedMinutes" | "minutes" | "questions">): string[] => {
    const usual = usualMinutes(option);

    return usual === null
      ? [size(option)]
      : [
          size(option),
          t({
            description:
              "After a mock exam's size and time limit: about how long learners usually take.",
            message: "usually {time}",
            values: { time: duration(usual) },
          }),
        ];
  };
}
