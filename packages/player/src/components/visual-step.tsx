"use client";

import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { useExtracted } from "next-intl";
import { type SerializedStep } from "../prepare-activity-data";
import { StepVisualRenderer } from "./step-visual-renderer";

export function VisualStep({ step }: { step: SerializedStep }) {
  const t = useExtracted();
  const content = parseStepContent("visual", step.content);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div
        aria-label={t("Visual content")}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-6 py-6 sm:px-8 sm:py-8"
        role="region"
      >
        <div className="flex min-h-full w-full min-w-0 items-center justify-center">
          <StepVisualRenderer content={content} />
        </div>
      </div>
    </div>
  );
}
