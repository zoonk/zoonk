"use client";

import {
  type MockOptionView,
  type PlacementMockLength,
  type PlacementMockOptionView,
} from "@zoonk/core/exams/mocks/contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";
import { type Choice } from "../onboarding/choice-list";

/**
 * A mock's name as the learner picks it: the full exam (one of its days, when it has several),
 * half of it, or the subject.
 */
export function useMockOptionName() {
  const t = useExtracted();

  return ({ option, severalDays }: { option: MockOptionView; severalDays: boolean }): string => {
    const day = String(option.day ?? 1);

    if (option.kind === "area") {
      return option.areas[0] ?? option.area ?? t("One subject");
    }

    if (option.kind === "half") {
      return severalDays ? t("Half the exam, day {day}", { day }) : t("Half the exam");
    }

    return severalDays ? t("Full exam, day {day}", { day }) : t("Full exam");
  };
}

/**
 * What a mock asks and how long it takes, honestly: its questions and about how long learners take
 * on them, the day's subjects for a day of an exam of several, and when the day's written part is
 * left out.
 */
export function useMockOptionDetail() {
  const t = useExtracted();
  const format = useFormatter();
  const duration = useFormatDuration();

  return ({ option, severalDays }: { option: MockOptionView; severalDays: boolean }): string => {
    const size = t("{count, plural, one {# question} other {# questions}} · about {time}", {
      count: option.questions,
      time: duration(option.estimatedMinutes),
    });

    const subjects =
      severalDays && option.kind !== "area" && option.areas.length > 0
        ? format.list(option.areas, { type: "conjunction" })
        : null;

    const objective = option.objectiveOnly ? t("objective part only") : null;

    return [subjects, size, objective].filter(Boolean).join(" · ");
  };
}

/**
 * How fine a starting point a diagnostic mock's length sets, said plainly: a quick check is enough
 * to start, since the first days keep placing the learner, and one that leaves the smallest
 * subjects out says the first days ask about them.
 */
function usePlacementPrecision() {
  const t = useExtracted();

  return (option: PlacementMockOptionView): string => {
    if (!option.coversAllAreas) {
      return t(
        "The {count, plural, one {subject} other {# subjects}} worth most. Your first days ask about the rest.",
        { count: option.areas.length },
      );
    }

    if (option.length === "short") {
      return t("A quick check. Your first days fine-tune it.");
    }

    return option.length === "long"
      ? t("The most precise starting point.")
      : t("Every subject. A good starting point.");
  };
}

/**
 * A diagnostic mock's lengths as one choice: about how long, its questions and how fine, with the
 * suggested one (the quick check) saying so.
 */
export function usePlacementLengthChoices({
  options,
  recommended,
}: {
  options: readonly PlacementMockOptionView[];
  recommended: PlacementMockLength;
}): Choice<PlacementMockLength>[] {
  const t = useExtracted();
  const duration = useFormatDuration();
  const precision = usePlacementPrecision();

  return options.map((option) => {
    const time = duration(option.estimatedMinutes);

    return {
      description: `${t("{count, plural, one {# question} other {# questions}}", { count: option.questions })} · ${precision(option)}`,
      label:
        option.length === recommended
          ? t("About {time} (recommended)", { time })
          : t("About {time}", { time }),
      value: option.length,
    };
  });
}
