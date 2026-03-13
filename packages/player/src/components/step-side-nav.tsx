"use client";

import { Button } from "@zoonk/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useExtracted } from "next-intl";

export function StepSideNav({
  isFirst,
  onNavigateNext,
  onNavigatePrev,
}: {
  isFirst: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  const t = useExtracted();

  return (
    <>
      <Button
        aria-label={t("Previous step")}
        className="absolute top-1/2 left-4 hidden -translate-y-1/2 lg:flex"
        disabled={isFirst}
        onClick={onNavigatePrev}
        size="icon-lg"
        variant="outline"
      >
        <ChevronLeft />
      </Button>

      <Button
        aria-label={t("Next step")}
        className="absolute top-1/2 right-4 hidden -translate-y-1/2 lg:flex"
        onClick={onNavigateNext}
        size="icon-lg"
        variant="outline"
      >
        <ChevronRight />
      </Button>
    </>
  );
}
