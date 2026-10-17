"use client";

import { Button } from "@zoonk/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { MessageCircleQuestionIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLessonBuddy } from "./lesson-tutor";

/**
 * One quiet way to ask the learner's buddy about the screen in view, beside the lesson's next
 * action: an icon on most screens, and "Ask {buddy}" in words after a wrong answer, when asking
 * helps most. From `lg` the buddy's composer is in the aside, so the bar leaves it out.
 */
export function AskTutorButton({ labeled = false }: { labeled?: boolean }) {
  const t = useExtracted();
  const buddy = useLessonBuddy();

  if (!buddy) {
    return null;
  }

  const label = t("Ask {name}", { name: buddy.identity.name });

  if (labeled) {
    return (
      <Button
        className="lg:hidden"
        onClick={() => buddy.open()}
        size="lg"
        type="button"
        variant="outline"
      >
        <MessageCircleQuestionIcon aria-hidden="true" />
        {label}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        onClick={() => buddy.open()}
        render={
          <Button
            className="size-11 shrink-0 lg:hidden"
            size="icon"
            type="button"
            variant="outline"
          />
        }
      >
        <MessageCircleQuestionIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
