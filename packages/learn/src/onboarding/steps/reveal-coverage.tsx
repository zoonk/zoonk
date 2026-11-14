"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useCoveredText, usePlanCoverage } from "../../plan/plan-coverage";
import { useFullCourse } from "../../plan/plan-full-course";

/**
 * The one thing about the plan a learner may want to change before starting: their time doesn't
 * cover the goal. Everything else about what fits lives on the Plan.
 */
export function RevealCoverage({ onAddTime }: { onAddTime: () => void }) {
  const t = useExtracted();
  const coverage = usePlanCoverage();
  const coveredText = useCoveredText();
  const course = useFullCourse();

  // A plan that keeps going after the exam covers the rest then.
  if (!coverage || course?.on) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
      data-slot="reveal-coverage"
    >
      <p className="text-muted-foreground min-w-0 flex-1 basis-56 text-sm text-pretty">
        {coveredText(coverage)}
      </p>

      <Button onClick={onAddTime} size="sm" variant="outline">
        {t("Add time")}
      </Button>
    </div>
  );
}
