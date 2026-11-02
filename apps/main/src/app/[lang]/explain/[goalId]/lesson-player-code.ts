import { type LessonPlayerClient } from "@/app/[lang]/learn/[lessonId]/lesson-player-client";
import { createSharedImport } from "@/lib/shared-import";

export const importLessonPlayer = createSharedImport<{
  LessonPlayerClient: typeof LessonPlayerClient;
}>();

export function preloadLessonPlayer() {
  void importLessonPlayer(() => import("@/app/[lang]/learn/[lessonId]/lesson-player-client")).catch(
    () => null,
  );
}
