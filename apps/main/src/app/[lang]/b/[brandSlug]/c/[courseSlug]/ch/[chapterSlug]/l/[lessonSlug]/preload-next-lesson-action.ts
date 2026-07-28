"use server";

import { logError } from "@zoonk/utils/logger";
import { API_URL } from "@zoonk/utils/url";
import { headers } from "next/headers";
import { after } from "next/server";

type NextPreloadInput = { cookieHeader: string; lessonId: string };
const API_ORIGIN = new URL(API_URL).origin;

/**
 * Delegates preload target selection and workflow starts to the same API
 * capability used by external clients, then keeps background failures out of
 * the learner's current lesson.
 */
async function triggerNextPreload(input: NextPreloadInput): Promise<void> {
  try {
    const response = await fetch(
      `${API_URL}/v1/lessons/${encodeURIComponent(input.lessonId)}/preloads`,
      { headers: { Cookie: input.cookieHeader, Origin: API_ORIGIN }, method: "POST" },
    );

    if (!response.ok) {
      logError("[preloadNextLesson] Failed to trigger preload:", {
        lessonId: input.lessonId,
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error) {
    logError("[preloadNextLesson] Failed to trigger preload:", error);
  }
}

/**
 * Starts preparing the next generated item after the learner has shown real
 * progress in the current lesson. The client only sends the current lesson id;
 * the server derives the expensive generation target after auth and visibility
 * checks so this cannot be used as a generic generation proxy.
 */
export async function preloadNextLesson(lessonId: string): Promise<void> {
  const reqHeaders = await headers();

  after(() => triggerNextPreload({ cookieHeader: reqHeaders.get("cookie") ?? "", lessonId }));
}
