"use server";

import { updateLessonVisibility } from "@zoonk/core/users/lesson-visibility";
import { type LessonKind } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { revalidatePath } from "next/cache";

/**
 * The app action owns transport error handling and route refresh while core
 * resolves identity and persists the reusable visibility resource.
 */
export async function updateHiddenLessonKindsAction({
  hiddenLessonKinds,
}: {
  hiddenLessonKinds: LessonKind[];
}) {
  const { data: result, error } = await safeAsync(() =>
    updateLessonVisibility({ hiddenLessonKinds }),
  );

  if (error) {
    logError("Error updating hidden lesson kinds:", error);
    return { status: "error" as const };
  }

  if (!result) {
    return { status: "error" as const };
  }

  revalidatePath("/[lang]/(catalog)", "layout");

  return { status: "success" as const };
}
