"use client";

import { TaskAsideContent } from "@zoonk/learn/task-layout";
import { cn } from "@zoonk/ui/lib/utils";
import { hasOwnSupport } from "../_utils/lesson-aside";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { useIsExploredPictureLost, useStepPictureShown } from "./lesson-pictures";

/**
 * Whether a teaching screen has support of its own (`hasOwnSupport`), with its picture as the
 * screen draws it: the lesson's aside shows it, and "From the lesson" otherwise.
 */
export function useHasOwnSupport(step: PlayableLibraryStep): boolean {
  const picture = useStepPictureShown(step);
  const exploreLost = useIsExploredPictureLost(step);

  return hasOwnSupport({ exploreLost, picture, step });
}

/**
 * A screen's own support, drawn once where screen readers meet it: above a question on a phone (its
 * situation, table, chart or picture), and with a reading screen's text (its picture, chart or
 * activity to explore). From `lg` it sits in the lesson's aside, beside the screen, and stays there
 * while a long text scrolls. A screen without any draws nothing here.
 */
export function ScreenSupport({
  children,
  className,
  step,
}: {
  children: React.ReactNode;
  className?: string;
  step: PlayableLibraryStep;
}) {
  if (!useHasOwnSupport(step)) {
    return children;
  }

  return (
    <TaskAsideContent
      className={cn("flex flex-col gap-3 lg:gap-4", className)}
      data-slot="lesson-screen-support"
    >
      {children}
    </TaskAsideContent>
  );
}
