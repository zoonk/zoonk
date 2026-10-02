"use client";

import { Button } from "@zoonk/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { MessageCircleQuestionIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useOpenTutor } from "./lesson-tutor";

/** One quiet way to ask the tutor about the screen in view, beside the lesson's next action. */
export function AskTutorButton() {
  const t = useExtracted();
  const openTutor = useOpenTutor();

  if (!openTutor) {
    return null;
  }

  const label = t("Ask a question");

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        onClick={openTutor}
        render={<Button size="icon-lg" type="button" variant="outline" />}
      >
        <MessageCircleQuestionIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
