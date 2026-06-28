"use client";

import { ContentFeedback } from "@/components/feedback/content-feedback";

type LessonPlayerViewerInput = {
  chapterSlug: string;
  courseSlug: string;
  isAuthenticated: boolean;
  lessonSlug: string;
  userEmail?: string;
  userName: string | null;
};

/**
 * Builds the player viewer config with the app-specific completion feedback
 * footer while keeping the route component focused on player lifecycle events.
 */
export function getPlayerViewer({
  chapterSlug,
  courseSlug,
  isAuthenticated,
  lessonSlug,
  userEmail,
  userName,
}: LessonPlayerViewerInput) {
  return {
    completionFooter: (
      <ContentFeedback
        className="pt-8"
        defaultEmail={userEmail}
        feedbackTarget={{ chapterSlug, courseSlug, kind: "lesson", lessonSlug }}
        variant="minimal"
      />
    ),
    isAuthenticated,
    userName,
  };
}
