"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { renameCourseForAdmin } from "@zoonk/core/courses/rename";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

export type UpdateCourseState = {
  error: string | null;
  slug: string;
  status: "idle" | "error" | "success";
  submissionId: number;
  title: string;
};

const ERRORS = {
  forbidden: "You can't edit courses.",
  invalidSlug: "Enter a slug with at least one letter or number.",
  notFound: "Course not found.",
  slugTaken: "That slug is already used by another course with the same owner.",
  unauthorized: "You can't edit courses.",
} as const;

/**
 * Keeps a course's display title, normalized search title, and URL slug in sync
 * while preserving the admin's ability to choose a slug independently. Core checks
 * the admin role again and expires the catalog's caches of both addresses.
 */
export async function updateCourseAction(
  previousState: UpdateCourseState,
  formData: FormData,
): Promise<UpdateCourseState> {
  await assertAdmin();

  const submissionId = previousState.submissionId + 1;
  const id = parseFormField(formData, "id");
  const title = parseFormField(formData, "title");
  const submittedSlug = parseFormField(formData, "slug");

  if (!(isUuid(id) && title && submittedSlug)) {
    return {
      ...previousState,
      error: "Title and slug are required.",
      status: "error",
      submissionId,
    };
  }

  const submittedState = { slug: submittedSlug, title };

  const { data: result, error } = await safeAsync(() =>
    renameCourseForAdmin({ courseId: id, slug: submittedSlug, title }),
  );

  if (error) {
    return {
      ...submittedState,
      error: "Could not save this course. Please try again.",
      status: "error",
      submissionId,
    };
  }

  if (result.status !== "renamed") {
    return { ...submittedState, error: ERRORS[result.status], status: "error", submissionId };
  }

  revalidatePath("/courses");
  revalidatePath(`/courses/${id}`);

  return { error: null, slug: result.slug, status: "success", submissionId, title };
}
