"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import Image from "next/image";
import { useState } from "react";
import { STEP_FULL_BLEED_IMAGE_SIZES, STEP_IMAGE_SIZES } from "../image-config";

type StepImageFit = "contain" | "cover";

function StepImageFallback({ prompt }: { prompt: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <span className="text-muted-foreground text-center text-sm font-medium">{prompt}</span>
    </div>
  );
}

/**
 * Readable lesson steps now own their illustration directly. This component
 * keeps the render/fallback behavior shared between explanation and tutorial
 * steps so a missing upload still leaves the learner with the intended prompt.
 * Images are contained by default so diagrams and screenshots are not clipped,
 * while image-led hero screens can opt into cover cropping when the picture is
 * acting as the full-stage scene.
 */
export function StepImageView({
  fit = "contain",
  image,
}: {
  fit?: StepImageFit;
  image: StepImage;
}) {
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const imageSizes = fit === "cover" ? STEP_FULL_BLEED_IMAGE_SIZES : STEP_IMAGE_SIZES;

  if (!image.url || errorUrl === image.url) {
    return <StepImageFallback prompt={image.prompt} />;
  }

  return (
    <div className="relative h-full w-full" data-slot="step-image-view">
      <Image
        alt={image.prompt}
        className={fit === "cover" ? "object-cover" : "object-contain"}
        fill
        loading="eager"
        onError={() => setErrorUrl(image.url ?? null)}
        sizes={imageSizes}
        src={image.url}
      />
    </div>
  );
}
