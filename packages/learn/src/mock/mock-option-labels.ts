"use client";

import {
  type MockOptionView,
  type PlacementMockLength,
  type PlacementMockOptionView,
} from "@zoonk/core/exams/mocks/contract";
import { useExtracted, useFormatter } from "next-intl";
import { type RowChoice } from "../_components/choice-rows";
import { useFormatDuration } from "../_utils/time-format";
import { useMockDaySizeLabel } from "./mock-labels";

export function useMockOptionName() {
  const t = useExtracted();
  const format = useFormatter();
  const daySize = useMockDaySizeLabel();

  return ({ option, severalDays }: { option: MockOptionView; severalDays: boolean }): string => {
    if (option.kind === "area") {
      return option.areas[0] ?? option.area ?? t("One subject");
    }

    const unpicked = option.leftOut.flatMap((part) =>
      part.part === "choice" && part.name ? [part.name] : [],
    );

    if (option.kind === "full" && unpicked.length > 0) {
      const names = format.list(unpicked, { type: "conjunction" });

      return severalDays
        ? t("Exam day {day} without {names}", { day: String(option.day ?? 1), names })
        : t("An exam day without {names}", { names });
    }

    return daySize({
      day: severalDays ? (option.day ?? 1) : null,
      fullLength: option.kind === "full",
    });
  };
}

export function useMockOptionDetail() {
  const t = useExtracted();
  const format = useFormatter();

  return ({ option, severalDays }: { option: MockOptionView; severalDays: boolean }): string => {
    const written =
      option.written.length > 0
        ? `+ ${format.list(option.written, { type: "conjunction" })}`
        : null;

    const subjects =
      severalDays && option.kind !== "area" && option.areas.length > 0
        ? format.list(option.areas, { type: "conjunction" })
        : null;

    const covers = option.covers ? format.list(option.covers, { type: "conjunction" }) : null;

    const objective =
      option.objectiveOnly && !covers
        ? t({
            description:
              "The mock leaves out the exam's written part and has only its questions with set answers.",
            message: "objective part only",
          })
        : null;

    return [covers, subjects, written, objective].filter(Boolean).join(" · ");
  };
}

export function useMockOptionSize() {
  const t = useExtracted();
  const duration = useFormatDuration();

  return (option: Pick<MockOptionView, "estimatedMinutes" | "questions">): string =>
    t({
      description:
        "{count} is a number of questions in a mock exam, and {time} about how long it takes.",
      message: "{count} q · ~{time}",
      values: { count: String(option.questions), time: duration(option.estimatedMinutes) },
    });
}

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

export function usePlacementLengthChoices({
  options,
  recommended,
}: {
  options: readonly PlacementMockOptionView[];
  recommended: PlacementMockLength;
}): RowChoice<PlacementMockLength>[] {
  const t = useExtracted();
  const duration = useFormatDuration();
  const precision = usePlacementPrecision();

  return options.map((option) => {
    const time = duration(option.estimatedMinutes);

    return {
      description: precision(option),
      label:
        option.length === recommended
          ? t("About {time} (recommended)", { time })
          : t("About {time}", { time }),
      trailing: t({
        description: "{count} is a number of questions in a mock exam.",
        message: "{count} q",
        values: { count: String(option.questions) },
      }),
      value: option.length,
    };
  });
}
