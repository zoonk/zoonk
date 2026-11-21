"use client";

import { useCoveredText, usePlanCoverage } from "../../plan/plan-coverage";
import { useFullCourse } from "../../plan/plan-full-course";

/**
 * What the learner's time reaches, when it doesn't cover the goal. "Adjust plan" changes it; the
 * rest of what fits lives on the Plan.
 */
export function RevealCoverage() {
  const coverage = usePlanCoverage();
  const coveredText = useCoveredText();
  const course = useFullCourse();

  // A plan that keeps going after the exam covers the rest then.
  if (!coverage || course?.on) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm" data-slot="reveal-coverage">
      {coveredText(coverage)}
    </p>
  );
}
