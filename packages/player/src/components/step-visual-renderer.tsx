"use client";

import {
  type SupportedVisualKind,
  type VisualContentByKind,
} from "@zoonk/core/steps/visual-content-contract";
import { ChartVisual } from "./visuals/chart-visual";
import { CodeVisual } from "./visuals/code-visual";
import { DiagramVisual } from "./visuals/diagram-visual";
import { ImageVisual } from "./visuals/image-visual";
import { QuoteVisual } from "./visuals/quote-visual";
import { TableVisual } from "./visuals/table-visual";
import { TimelineVisual } from "./visuals/timeline-visual";

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

  if (visualKind === "diagram") {
    return <DiagramVisual content={visualContent} />;
  }

  return null;
}
