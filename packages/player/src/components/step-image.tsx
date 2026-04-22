"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import Image from "next/image";
import { useState } from "react";
import { STEP_IMAGE_PROPS } from "../image-config";

function StepImageFallback({ prompt }: { prompt: string }) {
  return (
    <div className="bg-muted flex aspect-square w-full max-w-md items-center justify-center rounded-2xl p-6">
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
    <Image
      alt={image.prompt}
      className="aspect-square w-full max-w-md rounded-2xl object-cover"
      loading="eager"
      onError={() => setErrorUrl(image.url ?? null)}
      src={image.url}
      {...STEP_IMAGE_PROPS}
    />
  );
}
