"use client";

import { type LessonVisual as LessonVisualData } from "@zoonk/core/library/steps/contract";
import { ChartVisualView } from "./chart-visual";
import { TimelineVisualView } from "./timeline-visual";

/**
 * The chart or timeline a lesson screen or a question shows, drawn from its data, so the numbers
 * and dates always match the words around it. Lesson screens and questions everywhere (sessions,
 * placement, mocks, challenges) use this one view.
 *
 * ```tsx
 * <LessonVisual visual={question.visual} />
 * ```
 */
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
