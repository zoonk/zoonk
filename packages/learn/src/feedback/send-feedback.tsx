"use client";

import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { MessageSquareIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useContentFeedback } from "./feedback-context";

/**
 * "Send feedback" in the account menu. It opens the message form with the current page attached,
 * so feedback is one tap away without a floating button.
 */
export function SendFeedbackMenuItem({ screen }: { screen: string }) {
  const t = useExtracted("feedback");
  const feedback = useContentFeedback();

  if (!feedback) {
    return null;
  }

  return (
    <DropdownMenuItem
      onClick={() => feedback.openFeedbackForm({ context: { screen }, isReport: false })}
    >
      <MessageSquareIcon aria-hidden="true" />
      {t("Send feedback")}
    </DropdownMenuItem>
  );
}
