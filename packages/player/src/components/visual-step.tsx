"use client";

import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { type SerializedStep } from "../prepare-activity-data";
import { StepVisualRenderer } from "./step-visual-renderer";

export function VisualStep({ step }: { step: SerializedStep }) {
  const content = parseStepContent("visual", step.content);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 py-6 sm:px-6 sm:py-8">
        <StepVisualRenderer content={content} />
      </div>
    </div>
  );
}
