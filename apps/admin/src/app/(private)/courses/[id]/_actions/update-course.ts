"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

export type UpdateCourseState = {
  error: string | null;
  slug: string;
  status: "idle" | "error" | "success";
  submissionId: number;
  title: string;
};

/**
 * An unchanged stored slug must remain byte-for-byte stable, including older
 * values that may predate today's slug length rules. New input is normalized
 * through the shared slug function before it is persisted.
 */
function getUpdatedSlug({
  currentSlug,
  submittedSlug,
}: {
  currentSlug: string;
  submittedSlug: string;
}) {
  if (submittedSlug === currentSlug) {
    return currentSlug;
  }

  return toSlug(submittedSlug);
}

/**
 * Keeps a course's display title, normalized search title, and URL slug in sync
 * while preserving the admin's ability to choose a slug independently.
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

  const { data: course, error: readError } = await safeAsync(() =>
    prisma.course.findUnique({ where: { id } }),
  );

  if (readError) {
    return {
      ...submittedState,
      error: "Could not load this course. Please try again.",
      status: "error",
      submissionId,
    };
  }

  if (!course) {
    return { ...submittedState, error: "Course not found.", status: "error", submissionId };
  }

  const slug = getUpdatedSlug({ currentSlug: course.slug, submittedSlug });

  if (!slug) {
    return {
      ...submittedState,
      error: "Enter a slug with at least one letter or number.",
      status: "error",
      submissionId,
    };
  }

  const { error: updateError } = await safeAsync(() =>
    prisma.course.update({
      data: { normalizedTitle: normalizeString(title), slug, title },
      where: { id },
    }),
  );

  if (isPrismaUniqueConstraintError(updateError)) {
    return {
      ...submittedState,
      error: "That slug is already used by another course with the same owner.",
      status: "error",
      submissionId,
    };
  }

  if (updateError) {
    return {
      ...submittedState,
      error: "Could not save this course. Please try again.",
      status: "error",
      submissionId,
    };
  }

  revalidatePath("/courses");
  revalidatePath(`/courses/${id}`);

  return { error: null, slug, status: "success", submissionId, title };
}
