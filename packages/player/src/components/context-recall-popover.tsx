"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { BookOpenTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * A small icon button in the sticky header that opens a popover with
 * the activity's initial context (story briefing, investigation scenario, etc.).
 *
 * Lets learners recall the premise mid-activity without navigating back.
 * Placed on the right side of the header, symmetrical with the close
 * button on the left.
 */
export function ContextRecallPopover({ content }: { content: string }) {
  const t = useExtracted();

  return (
    <Popover>
      <PopoverTrigger className={buttonVariants({ size: "icon", variant: "ghost" })}>
        <BookOpenTextIcon className="size-4" />
        <span className="sr-only">{t("Context")}</span>
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom" sideOffset={8}>
        <PopoverDescription>{content}</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
