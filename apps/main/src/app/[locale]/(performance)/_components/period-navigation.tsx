"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/next/app";

type PeriodNavigationProps = {
  hasPrevious: boolean;
  hasNext: boolean;
  periodLabel: string;
};

export function PeriodNavigation({
  hasPrevious,
  hasNext,
  periodLabel,
}: PeriodNavigationProps) {
  return (
    <NuqsAdapter>
      <PeriodNavigationContent
        hasNext={hasNext}
        hasPrevious={hasPrevious}
        periodLabel={periodLabel}
      />
    </NuqsAdapter>
  );
}

function PeriodNavigationContent({
  hasPrevious,
  hasNext,
  periodLabel,
}: PeriodNavigationProps) {
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
      <button
        aria-label={t("Previous period")}
        className={buttonVariants({
          size: "icon",
          variant: "outline",
        })}
        disabled={!hasPrevious}
        onClick={handlePrevious}
        type="button"
      >
        <ChevronLeftIcon aria-hidden className="size-4" />
      </button>

      <span className="min-w-32 text-center font-medium text-sm">
        {periodLabel}
      </span>

      <button
        aria-label={t("Next period")}
        className={buttonVariants({
          size: "icon",
          variant: "outline",
        })}
        disabled={!hasNext}
        onClick={handleNext}
        type="button"
      >
        <ChevronRightIcon aria-hidden className="size-4" />
      </button>
    </div>
  );
}
