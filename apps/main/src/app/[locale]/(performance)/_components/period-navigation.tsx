"use client";

import { Button } from "@zoonk/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";

export function PeriodNavigation({
  hasPrevious,
  hasNext,
  periodLabel,
}: {
  hasPrevious: boolean;
  hasNext: boolean;
  periodLabel: string;
}) {
  const t = useExtracted();

  const [offset, setOffset] = useQueryState("offset", {
    defaultValue: "0",
    shallow: false,
  });

  const currentOffset = Number(offset) || 0;

  function handlePrevious() {
    void setOffset(String(currentOffset + 1));
  }

  function handleNext() {
    void setOffset(String(Math.max(0, currentOffset - 1)));
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        aria-label={t("Previous period")}
        disabled={!hasPrevious}
        onClick={handlePrevious}
        size="icon"
        variant="outline"
      >
        <ChevronLeftIcon aria-hidden />
      </Button>

      <span className="min-w-32 text-center text-sm font-medium">{periodLabel}</span>

      <Button
        aria-label={t("Next period")}
        disabled={!hasNext}
        onClick={handleNext}
        size="icon"
        variant="outline"
      >
        <ChevronRightIcon aria-hidden />
      </Button>
    </div>
  );
}
