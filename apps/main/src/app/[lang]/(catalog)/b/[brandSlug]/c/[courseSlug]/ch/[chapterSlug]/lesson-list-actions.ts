"use server";

import { updateUserHiddenLessonKinds } from "@/data/users/lesson-filter-settings";
import { type LessonKind } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { revalidatePath } from "next/cache";

/**
 * Lesson type visibility is a user setting, so the data helper owns current
 * session lookup before touching the shared learning-profile preferences record.
 */
export async function updateHiddenLessonKindsAction({
  hiddenLessonKinds,
}: {
  hiddenLessonKinds: LessonKind[];
}) {
  const { data: result, error } = await safeAsync(() =>
    updateUserHiddenLessonKinds({ hiddenLessonKinds }),
  );

  const updateError = error ?? result?.error;

  if (updateError) {
    logError("Error updating hidden lesson kinds:", updateError);
    return { status: "error" as const };
  }

  if (!result?.saved) {
    return { status: "error" as const };
  }

  revalidatePath("/[lang]/(catalog)", "layout");

  return { status: "success" as const };
}
