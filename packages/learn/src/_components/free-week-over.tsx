"use client";

import { type ComponentProps } from "react";
import { useLessonLimitWords } from "./help-limit-notice";
import { PlusNotice } from "./plus-lock";

/** A new lesson a free learner can't start reads as the month's lessons used up, wherever it shows. */
export function useFreeWeekOverCopy(): { body: string; title: string } {
  const { line = "", title = "" } = useLessonLimitWords({
    period: "month",
    status: "limitReached",
    tier: "free",
  });

  return { body: line, title };
}

export function FreeWeekOverNotice(
  props: Omit<ComponentProps<typeof PlusNotice>, "children" | "title">,
) {
  const { body, title } = useFreeWeekOverCopy();

  return (
    <PlusNotice {...props} title={title}>
      {body}
    </PlusNotice>
  );
}
