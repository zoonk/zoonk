"use client";

import { type ContentVoteTarget } from "@zoonk/core/feedback/contract";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useContentFeedback } from "./feedback-context";

/**
 * "Report a problem": a message with the screen attached, and the content it's about when there's
 * one. Place it inside a `DropdownMenuContent`; `screen` names where the menu is, such as
 * "lesson-step", for the message's context. Nothing for hosts without feedback.
 */
export function ReportProblemItem({
  screen,
  target,
}: {
  screen: string;
  target?: ContentVoteTarget;
}) {
  const t = useExtracted("feedback");
  const feedback = useContentFeedback();

  if (!feedback) {
    return null;
  }

  return (
    <DropdownMenuItem
      onClick={() => feedback.openFeedbackForm({ context: { ...target, screen }, isReport: true })}
    >
      <FlagIcon aria-hidden="true" />
      {t("Report a problem")}
    </DropdownMenuItem>
  );
}
