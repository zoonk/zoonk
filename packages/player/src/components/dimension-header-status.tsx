"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type DimensionInventory } from "../player-reducer";
import { getHeaderDimensionState, getStatusColor } from "./_utils/dimension-header-status";
import { DimensionList, buildDimensionEntries } from "./dimension-inventory";

export function DimensionHeaderStatus({
  changedDimensions,
  dimensions,
}: {
  changedDimensions: Set<string>;
  dimensions: DimensionInventory;
}) {
  const t = useExtracted();
  const state = getHeaderDimensionState(dimensions);
  const entries = buildDimensionEntries(dimensions, []);
  const color = getStatusColor(state.kind);
  const hasChanges = changedDimensions.size > 0;

  function getLabel(): string {
    if (state.kind === "negative") {
      return t("{count} in danger", { count: String(state.count) });
    }

    if (state.kind === "at-risk") {
      return t("{count} at risk", { count: String(state.count) });
    }

    return t("All clear");
  }

  const label = getLabel();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button aria-label={t("View scores")} className="gap-1 px-2" size="sm" variant="ghost" />
        }
      >
        <span
          className={cn(
            "text-sm",
            color,
            state.kind === "negative" && hasChanges && "animate-shake motion-reduce:animate-none",
          )}
          role="status"
        >
          {label}
        </span>
        <ChevronDownIcon aria-hidden className="text-muted-foreground size-3 opacity-60" />
      </PopoverTrigger>

      <PopoverContent side="bottom" sideOffset={8}>
        <PopoverHeader>
          <PopoverTitle>{t("Your scores")}</PopoverTitle>
        </PopoverHeader>

        <DimensionList aria-label={t("Current scores")} entries={entries} variant="status" />
      </PopoverContent>
    </Popover>
  );
}
