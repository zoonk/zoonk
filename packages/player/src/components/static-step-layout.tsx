"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import { StepImageView } from "./step-image";

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
    <div
      className="flex h-full min-h-0 w-full flex-col lg:grid lg:grid-cols-2"
      data-slot="static-step-layout"
    >
      <div className="flex min-h-0 flex-1 px-4 pt-4 sm:px-6 sm:pt-6 lg:h-full lg:px-6 lg:py-6">
        <div
          className="relative h-full min-h-0 w-full overflow-hidden lg:rounded-[2rem]"
          data-slot="static-step-media-stage"
        >
          <StepImageView image={image} />
        </div>
      </div>

      <div
        className="shrink-0 px-4 pt-3 pb-4 sm:px-6 sm:pb-6 lg:flex lg:min-h-0 lg:items-center lg:px-10 lg:py-6"
        data-slot="static-step-copy"
      >
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
