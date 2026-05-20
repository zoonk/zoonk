"use server";

import { triggerLessonPreload } from "@/data/progress/trigger-lesson-preload";
import { getNextLessonPreloadTarget } from "@zoonk/core/player/commands/get-next-lesson-preload-target";
import { getSession } from "@zoonk/core/users/session/get";
import { logError } from "@zoonk/utils/logger";
import { headers } from "next/headers";
import { after } from "next/server";

type NextLessonPreloadInput = { cookieHeader: string; lessonId: string; userId: string };

/**
 * Runs the expensive preload path after the server action returns. Keeping this
 * in a named helper makes the action itself a linear auth-and-schedule wrapper,
 * while still swallowing background errors so preload failures do not surface
 * as user-visible player errors.
 */
async function triggerNextLessonPreload(input: NextLessonPreloadInput): Promise<void> {
  try {
    const preloadLessonId = await getNextLessonPreloadTarget({
      lessonId: input.lessonId,
      userId: input.userId,
    });

    if (!preloadLessonId) {
      return;
    }

    await triggerLessonPreload({ cookieHeader: input.cookieHeader, lessonId: preloadLessonId });
  } catch (error) {
    logError("[preloadNextLesson] Failed to trigger next lesson preload:", error);
  }
}

/**
 * Starts generating the next lesson after the learner has shown real progress
 * in the current lesson. The client only sends the current lesson id; the
 * server derives the expensive generation target after auth and visibility
 * checks so this cannot be used as a generic lesson-generation proxy.
 */
export async function preloadNextLesson(lessonId: string): Promise<void> {
  const reqHeaders = await headers();
  const session = await getSession(reqHeaders);

  if (!session) {
    return;
  }

  after(() =>
    triggerNextLessonPreload({
      cookieHeader: reqHeaders.get("cookie") ?? "",
      lessonId,
      userId: session.user.id,
    }),
  );
}
