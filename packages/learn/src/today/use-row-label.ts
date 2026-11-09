"use client";

import { useExtracted } from "next-intl";
import { useShortList } from "../plan/use-short-list";
import { type DayStep } from "../session/session-types";
import { practisesTopics, useBlockDetail } from "../session/use-block-copy";
import { useIsCatchingUp } from "./today-catch-up";

export function useRowLabel() {
  return useStepLabel(useIsCatchingUp());
}

/** A challenge says what it is, since a learner meets one before they've ever taken one. */
export function useStepLabel(isCatchingUp: (step: DayStep) => boolean) {
  const t = useExtracted();
  const detail = useBlockDetail();
  const shortList = useShortList();

  const part = (block: DayStep): string | null => {
    if (practisesTopics(block)) {
      return shortList(block.topics, "topics", { named: 1 });
    }

    if (!isCatchingUp(block)) {
      return block.checkpoint
        ? [block.subject, detail(block)].filter(Boolean).join(" · ")
        : block.subject;
    }

    return block.subject
      ? t({
          description: "A lesson left from an earlier day.",
          message: "Catching up · {subject}",
          values: { subject: block.subject },
        })
      : t({ description: "A lesson left from an earlier day.", message: "Catching up" });
  };

  return (block: DayStep): string | null => {
    const label = part(block);

    if (!block.oftenTested) {
      return label;
    }

    return label ? t("{label} · often tested", { label }) : t("Often tested");
  };
}
