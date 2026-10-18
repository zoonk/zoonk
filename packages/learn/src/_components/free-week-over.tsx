"use client";

import { useExtracted } from "next-intl";
import { type ComponentProps } from "react";
import { PlusNotice } from "./plus-lock";

/**
 * What a free exam plan past its first week keeps and what Plus opens, said the same way wherever
 * the learner meets it: Today, the Plan, a lesson or a challenge.
 */
export function useFreeWeekOverCopy(): { body: string; title: string } {
  const t = useExtracted();

  return {
    body: t(
      "Reviews and fixing your mistakes stay free. Plus opens new lessons, the rest of your plan and mock exams.",
    ),
    title: t("Your free week of exam prep is over"),
  };
}

/** The end of a free exam plan's first week, as the shared Plus notice with its own title. */
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
