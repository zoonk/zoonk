"use client";

import {
  type MockOptionView,
  type PlacementMockLength,
  type PlacementMockOptionView,
} from "@zoonk/core/exams/mocks/contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";
import { type MockChoice } from "./mock-chooser-parts";

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
 * What a mock covers, honestly, under its name: the papers it covers when it leaves one out
 * ("Listening and Reading" without IELTS's Speaking), a full mock's written part beside its
 * questions ("+ Essay"), the day's subjects for a day of an exam of several, and when the day's
 * written part is left out. Its size is the row's own (`useMockOptionSize`).
 */
export function useMockOptionDetail() {
  const t = useExtracted();
  const format = useFormatter();

  return ({ option, severalDays }: { option: MockOptionView; severalDays: boolean }): string => {
    // A full mock's written part comes with its questions: "+ Essay".
    const written =
      option.written.length > 0
        ? `+ ${format.list(option.written, { type: "conjunction" })}`
        : null;

    const subjects =
      severalDays && option.kind !== "area" && option.areas.length > 0
        ? format.list(option.areas, { type: "conjunction" })
        : null;

    const covers = option.covers ? format.list(option.covers, { type: "conjunction" }) : null;
    // The papers it covers already say the written part isn't one of them.
    const objective = option.objectiveOnly && !covers ? t("objective part only") : null;

    return [covers, subjects, written, objective].filter(Boolean).join(" · ");
  };
}

/**
 * A mock's size at its row's end, in the mono face: its questions and about how long learners take
 * on them ("90 q · ~4h 42m").
 */
export function useMockOptionSize() {
  const t = useExtracted();
  const duration = useFormatDuration();

  return (option: Pick<MockOptionView, "estimatedMinutes" | "questions">): string =>
    t("{count} q · ~{time}", {
      count: String(option.questions),
      time: duration(option.estimatedMinutes),
    });
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
 * A diagnostic mock's lengths as one choice: about how long, how fine (under it) and its questions
 * (at its end), with the suggested one (the quick check) saying so.
 */
export function usePlacementLengthChoices({
  options,
  recommended,
}: {
  options: readonly PlacementMockOptionView[];
  recommended: PlacementMockLength;
}): MockChoice<PlacementMockLength>[] {
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
      trailing: t("{count} q", { count: String(option.questions) }),
      value: option.length,
    };
  });
}
