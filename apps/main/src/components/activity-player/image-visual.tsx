"use client";

import {
  type SupportedVisualKind,
  type VisualContentByKind,
  imageVisualContentSchema,
} from "@zoonk/core/steps/visual-content-contract";
import Image from "next/image";
import { useState } from "react";

function ImageFallback({ prompt }: { prompt: string }) {
  return (
    <div className="bg-muted flex aspect-square w-full max-w-md items-center justify-center rounded-2xl p-6">
      <span className="text-muted-foreground text-center text-sm font-medium">{prompt}</span>
    </div>
  );
}

export function ImageVisual({ content }: { content: VisualContentByKind[SupportedVisualKind] }) {
  const parsed = imageVisualContentSchema.parse(content);
  const [hasError, setHasError] = useState(false);

  if (!parsed.url || hasError) {
    return <ImageFallback prompt={parsed.prompt} />;
  }

  return (
    <Image
      alt={parsed.prompt}
      className="aspect-square w-full max-w-md rounded-2xl object-cover"
      height={1024}
      onError={() => setHasError(true)}
      sizes="(max-width: 640px) calc(100vw - 2rem), 448px"
      src={parsed.url}
      width={1024}
    />
  );
}
