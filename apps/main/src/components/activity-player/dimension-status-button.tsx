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
import { BarChart3Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DimensionList, buildDimensionEntries, hasNegativeDimension } from "./dimension-inventory";
import { type DimensionInventory } from "./player-reducer";

function getIconColor(dimensions: DimensionInventory): string {
  if (hasNegativeDimension(dimensions)) {
    return "text-destructive";
  }

  if (Object.values(dimensions).some((value) => value === 0)) {
    return "text-warning";
  }

  return "text-muted-foreground";
}

export function DimensionStatusButton({ dimensions }: { dimensions: DimensionInventory }) {
  const t = useExtracted();
  const entries = buildDimensionEntries(dimensions, []);
  const iconColor = getIconColor(dimensions);

  return (
    <Popover>
      <PopoverTrigger render={<Button aria-label={t("View stats")} size="icon" variant="ghost" />}>
        <BarChart3Icon className={cn("size-4", iconColor)} />
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom">
        <PopoverHeader>
          <PopoverTitle>{t("Stats")}</PopoverTitle>
        </PopoverHeader>

        <DimensionList
          aria-label={t("Current dimension scores")}
          entries={entries}
          variant="status"
        />
      </PopoverContent>
    </Popover>
  );
}
