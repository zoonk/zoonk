"use client";

import {
  buildActivityCompletionKey,
  buildChapterCompletionKey,
  buildCourseCompletionKey,
  buildNextActivityKey,
  fetchChapterCompletion,
  fetchCompletedActivities,
  fetchCourseCompletion,
  fetchNextActivity,
} from "@/lib/progress-fetchers";
import { preload } from "swr";

export function ProgressPreloader({
  chapterId,
  courseId,
  lessonId,
}: {
  chapterId?: number;
  courseId?: number;
  lessonId?: number;
}) {
  void preload(buildNextActivityKey({ chapterId, courseId, lessonId }), fetchNextActivity);

  if (courseId) {
    void preload(buildCourseCompletionKey(courseId), fetchCourseCompletion);
  }

  if (chapterId) {
    void preload(buildChapterCompletionKey(chapterId), fetchChapterCompletion);
  }

  if (lessonId) {
    void preload(buildActivityCompletionKey(lessonId), fetchCompletedActivities);
  }

  return null;
}
