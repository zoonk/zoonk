"use client";

import { type ImageVisualContent } from "@zoonk/core/steps/contract/visual";
import Image from "next/image";
import { useState } from "react";
import { VISUAL_IMAGE_PROPS } from "../../image-config";

function ImageFallback({ prompt }: { prompt: string }) {
  return (
    <div className="bg-muted flex aspect-square w-full max-w-md items-center justify-center rounded-2xl p-6">
      <span className="text-muted-foreground text-center text-sm font-medium">{prompt}</span>
    </div>
  );
}

export function ImageVisual({ content }: { content: ImageVisualContent }) {
  const [errorUrl, setErrorUrl] = useState<string | null>(null);

  if (!content.url || errorUrl === content.url) {
    return <ImageFallback prompt={content.prompt} />;
  }

  return (
    <Image
      alt={content.prompt}
      className="aspect-square w-full max-w-md rounded-2xl object-cover"
      loading="eager"
      onError={() => setErrorUrl(content.url ?? null)}
      src={content.url}
      {...VISUAL_IMAGE_PROPS}
    />
  );
}
