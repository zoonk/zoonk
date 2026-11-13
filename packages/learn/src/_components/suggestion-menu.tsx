"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SuggestionAction } from "./suggestion";

/** A suggestion's other ways out behind one button, after its one or two main answers. */
export function SuggestionMenu({ children }: { children: React.ReactNode }) {
  const t = useExtracted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SuggestionAction variant="outline" />}>
        {t("Other options")}
        <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-64">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
