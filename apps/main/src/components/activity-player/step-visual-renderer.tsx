"use client";

import {
  type SupportedVisualKind,
  type VisualContentByKind,
} from "@zoonk/core/steps/visual-content-contract";
import { ImageVisual } from "./image-visual";
import { QuoteVisual } from "./quote-visual";

export function StepVisualRenderer({
  visualContent,
  visualKind,
}: {
  visualContent: VisualContentByKind[SupportedVisualKind] | null;
  visualKind: SupportedVisualKind | null;
}) {
  if (!visualKind || !visualContent) {
    return null;
  }

  if (visualKind === "quote") {
    return <QuoteVisual content={visualContent} />;
  }

  if (visualKind === "image") {
    return <ImageVisual content={visualContent} />;
  }

  // Other visual kinds will be added in Issues 17-22.
  return null;
}
