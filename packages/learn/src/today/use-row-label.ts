"use client";

import { useExtracted } from "next-intl";
import { type DayStep } from "../session/session-types";
import { practisesTopics } from "../session/use-block-copy";
import { useExtraLabel } from "../syllabus/use-extra-label";
import { useWritingLine } from "../writing/writing-header";
import { useTodayScreen } from "./today-context";

/** The subject a lesson belongs to, or that the exam doesn't test it. */
export function useBlockSubject() {
  const extraLabel = useExtraLabel();
  const { today } = useTodayScreen();

  return (block: DayStep): string | null =>
    block.subjectExtra
      ? extraLabel({
          document: today.goal.examDocument,
          hasNotice: block.subjectExtra === "notice",
        })
      : block.subject;
}

/**
 * A row's one line under its title: what a lesson belongs to, what practice is on, or how long a
 * challenge is, since a learner meets one before they've ever taken one.
 */
export function useStepLabel({ includeSubject = true } = {}) {
  const t = useExtracted();
  const writingLine = useWritingLine();

  return function stepLabel(block: DayStep): string | null {
    // A refused start is the one thing to know before tapping it, even while lessons come first.
    if (block.writingAvailability?.status === "tomorrow") {
      return writingLine(block);
    }

    if (block.waitReason) {
      return t("After today's lessons");
    }

    // The title names a practice's first topic, so the line counts the others.
    if (practisesTopics(block) && block.topics.length > 1) {
      return t("{count, plural, one {# more topic} other {# more topics}}", {
        count: block.topics.length - 1,
      });
    }

    if (block.checkpoint) {
      return block.questions > 0
        ? t("{count, plural, one {# question} other {# questions}}", { count: block.questions })
        : null;
    }

    if (block.fullReview) {
      return t("Every topic");
    }

    return writingLine(block) ?? (includeSubject ? block.subject : null);
  };
}
