"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";
import { StepVisualRenderer } from "./step-visual-renderer";

export function VisualStep({ step }: { step: SerializedStep }) {
  const t = useExtracted();
  const content = parseStepContent("visual", step.content);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div
        aria-label={t("Visual content")}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-8 py-6 sm:px-10 sm:py-8"
        role="region"
      >
        <div className="flex min-h-full w-full min-w-0 items-center justify-center">
          <StepVisualRenderer content={content} />
        </div>
      </div>
    </div>
  );
}
