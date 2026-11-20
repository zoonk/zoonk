"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef } from "react";
import { SuggestionAction } from "./suggestion";

/**
 * A suggestion's other ways out behind one button, after its one or two main answers. The menu
 * opens under the row of buttons, or over it where there is no room under, so it never covers the
 * main answer beside or above its own button.
 */
export function SuggestionMenu({ children }: { children: React.ReactNode }) {
  const t = useExtracted();
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger ref={trigger} render={<SuggestionAction variant="outline" />}>
        {t("Other options")}
        <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        anchor={() => trigger.current?.closest('[data-slot="suggestion-actions"]') ?? null}
        className="min-w-64"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
