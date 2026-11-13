"use client";

import { useExtracted } from "next-intl";
import { useShortList } from "../plan/use-short-list";
import { type DayStep } from "../session/session-types";
import { practisesTopics } from "../session/use-block-copy";

/**
 * A row's one line under its title: what a lesson belongs to, what practice is on, or how long a
 * challenge is, since a learner meets one before they've ever taken one.
 */
export function useStepLabel() {
  const t = useExtracted();
  const shortList = useShortList();

  return function stepLabel(block: DayStep): string | null {
    if (block.waitReason) {
      return t("After today's lessons");
    }

    if (practisesTopics(block)) {
      return shortList(block.topics, "topics", { named: 1 });
    }

    if (block.checkpoint) {
      return block.questions > 0
        ? t("{count, plural, one {# question} other {# questions}}", { count: block.questions })
        : null;
    }

    if (block.fullReview) {
      return t("Every topic");
    }

    return block.subject;
  };
}
