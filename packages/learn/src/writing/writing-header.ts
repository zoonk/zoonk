"use client";

import { type WritingPrompt } from "@zoonk/core/exams/essays/writing-contract";
import { useExtracted } from "next-intl";
import { type StudyBlock } from "../session/session-types";
import { useGradingReturnsLine } from "./writing-labels";

type WritingUnit = WritingPrompt["unit"];

type WritingAvailability = NonNullable<StudyBlock["writingAvailability"]>;

/**
 * A writing task by the name a learner knows it: a whole answer by its line limit ("Write the
 * 30-line question") or else as the notice names it, a drill as its own short exercise, so the two
 * never share a name on one list.
 */
export function useWritingTaskTitle() {
  const t = useExtracted();

  return ({
    lines,
    title,
    unit,
  }: {
    lines?: number | null;
    title: string | null;
    unit?: WritingUnit;
  }): string => {
    if (unit === "drill") {
      return t({
        description:
          "A few minutes of writing after a lesson, using what it just taught, such as one paragraph of an exam answer.",
        message: "Short writing exercise",
      });
    }

    if (lines) {
      return t({
        description:
          "A whole answer of an exam's written test, named by its line limit, such as 30 lines.",
        message: "Write the {lines}-line question",
        values: { lines: String(lines) },
      });
    }

    return title ?? t("Writing practice");
  };
}

/**
 * A writing block's line under its name: when the day's grading is used up, that its draft is kept,
 * or what a drill is for, since its name is the same after every lesson.
 */
export function useWritingLine() {
  const t = useExtracted();
  const gradingReturns = useGradingReturnsLine();

  return function writingLine({
    writingAvailability,
    writingUnit,
  }: {
    writingAvailability?: WritingAvailability;
    writingUnit?: WritingUnit;
  }): string | null {
    if (writingAvailability?.status === "tomorrow") {
      return gradingReturns(writingAvailability.returnsOn);
    }

    if (writingAvailability?.status === "continue") {
      return t("Your draft is saved");
    }

    return writingUnit === "drill"
      ? t({
          description: "Under a short writing exercise after a lesson: what it's for.",
          message: "To use what you just learned",
        })
      : null;
  };
}

/** The screen's header: what kind of writing this is. The topic is the page's own title. */
export function useHeaderLabel(writing: Pick<WritingPrompt, "unit">): string {
  const t = useExtracted();
  return writing.unit === "drill" ? t("Writing practice") : t("Written answer");
}
