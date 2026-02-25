"use server";

import { updateCourse } from "@/data/courses/update-course";
import { getErrorMessage } from "@/lib/error-messages";
import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { processAndUploadImage } from "@zoonk/core/images/process-and-upload";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { getExtracted } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

type CourseRouteParams = {
  courseId: number;
  courseSlug: string;
  orgSlug: string;
};

export async function uploadCourseImageAction(
  params: CourseRouteParams,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, orgSlug } = params;
  const file = formData.get("file");
  const t = await getExtracted();

  if (!(file && file instanceof File)) {
    return { error: t("No file provided") };
  }

  const { data: imageUrl, error: uploadError } = await processAndUploadImage({
    file,
    fileName: `courses/${orgSlug}/${courseSlug}.webp`,
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
    courseId,
    imageUrl,
  });

  if (updateError) {
    return { error: await getErrorMessage(updateError) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  revalidatePath(`/${orgSlug}/c/${courseSlug}`);
  return { error: null };
}

export async function removeCourseImageAction(
  params: CourseRouteParams,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, orgSlug } = params;
  const { error } = await updateCourse({
    courseId,
    imageUrl: null,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  revalidatePath(`/${orgSlug}/c/${courseSlug}`);
  return { error: null };
}
