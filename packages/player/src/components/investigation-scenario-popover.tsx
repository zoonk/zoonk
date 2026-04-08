"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { FileTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * A small icon button in the sticky header that opens a popover with
 * the investigation scenario.
 *
 * Shown during action and call steps so the learner can recall the
 * case without navigating back to the problem step. Uses the same
 * placement pattern as the story briefing popover.
 */
export function InvestigationScenarioPopover({ scenario }: { scenario: string }) {
  const t = useExtracted();

  return (
    <Popover>
      <PopoverTrigger className={buttonVariants({ size: "icon", variant: "ghost" })}>
        <FileTextIcon className="size-4" />
        <span className="sr-only">{t("The Case")}</span>
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom" sideOffset={8}>
        <PopoverDescription>{scenario}</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
