"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { renameCourseForAdmin } from "@zoonk/core/courses/rename";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

const ERRORS = {
  forbidden: "You can't edit courses.",
  invalidSlug: "Enter a slug with at least one letter or number.",
  notFound: "Course not found.",
  slugTaken: "That slug is already used by another course with the same owner.",
  unauthorized: "You can't edit courses.",
} as const;

/** Answers why it couldn't save, for the dialog that asked; no error means it saved. */
export async function updateCourseAction(formData: FormData): Promise<{ error: string | null }> {
  await assertAdmin();

  const id = parseFormField(formData, "id");
  const title = parseFormField(formData, "title");
  const slug = parseFormField(formData, "slug");

  if (!(isUuid(id) && title && slug)) {
    return { error: "Title and slug are required." };
  }

  const { data: result, error } = await safeAsync(() =>
    renameCourseForAdmin({ courseId: id, slug, title }),
  );

  if (error) {
    return { error: "Could not save this course. Please try again." };
  }

  if (result.status !== "renamed") {
    return { error: ERRORS[result.status] };
  }

  revalidatePath("/courses");
  revalidatePath(`/courses/${id}`);

  return { error: null };
}
