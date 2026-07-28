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
import { ArrowRightIcon, EllipsisIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePlayerLessonMeta, usePlayerNavigation } from "../player-context";
import { PlayerLink } from "../player-link";

/**
 * Keeps contextual lesson details and infrequent navigation outside the main
 * learning path. The overflow icon follows the familiar options convention,
 * while the popover gives rare actions enough room for a clear text label.
 *
 * Skipping only navigates away. It does not complete the lesson or award
 * progress, so learners can return to the unfinished lesson later.
 */
export function LessonOptionsPopover() {
  const t = useExtracted();
  const { description, lessonTitle } = usePlayerLessonMeta();
  const { nextLessonHref } = usePlayerNavigation();

  return (
    <Popover>
      <PopoverTrigger className={buttonVariants({ size: "icon", variant: "ghost" })}>
        <EllipsisIcon aria-hidden="true" className="size-4" />
        <span className="sr-only">{t("Lesson options")}</span>
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom" sideOffset={8}>
        <PopoverHeader>
          <PopoverTitle>{lessonTitle}</PopoverTitle>
          <PopoverDescription>{description}</PopoverDescription>
        </PopoverHeader>

        {nextLessonHref && (
          <PlayerLink
            className={buttonVariants({
              className: "text-muted-foreground self-end",
              size: "sm",
              variant: "ghost",
            })}
            href={nextLessonHref}
          >
            {t("Skip lesson")}
            <ArrowRightIcon aria-hidden="true" />
          </PlayerLink>
        )}
      </PopoverContent>
    </Popover>
  );
}
