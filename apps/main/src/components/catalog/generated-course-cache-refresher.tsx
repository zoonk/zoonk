"use client";

import { refreshGeneratedCourseCache } from "@/data/courses/refresh-generated-course-cache";
import { logError } from "@zoonk/utils/logger";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";

const COURSE_COMPLETION_POLL_INTERVAL_MS = 5000;

/**
 * Keeps an open course or intro lesson synchronized with its background course
 * workflow. The server action expires shared entries only after completion, and
 * the router refresh replaces the partial curriculum without a full reload.
 */
export function GeneratedCourseCacheRefresher({ courseId }: { courseId: string }) {
  const router = useRouter();
  const refreshRoute = useEffectEvent(() => router.refresh());

  useEffect(() => {
    const interval = setInterval(() => {
      void refreshGeneratedCourseCache({ courseId })
        .then((isComplete) => {
          if (!isComplete) {
            return;
          }

          clearInterval(interval);
          refreshRoute();
        })
        .catch((error: unknown) => {
          logError("Failed to refresh generated course cache", error);
        });
    }, COURSE_COMPLETION_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [courseId]);

  return null;
}
