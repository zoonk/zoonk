"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { Separator } from "@zoonk/ui/components/separator";
import { InfoIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePlayerActivityMeta } from "../player-context";

/**
 * A small info button in the player header that opens a popover with
 * contextual details about the current lesson and chapter.
 *
 * Helps learners orient themselves when they enter an activity directly
 * (e.g., via "Continue" links) without going through the lesson page first.
 */
export function LessonInfoPopover() {
  const t = useExtracted();
  const { chapterTitle, lessonDescription, lessonTitle } = usePlayerActivityMeta();

  return (
    <Popover>
      <PopoverTrigger className={buttonVariants({ size: "icon", variant: "ghost" })}>
        <InfoIcon className="size-4" />
        <span className="sr-only">{t("Lesson info")}</span>
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom" sideOffset={8}>
        <PopoverHeader>
          <PopoverTitle>{lessonTitle}</PopoverTitle>
          <PopoverDescription>{lessonDescription}</PopoverDescription>
        </PopoverHeader>

        <Separator />

        <p className="text-muted-foreground text-xs">{chapterTitle}</p>
      </PopoverContent>
    </Popover>
  );
}
