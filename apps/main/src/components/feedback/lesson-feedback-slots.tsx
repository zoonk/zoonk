"use client";

import { ReportProblemItem } from "@zoonk/learn/feedback/menu-items";
import { type LessonPlayerProviderProps } from "@zoonk/player/lesson";

export const LESSON_FEEDBACK_SLOTS: NonNullable<LessonPlayerProviderProps["slots"]> = {
  reportMenuItem: (target) => <ReportProblemItem screen="lesson-step" target={target} />,
};
