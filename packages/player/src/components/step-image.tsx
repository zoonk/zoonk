"use client";

import { type ExerciseImage } from "@zoonk/core/library/steps/contract/language-exercises";
import Image from "next/image";
import { useState } from "react";

function StepImageFallback({ prompt }: { prompt: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <span className="text-muted-foreground text-center text-sm font-medium">{prompt}</span>
    </div>
  );
}

export function StepImageView({ image }: { image: ExerciseImage }) {
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
        sizes="(max-width: 1024px) 100vw, 50vw"
        src={image.url}
      />
    </div>
  );
}
