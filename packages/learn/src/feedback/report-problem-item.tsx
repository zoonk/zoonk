"use client";

import { type FeedbackTarget } from "@zoonk/core/feedback/contract";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useContentFeedback } from "./feedback-context";

/** Place it inside a `DropdownMenuContent`. */
export function ReportProblemItem({ screen, target }: { screen: string; target?: FeedbackTarget }) {
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
