import "server-only";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { type NextPreloadTarget } from "@zoonk/core/player/commands/get-next-lesson-preload-target";
import { triggerChapterGeneration } from "./trigger-chapter-generation";
import { triggerLessonPreload } from "./trigger-lesson-preload";

/**
 * Lesson preloading can keep using the existing lesson workflow rules, but
 * chapter generation is paid work at the next-chapter boundary. Checking the
 * subscription before the chapter trigger avoids sending unpaid users into a
 * background request that the API would reject anyway.
 */
async function triggerSubscribedChapterGeneration(input: {
  chapterId: string;
  cookieHeader: string;
  requestHeaders: Headers;
}): Promise<void> {
  const hasSubscription = await hasActiveSubscription(input.requestHeaders);

  if (!hasSubscription) {
    return;
  }

  await triggerChapterGeneration({ chapterId: input.chapterId, cookieHeader: input.cookieHeader });
}

/**
 * Dispatches the server-derived preload target to the correct workflow. The
 * target is already trusted by the core lookup, so this helper only decides
 * which workflow endpoint should receive it and applies the chapter-only paid
 * subscription gate.
 */
export async function triggerPreloadTarget(input: {
  cookieHeader: string;
  requestHeaders: Headers;
  target: NextPreloadTarget;
}): Promise<void> {
  if (input.target.kind === "lesson") {
    await triggerLessonPreload({
      cookieHeader: input.cookieHeader,
      lessonId: input.target.lessonId,
    });

    return;
  }

  await triggerSubscribedChapterGeneration({
    chapterId: input.target.chapterId,
    cookieHeader: input.cookieHeader,
    requestHeaders: input.requestHeaders,
  });
}
