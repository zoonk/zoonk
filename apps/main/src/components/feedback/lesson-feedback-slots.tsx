"use client";

import { ContentVoteMenuItems } from "@zoonk/learn/feedback/menu-items";
import { ContentThumbs, ContentThumbsRow } from "@zoonk/learn/feedback/thumbs";
import { type LessonPlayerProviderProps } from "@zoonk/player/lesson";

/**
 * The player's feedback slots: votes in each screen's menu, small thumbs under an answer's
 * explanation and a quiet thumbs row at the end.
 */
export const LESSON_FEEDBACK_SLOTS: NonNullable<LessonPlayerProviderProps["slots"]> = {
  answerFeedback: (target) => <ContentThumbs target={target} />,
  completionFeedback: (target) => <ContentThumbsRow className="self-center" target={target} />,
  screenMenuItems: (target) => <ContentVoteMenuItems screen="lesson-step" target={target} />,
};
