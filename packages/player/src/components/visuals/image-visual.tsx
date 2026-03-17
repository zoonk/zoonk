"use client";

import { type ImageVisualContent } from "@zoonk/core/steps/visual-content-contract";
import Image from "next/image";
import { useState } from "react";

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
      height={1024}
      loading="eager"
      onError={() => setErrorUrl(content.url ?? null)}
      sizes="(max-width: 640px) calc(100vw - 2rem), 448px"
      src={content.url}
      width={1024}
    />
  );
}
