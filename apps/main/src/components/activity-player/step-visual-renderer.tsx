"use client";

import {
  type SupportedVisualKind,
  type VisualContentByKind,
} from "@zoonk/core/steps/visual-content-contract";
import { ChartVisual } from "./chart-visual";
import { CodeVisual } from "./code-visual";
import { ImageVisual } from "./image-visual";
import { QuoteVisual } from "./quote-visual";
import { TableVisual } from "./table-visual";
import { TimelineVisual } from "./timeline-visual";

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

  if (visualKind === "code") {
    return <CodeVisual content={visualContent} />;
  }

  if (visualKind === "table") {
    return <TableVisual content={visualContent} />;
  }

  if (visualKind === "timeline") {
    return <TimelineVisual content={visualContent} />;
  }

  if (visualKind === "chart") {
    return <ChartVisual content={visualContent} />;
  }

  // Other visual kinds will be added in Issue 22 (diagram).
  return null;
}
