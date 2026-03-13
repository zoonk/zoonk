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
    <nav
      aria-label={t("Step navigation")}
      className="pointer-events-none absolute inset-0 z-10 hidden lg:block"
    >
      <Button
        aria-label={t("Previous step")}
        className="pointer-events-auto absolute top-1/2 left-4 flex -translate-y-1/2"
        disabled={isFirst}
        onClick={onNavigatePrev}
        size="icon-lg"
        variant="outline"
      >
        <ChevronLeft />
      </Button>

      <Button
        aria-label={t("Next step")}
        className="pointer-events-auto absolute top-1/2 right-4 flex -translate-y-1/2"
        onClick={onNavigateNext}
        size="icon-lg"
        variant="outline"
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}
