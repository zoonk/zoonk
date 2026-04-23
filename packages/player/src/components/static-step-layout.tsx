"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import { StepMediaLayout } from "./step-media-layout";

/**
 * Static explanation steps now combine the illustration and copy in one screen.
 * This layout keeps the existing text styling intact while giving the image the
 * remaining mobile height and a balanced 50/50 split on desktop.
 */
export function StaticStepLayout({
  children,
  image,
}: {
  children: React.ReactNode;
  image: StepImage;
}) {
  return (
    <StepMediaLayout image={image}>
      <div className="w-full" data-slot="static-step-copy">
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </div>
    </StepMediaLayout>
  );
}
