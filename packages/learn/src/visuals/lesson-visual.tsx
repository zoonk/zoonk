"use client";

import { type LessonVisual as LessonVisualData } from "@zoonk/core/library/steps/contract";
import { ChartVisualView } from "./chart-visual";
import { PlotVisualView } from "./plot-visual";
import { TimelineVisualView } from "./timeline-visual";

export function LessonVisual({
  className,
  visual,
}: {
  className?: string;
  visual: LessonVisualData | null | undefined;
}) {
  if (!visual) {
    return null;
  }

  if (visual.kind === "chart") {
    return <ChartVisualView className={className} visual={visual} />;
  }

  if (visual.kind === "plot") {
    return <PlotVisualView className={className} visual={visual} />;
  }

  return <TimelineVisualView className={className} visual={visual} />;
}
