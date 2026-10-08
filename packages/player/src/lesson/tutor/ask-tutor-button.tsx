"use client";

import { Button } from "@zoonk/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { MessageCircleQuestionIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLessonBuddy } from "./lesson-tutor";

/** One quiet way to ask the tutor about the screen in view, beside the lesson's next action. */
export function AskTutorButton() {
  const t = useExtracted();
  const buddy = useLessonBuddy();

  if (!buddy) {
    return null;
  }

  const label = t("Ask {name}", { name: buddy.identity.name });

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        onClick={() => buddy.open()}
        render={<Button size="icon-lg" type="button" variant="outline" />}
      >
        <MessageCircleQuestionIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
