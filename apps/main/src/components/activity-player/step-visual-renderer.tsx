"use client";

import {
  type SupportedVisualKind,
  type VisualContentByKind,
} from "@zoonk/core/steps/visual-content-contract";
import dynamic from "next/dynamic";
import { ImageVisual } from "./image-visual";
import { QuoteVisual } from "./quote-visual";
import { TableVisual } from "./table-visual";
import { TimelineVisual } from "./timeline-visual";

const CodeVisual = dynamic(() =>
  import("./code-visual").then((mod) => ({ default: mod.CodeVisual })),
);

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

  // Other visual kinds will be added in Issues 21-22.
  return null;
}
