"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import { StepImageView } from "./step-image";

/**
 * Image-led learning steps share the same media shell: one stage for the
 * generated artifact and one scrollable copy pane beside or below it. Keeping
 * that split in one component prevents practice questions and static reading
 * steps from drifting into different image layouts over time.
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
      className="flex h-full min-h-0 w-full flex-col lg:grid lg:grid-cols-2 lg:content-center lg:items-start"
      data-slot="step-media-layout"
    >
      <div className="flex min-h-0 flex-1 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-6 lg:py-6">
        <div
          className="relative h-full min-h-0 w-full overflow-hidden lg:ml-auto lg:h-[min(70vh,40rem)] lg:max-w-xl lg:[&_img]:object-top"
          data-slot="step-media-stage"
        >
          <StepImageView image={image} />
        </div>
      </div>

      <div
        className="min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-4 sm:px-6 sm:pb-6 lg:flex lg:max-h-[min(70vh,40rem)] lg:items-start lg:px-10 lg:py-6"
        data-slot="step-media-copy"
      >
        {children}
      </div>
    </div>
  );
}
