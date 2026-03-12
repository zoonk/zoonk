"use client";

import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { type SerializedStep } from "../prepare-activity-data";
import { StaticTapZones, useStaticStepNavigation } from "./static-step-navigation";
import { StepVisualRenderer } from "./step-visual-renderer";

export function VisualStep({
  isFirst,
  onNavigateNext,
  onNavigatePrev,
  step,
}: {
  isFirst: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  step: SerializedStep;
}) {
  const content = parseStepContent("visual", step.content);

  const { onNavigateNextTap, onNavigatePrevTap, swipeHandlers } = useStaticStepNavigation({
    isFirst,
    onNavigateNext,
    onNavigatePrev,
  });

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col" {...swipeHandlers}>
      <StaticTapZones
        isFirst={isFirst}
        onNavigateNext={onNavigateNextTap}
        onNavigatePrev={onNavigatePrevTap}
      />

      <div className="pointer-events-none flex min-h-0 flex-1 items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
        <StepVisualRenderer content={content} />
      </div>
    </div>
  );
}
