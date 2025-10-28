"use server";

import { generateCourseThumbnail } from "@zoonk/ai/course-thumbnail";

export async function generateThumbnailAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();

  try {
    const imageUrl = await generateCourseThumbnail({ title });

    return { imageUrl, success: true };
  } catch (error) {
    console.error("Error generating thumbnail:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to generate thumbnail",
    };
  }
}
