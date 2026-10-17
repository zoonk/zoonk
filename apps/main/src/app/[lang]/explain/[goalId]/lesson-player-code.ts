import { type LessonPlayerClient } from "@/app/[lang]/learn/[lessonId]/lesson-player-client";
import { createSharedImport } from "@/lib/shared-import";

/** One load of the player per tab: whichever link, page or preload starts it is the one used. */
export const importLessonPlayer = createSharedImport<{
  LessonPlayerClient: typeof LessonPlayerClient;
}>();

/** Starts loading the player before an explanation needs it, so it opens at once. */
export function preloadLessonPlayer() {
  void importLessonPlayer(() => import("@/app/[lang]/learn/[lessonId]/lesson-player-client")).catch(
    () => null,
  );
}
