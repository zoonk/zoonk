"use server";

import { getAuthorizedCourse } from "@/data/courses/get-authorized-course";
import { updateCourse } from "@/data/courses/update-course";
import { getErrorMessage } from "@/lib/error-messages";
import { processAndUploadImage } from "@zoonk/core/images/process-and-upload";
import { getExtracted } from "next-intl/server";
import { revalidatePath } from "next/cache";

type CourseActionParams = {
  courseId: number;
};

export async function uploadCourseImageAction(
  params: CourseActionParams,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { courseId } = params;
  const file = formData.get("file");
  const t = await getExtracted();

  if (!(file && file instanceof File)) {
    return { error: t("No file provided") };
  }

  const { data: course, error: courseError } = await getAuthorizedCourse({
    courseId,
  });

  if (courseError) {
    return { error: await getErrorMessage(courseError) };
  }

  const { data: imageUrl, error: uploadError } = await processAndUploadImage({
    file,
    fileName: `courses/${course.organization.slug}/${course.slug}.webp`,
  });

  if (uploadError) {
    const errorMessages: Record<typeof uploadError, string> = {
      invalidType: t("Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image."),
      optimizeFailed: t("Failed to process image. Please try again."),
      tooLarge: t("File is too large. Maximum size is 5MB."),
      uploadFailed: t("Failed to upload image. Please try again."),
    };

    return { error: errorMessages[uploadError] };
  }

  const { error: updateError } = await updateCourse({
    courseId: course.id,
    imageUrl,
  });

  if (updateError) {
    return { error: await getErrorMessage(updateError) };
  }

  revalidatePath(`/${course.organization.slug}/c/${course.slug}`);
  return { error: null };
}

export async function removeCourseImageAction(
  params: CourseActionParams,
): Promise<{ error: string | null }> {
  const { courseId } = params;
  const { data: course, error: courseError } = await getAuthorizedCourse({
    courseId,
  });

  if (courseError) {
    return { error: await getErrorMessage(courseError) };
  }

  const { error } = await updateCourse({
    courseId: course.id,
    imageUrl: null,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(`/${course.organization.slug}/c/${course.slug}`);
  return { error: null };
}
