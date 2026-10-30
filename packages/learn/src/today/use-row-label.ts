"use client";

import { useExtracted } from "next-intl";
import { type DayStep } from "../session/session-types";
import { useBlockDetail } from "../session/use-block-copy";
import { useIsCatchingUp } from "./today-catch-up";

/** A challenge says what it is, since a learner meets one before they've ever taken one. */
export function useRowLabel() {
  const t = useExtracted();
  const detail = useBlockDetail();
  const isCatchingUp = useIsCatchingUp();

  const part = (block: DayStep): string | null => {
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
