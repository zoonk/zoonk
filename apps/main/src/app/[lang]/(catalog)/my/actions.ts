"use server";

import { removeCurrentUserCourse } from "@zoonk/core/courses/remove-current-user";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

export type RemoveCurrentUserCourseState = { status: "error" | "idle" | "success" };

/**
 * Adapts the My Courses confirmation form to the shared authenticated Core
 * mutation, then refreshes this delivery surface so the removed row disappears.
 */
export async function removeCurrentUserCourseAction(
  _previousState: RemoveCurrentUserCourseState,
  formData: FormData,
): Promise<RemoveCurrentUserCourseState> {
  const courseId = parseFormField(formData, "courseId");

  if (!courseId || !isUuid(courseId)) {
    return { status: "error" as const };
  }

  const { data: result, error } = await safeAsync(() => removeCurrentUserCourse({ courseId }));

  if (error || !result) {
    logError("Error removing current user course:", error);
    return { status: "error" as const };
  }

  revalidatePath("/[lang]/(catalog)/my", "page");
  return { status: "success" as const };
}
