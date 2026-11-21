"use client";

import { type WritingPrompt } from "@zoonk/core/exams/essays/writing-contract";
import { useExtracted } from "next-intl";
import { type StudyBlock } from "../session/session-types";
import { useGradingReturnsLine } from "./writing-labels";

type WritingUnit = WritingPrompt["unit"];

type WritingAvailability = NonNullable<StudyBlock["writingAvailability"]>;

/**
 * Where a task sits in the exam's written test, as the server says it before any question is
 * assigned. `distinctLines`: no other task of the test has its line limit.
 */
export type WritingTaskPlace = {
  distinctLines: boolean;
  lines: number | null;
  number: number;
  points: number | null;
  total: number;
};

/**
 * A view's `writingTask`, read where the contract doesn't carry it yet (blocks, refused starts):
 * null when it's missing or not that shape, and the block's own title names the task then.
 */
export function readTaskPlace(view: object): WritingTaskPlace | null {
  const place = "writingTask" in view ? view.writingTask : null;

  if (typeof place !== "object" || place === null) {
    return null;
  }

  const read = (key: string) => {
    const value: unknown = key in place ? Reflect.get(place, key) : null;
    return typeof value === "number" ? value : null;
  };

  const number = read("number");
  const total = read("total");

  if (number === null || total === null) {
    return null;
  }

  return {
    distinctLines: Reflect.get(place, "distinctLines") === true,
    lines: read("lines"),
    number,
    points: read("points"),
    total,
  };
}

/**
 * A writing task by the name a learner knows it: a whole answer by its line limit when that tells
 * it apart ("Write the 30-line question"), else by its place in the test; a drill as its own short
 * exercise, so the two never share a name on one list. Without its place, the block's own title.
 */
export function useWritingTaskTitle() {
  const t = useExtracted();

  return function writingTitle({
    task,
    title,
    unit,
  }: {
    task?: WritingTaskPlace | null;
    title: string | null;
    unit?: WritingUnit;
  }): string {
    if (unit === "drill") {
      return t({
        description:
          "A few minutes of writing after a lesson, using what it just taught, such as one paragraph of an exam answer.",
        message: "Short writing exercise",
      });
    }

    if (task?.distinctLines && task.lines) {
      return t({
        description:
          "A whole answer of an exam's written test, named by its line limit, such as 30 lines.",
        message: "Write the {lines}-line question",
        values: { lines: String(task.lines) },
      });
    }

    if (task && task.total > 1) {
      return t({
        description:
          "A whole answer of an exam's written test whose questions share a line limit, named by its place in the test.",
        message: "Write question {number}",
        values: { number: String(task.number) },
      });
    }

    if (task) {
      return t({
        description: "The whole answer of an exam's written test that has one question.",
        message: "Write the question",
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
