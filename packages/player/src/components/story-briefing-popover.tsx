"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { ScrollTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * A small icon button in the sticky header that opens a popover with the
 * story premise.
 *
 * Placed on the right side of the header (symmetrical with the close button
 * on the left) so players can recall the briefing during decision steps
 * without layout shift or navigating back.
 */
export function StoryBriefingPopover({ intro }: { intro: string }) {
  const t = useExtracted();

  return (
    <Popover>
      <PopoverTrigger className={buttonVariants({ size: "icon", variant: "ghost" })}>
        <ScrollTextIcon className="size-4" />
        <span className="sr-only">{t("Briefing")}</span>
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom" sideOffset={8}>
        <PopoverDescription>{intro}</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
