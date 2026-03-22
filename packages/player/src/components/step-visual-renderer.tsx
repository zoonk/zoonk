"use client";

import { type VisualStepContent } from "@zoonk/core/steps/visual-content-contract";
import { ChartVisual } from "./visuals/chart-visual";
import { CodeVisual } from "./visuals/code-visual";
import { DiagramVisual } from "./visuals/diagram-visual";
import { FormulaVisual } from "./visuals/formula-visual";
import { ImageVisual } from "./visuals/image-visual";
import { MusicVisual } from "./visuals/music-visual";
import { QuoteVisual } from "./visuals/quote-visual";
import { TableVisual } from "./visuals/table-visual";
import { TimelineVisual } from "./visuals/timeline-visual";

export function StepVisualRenderer({ content }: { content: VisualStepContent }) {
  if (content.kind === "quote") {
    return <QuoteVisual content={content} />;
  }

  if (content.kind === "image") {
    return <ImageVisual content={content} />;
  }

  if (content.kind === "code") {
    return <CodeVisual content={content} />;
  }

  if (content.kind === "table") {
    return <TableVisual content={content} />;
  }

  if (content.kind === "timeline") {
    return <TimelineVisual content={content} />;
  }

  if (content.kind === "chart") {
    return <ChartVisual content={content} />;
  }

  if (content.kind === "diagram") {
    return <DiagramVisual content={content} />;
  }

  if (content.kind === "formula") {
    return <FormulaVisual content={content} />;
  }

  if (content.kind === "music") {
    return <MusicVisual content={content} />;
  }

  return null;
}
