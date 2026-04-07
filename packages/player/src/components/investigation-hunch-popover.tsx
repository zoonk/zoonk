"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { SearchIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * A small icon button in the sticky header that opens a popover
 * showing the learner's chosen hunch.
 *
 * Visible during investigation action, evidence, and call steps
 * so the learner can recall their initial hypothesis without
 * navigating back to the problem step.
 */
export function InvestigationHunchPopover({ hunch }: { hunch: string }) {
  const t = useExtracted();

  return (
    <Popover>
      <PopoverTrigger className={buttonVariants({ size: "icon", variant: "ghost" })}>
        <SearchIcon className="size-4" />
        <span className="sr-only">{t("Your hunch")}</span>
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom" sideOffset={8}>
        <PopoverDescription>{hunch}</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
