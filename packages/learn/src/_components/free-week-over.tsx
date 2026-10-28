"use client";

import { useExtracted } from "next-intl";
import { type ComponentProps } from "react";
import { PlusNotice } from "./plus-lock";

export function useFreeWeekOverCopy(): { body: string; title: string } {
  const t = useExtracted();

  return {
    body: t(
      "Reviews and fixing your mistakes stay free. Plus opens new lessons, the rest of your plan and mock exams.",
    ),
    title: t("Your free week of exam prep is over"),
  };
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
