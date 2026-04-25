"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import { StepMediaLayout } from "./step-media-layout";

/**
 * Static explanation steps keep their copy styling separate from the media
 * shell. The shared media layout decides how the image bleeds; this wrapper
 * only preserves the static-step slot used by the text renderer.
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
        {children}
      </div>
    </StepMediaLayout>
  );
}
