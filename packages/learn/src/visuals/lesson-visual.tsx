"use client";

import { type LessonVisual as LessonVisualData } from "@zoonk/core/library/steps/contract";
import { ChartVisualView } from "./chart-visual";
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

  return visual.kind === "chart" ? (
    <ChartVisualView className={className} visual={visual} />
  ) : (
    <TimelineVisualView className={className} visual={visual} />
  );
}
