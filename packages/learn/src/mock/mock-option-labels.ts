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

export function useMockOptionSize() {
  const t = useExtracted();
  const duration = useFormatDuration();

  return (option: Pick<MockOptionView, "estimatedMinutes" | "questions">): string =>
    t("{count, plural, one {# question} other {# questions}} · {time}", {
      count: option.questions,
      time: duration(option.estimatedMinutes),
    });
}
