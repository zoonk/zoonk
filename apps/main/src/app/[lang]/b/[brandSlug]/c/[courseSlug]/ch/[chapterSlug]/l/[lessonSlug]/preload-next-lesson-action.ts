"use server";

import { triggerPreloadTarget } from "@/data/progress/trigger-preload-target";
import { getSession } from "@/data/users/get-session";
import { getNextPreloadTargets } from "@zoonk/core/player/commands/get-next-lesson-preload-target";
import { logError } from "@zoonk/utils/logger";
import { headers } from "next/headers";
import { after } from "next/server";

type NextPreloadInput = {
  cookieHeader: string;
  lessonId: string;
  requestHeaders: Headers;
  userId: string;
};

/**
 * Runs the expensive preload path after the server action returns. Keeping this
 * in a named helper makes the action itself a linear auth-and-schedule wrapper,
 * while still swallowing background errors so preload failures do not surface
 * as user-visible player errors.
 */
async function triggerNextPreload(input: NextPreloadInput): Promise<void> {
  try {
    const targets = await getNextPreloadTargets({ lessonId: input.lessonId, userId: input.userId });

    if (targets.length === 0) {
      return;
    }

    await Promise.all(
      targets.map((target) =>
        triggerPreloadTarget({
          cookieHeader: input.cookieHeader,
          requestHeaders: input.requestHeaders,
          target,
        }),
      ),
    );
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
  const [reqHeaders, session] = await Promise.all([headers(), getSession()]);

  if (!session) {
    return;
  }

  after(() =>
    triggerNextPreload({
      cookieHeader: reqHeaders.get("cookie") ?? "",
      lessonId,
      requestHeaders: reqHeaders,
      userId: session.user.id,
    }),
  );
}
