"use client";

import {
  type GenerationAuthenticationGateTarget,
  trackGenerationAuthenticationGateShown,
} from "@/lib/track-events";
import { useEffect } from "react";

/** Records an impression only after the authentication gate reaches the browser. */
export function GenerationAuthenticationGateTracker({
  chapterSlug,
  courseSlug,
  lessonSlug,
  resource,
  targetLanguage,
}: GenerationAuthenticationGateTarget) {
  useEffect(() => {
    trackGenerationAuthenticationGateShown({
      ...(chapterSlug ? { chapterSlug } : {}),
      ...(courseSlug ? { courseSlug } : {}),
      ...(lessonSlug ? { lessonSlug } : {}),
      resource,
      ...(targetLanguage ? { targetLanguage } : {}),
    });
  }, [chapterSlug, courseSlug, lessonSlug, resource, targetLanguage]);

  return null;
}
