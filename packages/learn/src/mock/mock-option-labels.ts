"use client";

import { type MockOptionView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";

/** An exam of several tests (an objective test in the morning, a written one in the afternoon). */
export function getExamTests(options: readonly MockOptionView[]): number {
  const full = options.find((option) => option.kind === "full");
  const offersEachTest = options.some(({ kind }) => kind === "objective" || kind === "written");
  return offersEachTest ? (full?.sections?.length ?? 0) : 0;
}

/** One test of an exam of several is named as the notice names it; all of them, by their count. */
function getTestName(
  option: MockOptionView,
  tests: number,
): { kind: "one"; name: string } | { count: number; kind: "tests" } | null {
  const sections = option.sections ?? [];
  const [section] = sections;

  if ((option.kind === "objective" || option.kind === "written") && section) {
    return { kind: "one", name: section.name };
  }

  return option.kind === "full" && tests > 1 ? { count: tests, kind: "tests" } : null;
}

export function useMockOptionName() {
  const t = useExtracted();
  const format = useFormatter();

  return ({
    option,
    severalDays,
    tests = 0,
  }: {
    option: MockOptionView;
    severalDays: boolean;
    tests?: number;
  }): string => {
    const day = String(option.day ?? 1);
    const testName = severalDays ? null : getTestName(option, tests);

    if (testName) {
      return testName.kind === "tests"
        ? t("{count, plural, =2 {Both tests} other {All # tests}}", { count: testName.count })
        : testName.name;
    }

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
    const sessions = (option.sections ?? []).flatMap(({ session }) => (session ? [session] : []));

    // A test of an exam of several says when it happens, if the notice says; its name says the rest.
    // The notice's own words for each session are labels, so they're listed apart, not set in a sentence.
    if ((option.sections?.length ?? 0) > 0 && option.kind !== "half") {
      return sessions.join(" · ");
    }

    const subjects = severalDays && option.kind !== "area" ? option.areas : [];
    const parts = option.covers ?? [...new Set([...subjects, ...option.written])];

    if (parts.length > 0) {
      return format.list(parts, { type: "conjunction" });
    }

    return option.objectiveOnly && option.kind !== "area" ? t("No written part") : "";
  };
}

const ESTIMATE_STEP_MINUTES = 5;

/**
 * How long learners usually take, to the nearest five minutes, when that's under the time limit.
 * Core gives the limit itself when no estimate covers the whole mock (an essay, too few answers).
 */
function usualMinutes({
  estimatedMinutes,
  minutes,
}: Pick<MockOptionView, "estimatedMinutes" | "minutes">): number | null {
  const rounded = Math.max(
    ESTIMATE_STEP_MINUTES,
    Math.round(estimatedMinutes / ESTIMATE_STEP_MINUTES) * ESTIMATE_STEP_MINUTES,
  );

  return estimatedMinutes < minutes && rounded < minutes ? rounded : null;
}

/** A written test's questions are its tasks, which the objective count leaves out. */
function countQuestions(option: Pick<MockOptionView, "questions" | "sections">): number {
  const sections = option.sections ?? [];

  return sections.length > 0
    ? sections.reduce((sum, section) => sum + (section.questions ?? 0), 0)
    : option.questions;
}

/** The mock's questions and time limit, as the exam page and the plan show them. */
function useMockOptionSize() {
  const t = useExtracted();
  const duration = useFormatDuration();

  return (option: Pick<MockOptionView, "minutes" | "questions" | "sections">): string =>
    t({
      description: "A mock exam's size: its number of questions, then its time limit.",
      id: "mockQuestionsAndTime",
      message: "{count, plural, one {# question} other {# questions}} · {time}",
      values: { count: countQuestions(option), time: duration(option.minutes) },
    });
}

/** The chooser's row's facts: the size, then how long learners usually take when it's less. */
export function useMockOptionSizeFacts() {
  const t = useExtracted();
  const duration = useFormatDuration();
  const size = useMockOptionSize();

  return (
    option: Pick<MockOptionView, "estimatedMinutes" | "minutes" | "questions" | "sections">,
  ): string[] => {
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
