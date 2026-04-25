"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import { ExpandableStepImageStage } from "./expandable-step-image-stage";

/**
 * Static image-led reading steps share one immersive media shell: the image
 * fills the available visual area, while the copy stays anchored below it on
 * mobile and centered beside it on desktop. Keeping that split here prevents
 * static variants from drifting into separate image policies.
 */
export function StepMediaLayout({
  children,
  image,
}: {
  children: React.ReactNode;
  image: StepImage;
}) {
  return (
    <div
      className="grid h-full min-h-0 w-full grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-2 lg:grid-rows-1"
      data-slot="step-media-layout"
    >
      <div className="min-h-0" data-slot="step-media-stage">
        <ExpandableStepImageStage className="[&_img]:object-top" image={image} />
      </div>

      <div
        className="bg-background max-h-[45dvh] min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6 lg:flex lg:max-h-none lg:items-center lg:justify-center lg:px-12 lg:py-10"
        data-slot="step-media-copy"
      >
        <div className="mx-auto w-full max-w-2xl lg:mx-0 lg:max-w-md">{children}</div>
      </div>
    </div>
  );
}
