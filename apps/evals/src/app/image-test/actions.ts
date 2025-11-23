"use server";

import { generateCourseThumbnail } from "@zoonk/ai/course-thumbnail";

export async function generateThumbnailAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();

  const { data: imageUrl, error } = await generateCourseThumbnail({ title });

  if (error) {
    console.error("Error generating thumbnail:", error);
    return { error: error.message };
  }

  return { imageUrl, success: true };
}
