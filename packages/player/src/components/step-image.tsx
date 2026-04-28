"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import Image from "next/image";
import { useState } from "react";
import { STEP_IMAGE_SIZES } from "../image-config";

export type StepImageFit = "contain" | "cover";

const IMAGE_FIT_CLASS: Record<StepImageFit, string> = {
  contain: "object-contain",
  cover: "object-cover",
};

function StepImageFallback({ prompt }: { prompt: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <span className="text-muted-foreground text-center text-sm font-medium">{prompt}</span>
    </div>
  );
}

/**
 * Readable lesson steps now own their illustration directly. This component
 * keeps the render/fallback behavior shared between explanation and custom
 * steps so a missing upload still leaves the learner with the intended prompt.
 * Story screens also reuse it for larger hero scenes by switching the image fit
 * from the default contained illustration mode to cover.
 */
export function StepImageView({
  fit = "contain",
  image,
}: {
  fit?: StepImageFit;
  image: StepImage;
}) {
  const [errorUrl, setErrorUrl] = useState<string | null>(null);

  if (!image.url || errorUrl === image.url) {
    return <StepImageFallback prompt={image.prompt} />;
  }

  return (
    <div className="relative h-full w-full" data-slot="step-image-view">
      <Image
        alt={image.prompt}
        className={IMAGE_FIT_CLASS[fit]}
        fill
        loading="eager"
        onError={() => setErrorUrl(image.url ?? null)}
        sizes={STEP_IMAGE_SIZES}
        src={image.url}
      />
    </div>
  );
}
