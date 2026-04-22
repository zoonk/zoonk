"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import Image from "next/image";
import { useState } from "react";
import { STEP_IMAGE_SIZES } from "../image-config";

function StepImageFallback({ prompt }: { prompt: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <span className="text-muted-foreground text-center text-sm font-medium">{prompt}</span>
    </div>
  );
}

/**
 * Readable activity steps now own their illustration directly. This component
 * keeps the render/fallback behavior shared between explanation and custom
 * steps so a missing upload still leaves the learner with the intended prompt.
 */
export function StepImageView({ image }: { image: StepImage }) {
  const [errorUrl, setErrorUrl] = useState<string | null>(null);

  if (!image.url || errorUrl === image.url) {
    return <StepImageFallback prompt={image.prompt} />;
  }

  return (
    <div className="relative h-full w-full" data-slot="step-image-view">
      <Image
        alt={image.prompt}
        className="object-contain"
        fill
        loading="eager"
        onError={() => setErrorUrl(image.url ?? null)}
        sizes={STEP_IMAGE_SIZES}
        src={image.url}
      />
    </div>
  );
}
